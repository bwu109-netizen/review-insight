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

MAX_REVIEWS = 100


def detect_language(texts: pd.Series) -> str:
    joined = "".join(texts.astype(str).head(20))
    return "zh" if len(re.findall(r"[一-鿿]", joined)) > len(joined) * 0.2 else "en"


def to_sample(texts: list[str], category: str, platform: str) -> pd.DataFrame:
    texts = [t.strip() for t in texts if isinstance(t, str) and len(t.strip()) >= 2][:MAX_REVIEWS]
    return pd.DataFrame({
        "review_id": range(1, len(texts) + 1), "dataset": "custom", "market": "custom",
        "platform": platform, "category": category, "group_id": category,
        "rating": pd.NA, "human_label": pd.NA, "title": "", "text": texts,
    })


def run_custom(client, sample: pd.DataFrame, category: str, batch_size: int = 20, rpm: float = 14):
    """Returns (taxonomy, reviews, aspects, groups)."""
    if category.strip().lower() in ("tea", "茶", "茶叶"):
        tax = dict(TEA_TAXONOMY, category=category)
    else:
        user = json.dumps({"category": category, "reviews": sample.text.str[:300].head(40).tolist()},
                          ensure_ascii=False)
        tax = clean(client.complete_json(TAXONOMY_SYSTEM, user), category)

    config.DATASETS["custom"] = {"language": detect_language(sample.text)}
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "custom.jsonl"
        label_reviews.run(client, sample, "custom", batch_size, rpm, out_path=out, taxonomies={category: tax})
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
