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
from llm_client import LLMError
from taxonomy import TEA_TAXONOMY

# How many reviews one web run can label. Above the sample size the default is a random sample,
# which already estimates each issue's share within about +/-2%. Paid APIs can label everything
# up to the hard limit; Gemini's free tier is capped lower because of its per-minute and daily quotas.
SAMPLE_SIZE = 2000
LIMITS = {"gemini": 2000, "default": 10000}
MAX_REVIEWS = SAMPLE_SIZE  # kept for older callers

# Speed settings per provider kind: (requests per minute, parallel calls, reviews per call).
# Gemini's free tier allows about 15 requests a minute, so we stay at 12 for headroom and send
# bigger batches instead. Paid APIs (DeepSeek, OpenAI, Claude, Qwen...) allow far more requests,
# but some cap output length, so they keep 20 reviews per call and run several calls at once.
# A 429 (rate limited) is retried with backoff, so going over a limit slows down instead of failing.
SPEED = {"gemini": (12, 3, 40), "default": (60, 8, 20)}


def provider_kind(client_or_kind) -> str:
    name = client_or_kind if isinstance(client_or_kind, str) else getattr(client_or_kind, "name", "")
    return "gemini" if name == "gemini" else "default"


def limit_for(kind: str) -> int:
    return LIMITS.get(kind, LIMITS["default"])


def detect_language(texts: pd.Series) -> str:
    joined = "".join(texts.astype(str).head(20))
    return "zh" if len(re.findall(r"[一-鿿]", joined)) > len(joined) * 0.2 else "en"


def clean_reviews(texts, ratings=None, strata=None) -> pd.DataFrame:
    """Drop empty, too-short and duplicate reviews. ratings / strata are optional lists aligned with texts."""
    df = pd.DataFrame({"text": pd.Series(list(texts), dtype="object")})
    df["rating"] = pd.to_numeric(pd.Series(ratings), errors="coerce") if ratings is not None else float("nan")
    df.loc[~df.rating.between(1, 5), "rating"] = float("nan")  # only real 1-5 star ratings
    df["stratum"] = pd.Series(strata, dtype="object").fillna("?").astype(str).values if strata is not None else ""
    df = df[df.text.apply(lambda t: isinstance(t, str) and len(t.strip()) >= 2)].copy()
    df["text"] = df.text.str.strip()
    return df.drop_duplicates("text").reset_index(drop=True)


def stratified_sample(df: pd.DataFrame, n: int, seed: int = 0) -> pd.DataFrame:
    """Random sample of n rows that keeps each stratum (star level, month...) at its real share."""
    if df.stratum.nunique() <= 1:
        return df.sample(n, random_state=seed)
    share = df.stratum.value_counts(normalize=True)
    quota = (share * n).round().astype(int)
    parts = [df[df.stratum == s].sample(min(q, (df.stratum == s).sum()), random_state=seed) for s, q in quota.items()]
    out = pd.concat(parts)
    if len(out) > n:  # rounding can overshoot or undershoot by a few rows
        out = out.sample(n, random_state=seed)
    elif len(out) < n:
        out = pd.concat([out, df.drop(out.index).sample(n - len(out), random_state=seed)])
    return out


def to_sample(texts, category: str, platform: str, max_n: int = SAMPLE_SIZE,
              ratings=None, strata=None) -> pd.DataFrame:
    """Unified sample table. sample.attrs holds n_total / sampled / stratified for the UI."""
    df = clean_reviews(texts, ratings, strata)
    n_total = len(df)
    sampled = n_total > max_n
    if sampled:  # random, not the first N: exports are usually sorted by date
        df = stratified_sample(df, max_n)
    df = df.reset_index(drop=True)
    out = pd.DataFrame({
        "review_id": range(1, len(df) + 1), "dataset": "custom", "market": "custom",
        "platform": platform, "category": category, "group_id": category,
        "rating": df.rating.values, "human_label": pd.NA, "title": "", "text": df.text.values,
    })
    out.attrs = {"n_total": n_total, "sampled": sampled, "stratified": sampled and df.stratum.nunique() > 1}
    return out


def speed_for(client) -> tuple[float, int, int]:
    return SPEED[provider_kind(client)]


def estimate_minutes(n_reviews: int, kind: str) -> float:
    """Rough wall-clock time: limited by the rate cap or by ~10 s per call spread over the workers."""
    rpm, workers, batch = SPEED.get(kind, SPEED["default"])
    calls = -(-n_reviews // batch) + 2  # + taxonomy + brief
    return max(calls / rpm if rpm else 0, calls * 10 / 60 / max(workers, 1))


def run_custom(client, sample: pd.DataFrame, category: str, batch_size: int | None = None,
               rpm: float | None = None, workers: int | None = None, progress=None):
    """Returns (taxonomy, reviews, aspects, groups, error).

    If the run stops partway (quota used up, key revoked...), whatever was labeled is still
    returned and `error` says why it stopped. Only a run with no labels at all raises."""
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
    error = None
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "custom.jsonl"
        try:
            label_reviews.run(client, sample, "custom", batch_size, rpm, out_path=out,
                              taxonomies={category: tax}, workers=workers, progress=progress)
        except LLMError as e:
            error = str(e)
        labels = load_labels(out) if out.exists() else []
    if not labels:
        raise RuntimeError(error or "The model returned no usable labels. Try again or use fewer reviews.")
    missing = len(sample) - len({r["review_id"] for r in labels})
    if missing and not error:
        error = f"{missing} of {len(sample)} reviews could not be labeled because some requests failed. Try again for a full run."
    reviews, aspects, groups = build_tables("custom", sample, labels, taxonomies={category: tax})
    return tax, reviews, aspects, groups, error


def make_brief(client, reviews: pd.DataFrame, aspects: pd.DataFrame, tax: dict, lang: str = "en") -> dict:
    """One extra LLM call: the same ops brief the built-in examples get."""
    from generate_briefs import LANG_RULE, SYSTEM, clean_fix_first, payload
    system = SYSTEM.replace("Write in English; keep customer quotes in their\noriginal language.", LANG_RULE[lang])
    owners = sorted({a["owner"] for a in tax["aspects"]})
    gid = reviews.group_id.iloc[0]
    out = clean_fix_first(client.complete_json(system, payload(gid, reviews, aspects, owners)), aspects)
    out["model"] = getattr(client, "model", "")
    return out
