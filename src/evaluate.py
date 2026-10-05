"""How often does the AI agree with humans?

JD.com: every review has a human positive/negative label (from the dataset authors),
which the model never sees. We compare it with the AI's overall_sentiment.
Amazon: no human labels, so we use the star rating as a proxy (1-2 = negative,
4-5 = positive, 3 stars left out).

Outputs data/app/<dataset>/eval.json and eval_errors.csv (disagreements to read by hand).

Usage:
    python src/evaluate.py --dataset jd
"""
from __future__ import annotations

import argparse
import json

import pandas as pd

import config


def reference(reviews: pd.DataFrame) -> tuple[pd.Series, str]:
    if reviews.human_label.notna().any():
        return reviews.human_label, "human label (dataset authors)"
    ref = pd.Series(pd.NA, index=reviews.index, dtype="object")
    ref[reviews.rating <= 2] = "negative"
    ref[reviews.rating >= 4] = "positive"
    return ref, ("star rating proxy (1-2 = negative, 4-5 = positive, 3 excluded). "
                 "Not an independent test: the model can see the stars.")


def metrics(ref: pd.Series, ai: pd.Series) -> dict:
    m = ref.notna()
    ref, ai = ref[m], ai[m]
    decided = ai != "neutral"
    tp = int(((ai == "negative") & (ref == "negative")).sum())
    fp = int(((ai == "negative") & (ref == "positive")).sum())
    fn = int(((ai != "negative") & (ref == "negative")).sum())
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    return {
        "n": int(len(ref)),
        "accuracy": round(float((ai == ref).mean()), 4),  # neutral counts as wrong
        "accuracy_excl_neutral": round(float((ai[decided] == ref[decided]).mean()), 4) if decided.any() else None,
        "neutral_share": round(float((~decided).mean()), 4),
        "negative_precision": round(prec, 4),
        "negative_recall": round(rec, 4),
        "negative_f1": round(2 * prec * rec / (prec + rec), 4) if prec + rec else 0.0,
        "confusion": pd.crosstab(ref, ai).to_dict(),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, choices=list(config.DATASETS))
    args = ap.parse_args()

    out = config.app_dir(args.dataset)
    reviews = pd.read_csv(out / "reviews.csv")
    ref, ref_name = reference(reviews)
    result = {
        "dataset": args.dataset,
        "reference": ref_name,
        "overall": metrics(ref, reviews.overall_sentiment),
        "by_category": {
            cat: metrics(ref[g.index], g.overall_sentiment)
            for cat, g in reviews.groupby("category")
        } if reviews.category.nunique() > 1 else {},
        "models": reviews["model"].value_counts().to_dict() if "model" in reviews else {},
    }
    # Manual review of the direct contradictions (filled in by hand in evaluation/manual_check_<dataset>.csv)
    manual = config.ROOT / "evaluation" / f"manual_check_{args.dataset}.csv"
    if manual.exists():
        mc = pd.read_csv(manual, encoding="utf-8-sig")
        verdict = mc[mc.columns[-1]].fillna("").astype(str).str.strip()
        result["manual_review"] = {
            "reviewed": int(len(mc)),
            "ai_right": int((verdict == "AI对").sum()),
            "label_right": int((verdict == "人工对").sum()),
            "unclear": int((~verdict.isin(["AI对", "人工对"])).sum()),
        }
    (out / "eval.json").write_text(json.dumps(result, indent=2, ensure_ascii=False))

    errors = reviews[ref.notna() & (reviews.overall_sentiment != ref)].assign(reference=ref)
    errors[["review_id", "category", "reference", "overall_sentiment", "text"]].to_csv(out / "eval_errors.csv", index=False)

    o = result["overall"]
    print(f"[{args.dataset}] vs {ref_name}, n={o['n']}")
    print(f"Accuracy {o['accuracy']:.1%} (excluding neutral: {o['accuracy_excl_neutral']:.1%}, neutral {o['neutral_share']:.1%})")
    print(f"Negative reviews: precision {o['negative_precision']:.1%}, recall {o['negative_recall']:.1%}, F1 {o['negative_f1']:.1%}")
    for cat, m in result["by_category"].items():
        print(f"  {cat}: accuracy {m['accuracy']:.1%} (n={m['n']})")
    print(f"Disagreements saved for review: {len(errors)} -> eval_errors.csv")
    if "manual_review" in result:
        m = result["manual_review"]
        print(f"Manual review of direct contradictions: {m['reviewed']} read, AI right {m['ai_right']}, "
              f"dataset label right {m['label_right']}, unclear {m['unclear']}")


if __name__ == "__main__":
    main()
