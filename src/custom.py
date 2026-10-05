"""Analyze reviews a user uploads or pastes (e.g. exported from Taobao/JD/Douyin seller
back-ends, or copied from RedNote). Runs the same pipeline in memory:
generate a taxonomy for the category -> label -> build tables."""
from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path

import pandas as pd

import config
import label_reviews
from analyze import build_tables, load_labels
from generate_taxonomy import SYSTEM as TAXONOMY_SYSTEM, clean
from taxonomy import TEA_TAXONOMY

MAX_REVIEWS = 2000  # above this, a random sample is analyzed (about +/-2% on shares)

# Speed settings per provider kind: (requests per minute, parallel calls, reviews per call).
# Gemini's free tier allows about 15 requests a minute, so we stay at 12 for headroom and send
# bigger batches instead. Paid APIs (DeepSeek, OpenAI, Claude, Qwen...) allow far more requests,
# but some cap output length, so they keep 20 reviews per call and run several calls at once.
# A 429 (rate limited) is retried with backoff, so going over a limit slows down instead of failing.
SPEED = {"gemini": (12, 3, 40), "default": (60, 8, 20)}


def detect_language(texts: pd.Series) -> str:
    joined = "".join(texts.astype(str).head(20))
    return "zh" if len(re.findall(r"[一-鿿]", joined)) > len(joined) * 0.2 else "en"


def to_sample(texts: list[str], category: str, platform: str) -> pd.DataFrame:
    texts = [t.strip() for t in texts if isinstance(t, str) and len(t.strip()) >= 2]
    if len(texts) > MAX_REVIEWS:
        # random, not the first N: exports are often sorted by date, so the head is biased
        texts = pd.Series(texts).sample(MAX_REVIEWS, random_state=0).tolist()
    return pd.DataFrame({
        "review_id": range(1, len(texts) + 1), "dataset": "custom", "market": "custom",
        "platform": platform, "category": category, "group_id": category,
        "rating": pd.NA, "human_label": pd.NA, "title": "", "text": texts,
    })


def speed_for(client) -> tuple[float, int, int]:
    return SPEED["gemini"] if getattr(client, "name", "") == "gemini" else SPEED["default"]


def estimate_minutes(n_reviews: int, provider_kind: str) -> float:
    """Rough wall-clock time: limited by the rate cap or by ~10 s per call spread over the workers."""
    rpm, workers, batch = SPEED.get(provider_kind, SPEED["default"])
    calls = -(-n_reviews // batch) + 2  # + taxonomy + brief
    return max(calls / rpm, calls * 10 / 60 / workers)


def run_custom(client, sample: pd.DataFrame, category: str, batch_size: int | None = None,
               rpm: float | None = None, workers: int | None = None, progress=None):
    """Returns (taxonomy, reviews, aspects, groups)."""
    d_rpm, d_workers, d_batch = speed_for(client)
    rpm = d_rpm if rpm is None else rpm
    workers = d_workers if workers is None else workers
    batch_size = d_batch if batch_size is None else batch_size
    if category.strip().lower() in ("tea", "茶", "茶叶"):
        tax = dict(TEA_TAXONOMY, category=category)
    else:
        # spread the taxonomy sample across the whole upload, not just the first rows
        picks = sample.text.sample(min(len(sample), 60), random_state=0)
        user = json.dumps({"category": category, "reviews": picks.str[:300].tolist()},
                          ensure_ascii=False)
        tax = clean(client.complete_json(TAXONOMY_SYSTEM, user), category)

    config.DATASETS["custom"] = {"language": detect_language(sample.text)}
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "custom.jsonl"
        label_reviews.run(client, sample, "custom", batch_size, rpm, out_path=out,
                          taxonomies={category: tax}, workers=workers, progress=progress)
        labels = load_labels(out) if out.exists() else []
    if not labels:
        raise RuntimeError("The model returned no usable labels. Try again or use fewer reviews.")
    reviews, aspects, groups = build_tables("custom", sample, labels, taxonomies={category: tax})
    return tax, reviews, aspects, groups


def make_brief(client, reviews: pd.DataFrame, aspects: pd.DataFrame, tax: dict, lang: str = "en") -> dict:
    """One extra LLM call: the same ops brief the built-in examples get."""
    from generate_briefs import LANG_RULE, SYSTEM, payload
    system = SYSTEM.replace("Write in English; keep customer quotes in their\noriginal language.", LANG_RULE[lang])
    owners = sorted({a["owner"] for a in tax["aspects"]})
    gid = reviews.group_id.iloc[0]
    out = client.complete_json(system, payload(gid, reviews, aspects, owners))
    out["model"] = getattr(client, "model", "")
    return out
