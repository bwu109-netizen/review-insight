"""Let the LLM decide what is worth tracking for a product category.

For each category in a dataset sample, the LLM reads ~40 real reviews and proposes
6-10 aspects (e.g. laptops: performance, heat, screen, after-sales), each with the
team that would own the fix. Saved to data/taxonomies/ so it can be reviewed and
edited by hand before labeling.

Usage:
    python src/generate_taxonomy.py --dataset jd
    python src/generate_taxonomy.py --dataset jd --force     # regenerate
"""
from __future__ import annotations

import argparse
import json
import re
import time

import pandas as pd

import config
from llm_client import LLMError, get_client
from taxonomy import save_taxonomy, taxonomy_path

SYSTEM = """You design review-analysis schemes for e-commerce operations teams.
Given a product category and real customer reviews, list the 6-10 aspects customers
actually talk about that a business could act on. Cover the product itself AND the
purchase experience (price, delivery, after-sales, authenticity, listing accuracy)
when reviews mention them. Merge near-duplicates. Each aspect needs an owner team.

Return JSON:
{"category": "<English name>",
 "aspects": [{"key": "snake_case_english", "label_en": "Short English label",
              "label_zh": "简短中文标签", "description": "what counts, in English",
              "owner": "team, e.g. Product / Supply chain / Logistics / Customer service / Pricing / Listing"}]}"""

OWNER_FALLBACK = "Product"


def clean(tax: dict, category: str) -> dict:
    """Normalize keys and drop malformed aspects."""
    aspects, seen = [], set()
    for a in tax.get("aspects", []):
        key = re.sub(r"[^a-z0-9_]", "_", str(a.get("key", "")).lower()).strip("_")
        if not key or key in seen:
            continue
        seen.add(key)
        aspects.append({
            "key": key,
            "label_en": str(a.get("label_en") or key.replace("_", " ").title()),
            "label_zh": str(a.get("label_zh") or ""),
            "description": str(a.get("description") or ""),
            "owner": str(a.get("owner") or OWNER_FALLBACK),
        })
    if len(aspects) < 3:
        raise LLMError(f"Taxonomy for {category} has too few aspects: {aspects}")
    return {"category": str(tax.get("category") or category), "source": "llm-generated",
            "category_original": category, "aspects": aspects[:10]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, choices=list(config.DATASETS))
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--provider", default=None)
    ap.add_argument("--n", type=int, default=40, help="reviews shown to the LLM per category")
    args = ap.parse_args()

    sample = pd.read_csv(config.sample_file(args.dataset))
    client = get_client(args.provider)
    for cat in sample.category.unique():
        if str(cat).lower() == "tea":
            print("Tea: using the hand-written taxonomy")
            continue
        if taxonomy_path(args.dataset, cat).exists() and not args.force:
            print(f"{cat}: exists, skipped")
            continue
        texts = sample[sample.category == cat].text.astype(str).str[:300].head(args.n).tolist()
        user = json.dumps({"category": cat, "reviews": texts}, ensure_ascii=False)
        try:
            tax = clean(client.complete_json(SYSTEM, user), cat)
        except LLMError as e:
            print(f"{cat}: failed ({e})")
            continue
        tax["model"] = getattr(client, "model", "")
        save_taxonomy(args.dataset, cat, tax)
        print(f"{cat} -> {tax['category']}: " + ", ".join(a["label_en"] for a in tax["aspects"]))
        time.sleep(60 / config.REQUESTS_PER_MINUTE)


if __name__ == "__main__":
    main()
