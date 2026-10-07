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
You get AI-labeled review data for ONE product or ONE product category; "group_type" says which.
Use ONLY the numbers and quotes given; never invent facts. Write in English; keep customer quotes in their
original language.

Naming and scope:
- group_type "category": the reviews cover a whole category and may mix several products, varieties or
  brands. "name" is the category itself (the "category" field, translated if needed), e.g. "Fruit", never
  one product inside it such as "Apples". Do not describe the category as if it were a single product.
  When a problem or strength concerns only some products, say which ones (e.g. "apples arrive bruised").
- group_type "product": "name" is the product, inferred from the reviews. If an Amazon 'tea' product is
  not actually tea (e.g. a flavored water enhancer), say so.

Fix-first items:
- Each item is exactly ONE aspect from the "aspects" list; put its "key" in "aspect". Never merge two
  aspects or two different problems into one item, and never use the same aspect twice.
- "evidence" uses that aspect's own "negative_reviews" number and one quote from that aspect's
  "negative_quotes". Do not add up numbers across aspects.
- "owner" is that aspect's owner team.
- At most 3 items, most impactful first (more complaints, or a safety/health risk). Only aspects with
  negative_reviews > 0. If there are almost no complaints, return fewer.

Return JSON:
{"name": "short name, following the rules above",
 "summary": "2 sentences: what customers like and the main problem",
 "fix_first": [{"aspect": "aspect key", "issue": "the problem in a few words", "owner": "team", "evidence": "N negative reviews + one short quote", "action": "one concrete next step"}],
 "keep_doing": ["1-2 strengths worth protecting in listings/ads"]}"""


LANG_RULE = {
    "en": "Write in English; keep customer quotes in their original language.",
    "zh": "Write every field in Simplified Chinese (the name too); keep customer quotes in their original language. "
          "Use these team names for owner: 产品, 产品 / 采购, 供应链, 供应链 / 质检, 包装, 定价, 营销宣传, 物流, 商品页, 客服, 运营.",
}


def aspect_table(a: pd.DataFrame, counts: pd.DataFrame) -> list[dict]:
    """One entry per aspect: key, label, owner, review counts by sentiment, and quotes."""
    out = []
    for key, g in a.groupby("aspect"):
        c = counts.loc[key] if key in counts.index else {}
        out.append({
            "key": key,
            "label": str(g.aspect_label.dropna().iloc[0]) if g.aspect_label.notna().any() else key,
            "owner": str(g.owner.dropna().iloc[0]) if "owner" in g and g.owner.notna().any() else "",
            "negative_reviews": int(c.get("negative", 0)), "positive_reviews": int(c.get("positive", 0)),
            "neutral_reviews": int(c.get("neutral", 0)),
            "negative_quotes": g[g.sentiment == "negative"].evidence.dropna().head(6).tolist(),
            "positive_quotes": g[g.sentiment == "positive"].evidence.dropna().head(3).tolist(),
        })
    return sorted(out, key=lambda x: -x["negative_reviews"])


def clean_fix_first(brief: dict, aspects: pd.DataFrame) -> dict:
    """Keep fix-first items that name one real aspect with complaints, once each, and attach that
    aspect's true complaint count so the page never shows a number the model made up or summed."""
    neg = aspects[aspects.sentiment == "negative"].groupby("aspect").review_id.nunique()
    by_label = {}
    for col in ("aspect_label", "aspect_label_zh"):
        if col in aspects:
            by_label.update({str(l).strip().lower(): k for k, l in zip(aspects.aspect, aspects[col]) if isinstance(l, str)})
    kept, seen = [], set()
    for item in brief.get("fix_first") or []:
        key = str(item.get("aspect", "")).strip()
        key = key if key in neg.index else by_label.get(key.lower(), "")
        if not key or key in seen or key not in neg.index:
            continue
        seen.add(key)
        kept.append(dict(item, aspect=key, negative_reviews=int(neg[key])))
    brief["fix_first"] = kept[:3]
    return brief


def payload(gid, reviews: pd.DataFrame, aspects: pd.DataFrame, owners: list[str]) -> str:
    r = reviews[reviews.group_id == gid]
    a = aspects[aspects.group_id == gid]
    # counts are reviews, not mentions, so they match what the web page shows for each aspect
    counts = (
        a.groupby(["aspect", "sentiment"]).review_id.nunique().unstack(fill_value=0)
        .reindex(columns=["positive", "neutral", "negative"], fill_value=0)
    )
    # A random spread of snippets: exports and samples are often sorted, and the first rows can all be
    # one product, which made the brief describe a whole category as that product.
    picks = r.sample(min(12, len(r)), random_state=0)
    data = {
        "group_type": "category" if str(gid) == str(r.category.iloc[0]) else "product",
        "category": str(r.category.iloc[0]),
        "reviews_analyzed": len(r),
        "avg_star_rating": round(r.rating.mean(), 2) if r.rating.notna().any() else None,
        "ai_negative_share": round(r.ai_negative.mean(), 3),
        "hidden_issues_in_satisfied_reviews": int(r.hidden_issue.sum()),
        "sample_titles_or_snippets": (picks.title.fillna("") + " " + picks.text.astype(str).str[:60]).str.strip().tolist(),
        "aspects": aspect_table(a, counts),
        "root_causes": r.root_cause.dropna().sample(frac=1, random_state=0).head(10).tolist(),
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
        res = clean_fix_first(res, aspects[aspects.group_id == gid])
        res["model"] = getattr(client, "model", "")
        briefs[gid] = res
        out.write_text(json.dumps(briefs, indent=2, ensure_ascii=False))
        print(f"{gid}: {res.get('name', '?')}")
        time.sleep(60 / config.REQUESTS_PER_MINUTE)
    print(f"Done: {len(briefs)} briefs -> {out}")


if __name__ == "__main__":
    main()
