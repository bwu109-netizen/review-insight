"""Check the labels, then build the tables, chart and summary used for the ops brief.

Usage:
  python summarize.py --workdir ri_work [--lang en|zh]

Reads    reviews.csv, taxonomy.json, labels.jsonl  (if a review_id appears twice, the last line wins,
         so a fix can simply be appended)
Writes   labeled_reviews.csv, aspects_summary.csv, hidden_issues.csv, summary.json, chart.png
Prints   a CHECK report. If it lists problems, fix those reviews (append corrected lines) and re-run.
"""
from __future__ import annotations

import argparse
import json
import re
import textwrap
from collections import Counter
from pathlib import Path

import pandas as pd

SENTIMENTS = ("positive", "neutral", "negative")
REPURCHASE = ("yes", "no", "unclear")


def norm(s: str) -> str:
    return re.sub(r"[\s　，。！？、,.!?~…“”\"'：:；;（）()]+", "", str(s)).lower()


def load_labels(path: Path, taxonomy_keys: set[str], review_text: dict[int, str]):
    rows, problems = {}, []
    if not path.exists():
        return rows, ["labels.jsonl not found"]
    latest = {}  # a corrected line appended later replaces the earlier one
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            raw = json.loads(line)
            rid = int(raw["review_id"])
        except (ValueError, KeyError, TypeError):
            problems.append(f"line {n}: not valid JSON with a review_id")
            continue
        if rid not in review_text:
            problems.append(f"line {n}: review_id {rid} is not in reviews.csv")
            continue
        latest[rid] = raw
    for rid, raw in latest.items():
        overall = str(raw.get("overall_sentiment", "")).lower()
        if overall not in SENTIMENTS:
            problems.append(f"review {rid}: overall_sentiment '{overall}' is not positive/neutral/negative")
            continue
        aspects, text = [], norm(review_text[rid])
        for a in raw.get("aspects") or []:
            key, sent = str(a.get("aspect", "")), str(a.get("sentiment", "")).lower()
            if key not in taxonomy_keys:
                problems.append(f"review {rid}: unknown aspect '{key}' (dropped)")
                continue
            if sent not in SENTIMENTS:
                problems.append(f"review {rid}: aspect '{key}' has sentiment '{sent}' (dropped)")
                continue
            ev = str(a.get("evidence") or "")
            if ev and norm(ev) not in text:
                problems.append(f"review {rid}: evidence for '{key}' is not an exact quote: {ev[:40]}")
            aspects.append({"aspect": key, "sentiment": sent, "evidence": ev})
        rep = str(raw.get("repurchase", "unclear")).lower()
        rows[rid] = {
            "review_id": rid, "overall_sentiment": overall, "aspects": aspects,
            "root_cause": raw.get("root_cause") or None,
            "repurchase": rep if rep in REPURCHASE else "unclear",
        }
    missing = sorted(set(review_text) - set(rows))
    if missing:
        problems.insert(0, f"{len(missing)} reviews not labeled yet: {missing[:40]}{' ...' if len(missing) > 40 else ''}")
    return rows, problems


def cjk_font() -> str | None:
    from matplotlib import font_manager as fm
    names = ("Noto Sans CJK", "Noto Serif CJK", "Source Han", "WenQuanYi", "PingFang", "Heiti", "SimHei",
             "Microsoft YaHei", "Hiragino Sans GB", "Arial Unicode", "Droid Sans Fallback")
    available = {f.name for f in fm.fontManager.ttflist}
    for k in names:  # in order of preference
        for name in sorted(available):
            if k in name:
                return name
    return None


def chart(summary: pd.DataFrame, path: Path, lang: str, title: str) -> None:
    import logging

    import matplotlib
    matplotlib.use("Agg")
    logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)
    import matplotlib.pyplot as plt

    font = cjk_font()
    if font:
        plt.rcParams["font.sans-serif"] = [font, "DejaVu Sans"]
        plt.rcParams["axes.unicode_minus"] = False
    use_zh = lang == "zh" and font is not None
    df = summary.sort_values("negative")
    labels = [(r.label_zh or r.label_en) if use_zh else r.label_en for r in df.itertuples()]
    fig, ax = plt.subplots(figsize=(8, 0.45 * len(df) + 1.4))
    ax.barh(labels, -df.negative, color="#d9534f", label="投诉 complaints" if use_zh else "complaints")
    ax.barh(labels, df.positive, color="#5cb85c", label="好评 praise" if use_zh else "praise")
    for y, (neg, pos) in enumerate(zip(df.negative, df.positive)):
        if neg:
            ax.text(-neg, y, f"{neg} ", va="center", ha="right", fontsize=9)
        if pos:
            ax.text(pos, y, f" {pos}", va="center", ha="left", fontsize=9)
    lim = max(df.negative.max(), df.positive.max(), 1) * 1.25
    ax.set_xlim(-lim, lim)
    ax.axvline(0, color="#555", lw=0.8)
    ax.set_xticks([])
    for side in ("top", "right", "bottom"):
        ax.spines[side].set_visible(False)
    ax.legend(loc="lower right", frameon=False, fontsize=9)
    ax.set_title(textwrap.fill(title, 48 if use_zh else 70), fontsize=11, loc="left")
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workdir", default="ri_work")
    ap.add_argument("--lang", default="en", choices=["en", "zh"])
    args = ap.parse_args()
    work = Path(args.workdir)

    reviews = pd.read_csv(work / "reviews.csv")
    tax = json.loads((work / "taxonomy.json").read_text(encoding="utf-8"))
    meta = {a["key"]: a for a in tax["aspects"]}
    rows, problems = load_labels(work / "labels.jsonl", set(meta), dict(zip(reviews.review_id, reviews.text)))

    print(f"CHECK: {'OK' if not problems else f'{len(problems)} problem(s)'}")
    for p in problems[:60]:
        print("  -", p)
    if not rows:
        return

    lab = pd.DataFrame([{k: v for k, v in r.items() if k != "aspects"} for r in rows.values()])
    R = reviews.merge(lab, on="review_id", how="inner")
    A = pd.DataFrame([{"review_id": r["review_id"], **a} for r in rows.values() for a in r["aspects"]],
                     columns=["review_id", "aspect", "sentiment", "evidence"])
    has_rating = "rating" in R and R.rating.notna().any()
    neg_per_review = A[A.sentiment == "negative"].groupby("review_id").size()
    R["n_negative_aspects"] = R.review_id.map(neg_per_review).fillna(0).astype(int)
    satisfied = R.rating >= 4 if has_rating else R.overall_sentiment == "positive"
    R["hidden_issue"] = satisfied & (R.n_negative_aspects > 0)  # happy overall, still reports a problem
    tags = A.groupby("review_id").apply(lambda g: "; ".join(f"{a}:{s}" for a, s in zip(g.aspect, g.sentiment)))
    R["aspects"] = R.review_id.map(tags).fillna("")

    counts = A.pivot_table(index="aspect", columns="sentiment", values="review_id", aggfunc="nunique", fill_value=0)  # reviews, not mentions
    counts = counts.reindex(index=list(meta), columns=list(SENTIMENTS), fill_value=0)
    S = pd.DataFrame({
        "aspect": list(meta),
        "label_en": [meta[k].get("label_en", k) for k in meta],
        "label_zh": [meta[k].get("label_zh", "") for k in meta],
        "owner": [meta[k].get("owner", "") for k in meta],
        "positive": counts.positive.values, "neutral": counts.neutral.values, "negative": counts.negative.values,
    })
    S["mentions"] = S.positive + S.neutral + S.negative
    S["complaint_share_of_reviews"] = (S.negative / max(len(R), 1)).round(3)

    def quotes(key, sent, k):
        return [e for e in A[(A.aspect == key) & (A.sentiment == sent)].evidence if e][:k]

    S["example_complaints"] = [" | ".join(quotes(k, "negative", 3)) for k in S.aspect]
    S["example_praise"] = [" | ".join(quotes(k, "positive", 2)) for k in S.aspect]
    S = S.sort_values(["negative", "mentions"], ascending=False)

    R.to_csv(work / "labeled_reviews.csv", index=False, encoding="utf-8-sig")
    S.to_csv(work / "aspects_summary.csv", index=False, encoding="utf-8-sig")
    hid = R[R.hidden_issue].merge(A[A.sentiment == "negative"], on="review_id")
    hid[["review_id", "aspect", "evidence", "text"] + (["rating"] if has_rating else [])].to_csv(
        work / "hidden_issues.csv", index=False, encoding="utf-8-sig")

    overall = R.overall_sentiment.value_counts().reindex(SENTIMENTS, fill_value=0)
    label_col = "label_zh" if args.lang == "zh" else "label_en"
    summary = {
        "category": tax.get("category"),
        "reviews_analyzed": len(R),
        "avg_star_rating": round(float(R.rating.mean()), 2) if has_rating else None,
        "overall_sentiment": overall.to_dict(),
        "negative_share": round(overall["negative"] / max(len(R), 1), 3),
        "hidden_issues_in_satisfied_reviews": int(R.hidden_issue.sum()),
        "repurchase": R.repurchase.value_counts().to_dict(),
        "aspects_ranked_by_complaints": [
            {"aspect": r.aspect, "label": getattr(r, label_col) or r.label_en, "owner": r.owner,
             "complaints": int(r.negative), "praise": int(r.positive), "neutral": int(r.neutral),
             "complaint_quotes": quotes(r.aspect, "negative", 6), "praise_quotes": quotes(r.aspect, "positive", 3)}
            for r in S.itertuples()],
        "common_root_causes": [c for c, _ in Counter(R.root_cause.dropna().astype(str)).most_common(12)],
        "owner_teams": sorted({a.get("owner", "") for a in tax["aspects"]}),
    }
    (work / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1, default=int),
                                       encoding="utf-8")
    title = (f"{tax.get('category')}：{len(R)} 条评论，各维度投诉 vs 好评" if args.lang == "zh"
             else f"{tax.get('category')}: complaints vs praise by aspect ({len(R)} reviews)")
    chart(S, work / "chart.png", args.lang, title)

    print(f"reviews: {len(R)} | negative {summary['negative_share']:.0%} | hidden issues "
          f"{summary['hidden_issues_in_satisfied_reviews']}")
    print("top complaints:", ", ".join(f"{r.aspect} {r.negative}" for r in S.head(5).itertuples()))
    print(f"wrote labeled_reviews.csv, aspects_summary.csv, hidden_issues.csv, summary.json, chart.png in {work}/")


if __name__ == "__main__":
    main()
