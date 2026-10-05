"""For each product (Amazon) or category (JD), ask the LLM for a short operations brief,
grounded ONLY in the aggregated labels (counts + real evidence quotes).

Saved to data/app/<dataset>/briefs.json so the live demo needs no API key.
Already-done groups are skipped on re-run.

Usage:
    python src/generate_briefs.py --dataset jd
    python src/generate_briefs.py --dataset amazon_tea --force
    python src/generate_briefs.py --dataset jd --lang zh     # Chinese version for the 中文 UI
"""
from __future__ import annotations

import argparse
import json
import time

import pandas as pd

import config
from llm_client import LLMError, get_client
from taxonomy import load_taxonomy

SYSTEM = """You are a senior e-commerce operations analyst writing for a weekly ops meeting.
You get AI-labeled review data for ONE product or product category. Use ONLY the numbers
and quotes given; never invent facts. Write in English; keep customer quotes in their
original language.

Return JSON:
{"name": "short descriptive English name of the product/category, inferred from the reviews. If an Amazon 'tea' product is not actually tea (e.g. a flavored water enhancer), say so.",
 "summary": "2 sentences: what customers like and the main problem",
 "fix_first": [{"issue": "...", "owner": "team from the owner list", "evidence": "how many negative mentions + one short quote", "action": "one concrete next step"}],
 "keep_doing": ["1-2 strengths worth protecting in listings/ads"]}
fix_first: at most 3 items, most impactful first. If there are almost no complaints, return fewer."""


LANG_RULE = {
    "en": "Write in English; keep customer quotes in their original language.",
    "zh": "Write every field in Simplified Chinese (the name too); keep customer quotes in their original language. "
          "Use these team names for owner: 产品, 产品 / 采购, 供应链, 供应链 / 质检, 包装, 定价, 营销宣传, 物流, 商品页, 客服, 运营.",
}


def payload(gid, reviews: pd.DataFrame, aspects: pd.DataFrame, owners: list[str]) -> str:
    r = reviews[reviews.group_id == gid]
    a = aspects[aspects.group_id == gid]
    counts = (
        a.groupby(["aspect_label", "sentiment"]).size().unstack(fill_value=0)
        .reindex(columns=["positive", "neutral", "negative"], fill_value=0)
    )
    neg = a[a.sentiment == "negative"]
    data = {
        "category": str(r.category.iloc[0]),
        "reviews_analyzed": len(r),
        "avg_star_rating": round(r.rating.mean(), 2) if r.rating.notna().any() else None,
        "ai_negative_share": round(r.ai_negative.mean(), 3),
        "hidden_issues_in_satisfied_reviews": int(r.hidden_issue.sum()),
        "sample_titles_or_snippets": (r.title.fillna("") + " " + r.text.astype(str).str[:60]).str.strip().head(12).tolist(),
        "aspect_counts": counts.to_dict(orient="index"),
        "negative_quotes_by_aspect": {k: g.evidence.dropna().head(6).tolist() for k, g in neg.groupby("aspect_label")},
        "positive_quotes_by_aspect": a[a.sentiment == "positive"].groupby("aspect_label").evidence
        .apply(lambda s: s.head(3).tolist()).to_dict(),
        "root_causes": r.root_cause.dropna().head(10).tolist(),
        "owner_list": owners,
    }
    return json.dumps(data, ensure_ascii=False, default=str)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, choices=list(config.DATASETS))
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--provider", default=None)
    ap.add_argument("--lang", default="en", choices=["en", "zh"])
    args = ap.parse_args()

    d = config.app_dir(args.dataset)
    reviews = pd.read_csv(d / "reviews.csv")
    aspects = pd.read_csv(d / "aspects.csv")
    out = d / ("briefs.json" if args.lang == "en" else f"briefs_{args.lang}.json")
    system = SYSTEM.replace("Write in English; keep customer quotes in their\noriginal language.", LANG_RULE[args.lang])
    briefs = {} if args.force or not out.exists() else json.loads(out.read_text())
    client = get_client(args.provider)

    for gid in reviews.group_id.value_counts().index:
        if gid in briefs:
            continue
        cat = reviews.loc[reviews.group_id == gid, "category"].iloc[0]
        owners = sorted({x["owner"] for x in load_taxonomy(args.dataset, cat)["aspects"]})
        try:
            res = client.complete_json(system, payload(gid, reviews, aspects, owners))
        except LLMError as e:
            print(f"{gid}: failed ({e})")
            continue
        res["model"] = getattr(client, "model", "")
        briefs[gid] = res
        out.write_text(json.dumps(briefs, indent=2, ensure_ascii=False))
        print(f"{gid}: {res.get('name', '?')}")
        time.sleep(60 / config.REQUESTS_PER_MINUTE)
    print(f"Done: {len(briefs)} briefs -> {out}")


if __name__ == "__main__":
    main()
