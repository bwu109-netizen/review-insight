"""Turn raw LLM labels into the tables the dashboard reads.

Outputs (data/app/<dataset>/, small enough to commit):
    reviews.csv   one row per review, with AI labels
    aspects.csv   one row per (review, aspect) mention, with label + owner team
    groups.csv    one row per product (Amazon) or category (JD)

Usage:
    python src/analyze.py --dataset jd
    python src/analyze.py --dataset amazon_tea
"""
from __future__ import annotations

import argparse
import json

import pandas as pd

import config
from taxonomy import load_taxonomy


def load_labels(path) -> list[dict]:
    rows = {}
    with open(path) as f:
        for line in f:
            if line.strip():
                r = json.loads(line)
                rows[r["review_id"]] = r  # last label wins if a review was labeled twice
    return list(rows.values())


def aspect_lookup(dataset: str, categories, taxonomies: dict | None = None) -> pd.DataFrame:
    rows = []
    for cat in categories:
        tax = (taxonomies or {}).get(cat) or load_taxonomy(dataset, cat)
        for a in tax["aspects"]:
            rows.append({"category": cat, "aspect": a["key"], "aspect_label": a["label_en"],
                         "aspect_label_zh": a.get("label_zh", ""), "owner": a["owner"]})
    return pd.DataFrame(rows)


def build_tables(dataset: str, sample: pd.DataFrame, labels: list[dict], taxonomies: dict | None = None):
    lab = pd.DataFrame(labels)
    keep = ["review_id", "overall_sentiment", "repurchase", "root_cause"] + (["model"] if "model" in lab else [])
    reviews = sample.merge(lab[keep], on="review_id", how="inner")

    asp = [{"review_id": r["review_id"], **a} for r in labels for a in r.get("aspects", [])]
    aspects = pd.DataFrame(asp, columns=["review_id", "aspect", "sentiment", "evidence"])
    aspects = aspects.merge(reviews[["review_id", "group_id", "category", "rating"]], on="review_id", how="inner")
    aspects = aspects.merge(aspect_lookup(dataset, reviews.category.unique(), taxonomies), on=["category", "aspect"], how="left")

    neg = aspects[aspects.sentiment == "negative"].groupby("review_id").size()
    reviews["n_negative_aspects"] = reviews.review_id.map(neg).fillna(0).astype(int)
    satisfied = reviews.rating >= 4 if reviews.rating.notna().any() else reviews.overall_sentiment == "positive"
    # The interesting case: the customer is satisfied overall but still reports a concrete problem
    reviews["hidden_issue"] = satisfied & (reviews.n_negative_aspects > 0)
    reviews["ai_negative"] = reviews.overall_sentiment == "negative"
    if reviews.rating.notna().any():
        reviews["baseline_negative"] = reviews.rating <= 2  # 1-2 stars
    else:
        reviews["baseline_negative"] = reviews.human_label == "negative"

    def top_neg(gid):
        a = aspects[(aspects.group_id == gid) & (aspects.sentiment == "negative")]
        return a.aspect_label.value_counts().index[0] if len(a) else ""

    groups = reviews.groupby("group_id").agg(
        category=("category", "first"),
        reviews=("review_id", "size"),
        avg_rating=("rating", "mean"),
        ai_negative_share=("ai_negative", "mean"),
        hidden_issues=("hidden_issue", "sum"),
    ).reset_index()
    groups["top_negative_aspect"] = groups.group_id.map(top_neg)
    return reviews, aspects, groups


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, choices=list(config.DATASETS))
    args = ap.parse_args()

    sample = pd.read_csv(config.sample_file(args.dataset))
    labels = load_labels(config.labels_file(args.dataset))
    reviews, aspects, groups = build_tables(args.dataset, sample, labels)
    out = config.app_dir(args.dataset)
    reviews.to_csv(out / "reviews.csv", index=False)
    aspects.to_csv(out / "aspects.csv", index=False)
    groups.to_csv(out / "groups.csv", index=False)

    print(f"[{args.dataset}] labeled {len(reviews):,} / {len(sample):,}, aspect mentions {len(aspects):,}")
    print(f"AI negative: {reviews.ai_negative.mean():.1%} | baseline negative: {reviews.baseline_negative.mean():.1%}")
    print(f"Hidden issues: {int(reviews.hidden_issue.sum())}")
    print(aspects[aspects.sentiment == "negative"].groupby(["category", "aspect_label"]).size()
          .sort_values(ascending=False).head(15).to_string())


if __name__ == "__main__":
    main()
