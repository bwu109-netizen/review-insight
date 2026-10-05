"""Load customer reviews, clean them, and hand them out in batches for labeling.

Usage:
  python prepare.py INPUT --workdir ri_work [--column NAME] [--rating-column NAME] [--max 300]
  python prepare.py --workdir ri_work --next 25      # print the next unlabeled batch

INPUT can be .csv / .xlsx / .xls / .json / .jsonl, or .txt with one review per line.
Writes:  ri_work/reviews.csv           review_id, text[, rating]
         ri_work/taxonomy_sample.txt   up to 60 random reviews, for choosing aspects
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import pandas as pd

TEXT_HINTS = ["评价内容", "评论内容", "评价", "评论", "内容", "review", "text", "comment", "content", "body"]
RATING_HINTS = ["评分", "星级", "打分", "rating", "score", "stars", "star"]
# Text that platforms fill in when the buyer wrote nothing. Not real feedback.
DEFAULT_TEXTS = ["此用户没有填写评价", "系统默认好评", "用户未及时评价", "未填写评价内容", "该用户觉得商品",
                 "此用户未填写", "default review", "no review text"]


def read_any(path: Path) -> pd.DataFrame:
    suf = path.suffix.lower()
    if suf in (".xlsx", ".xls"):
        return pd.read_excel(path)
    if suf == ".csv":
        for enc in ("utf-8-sig", "gb18030"):  # Chinese seller back-ends often export GBK
            try:
                return pd.read_csv(path, encoding=enc)
            except UnicodeDecodeError:
                continue
        sys.exit("Could not read the CSV as UTF-8 or GBK.")
    if suf == ".jsonl":
        return pd.read_json(path, lines=True)
    if suf == ".json":
        return pd.read_json(path)
    lines = [ln.strip() for ln in path.read_text(encoding="utf-8", errors="ignore").splitlines() if ln.strip()]
    return pd.DataFrame({"text": lines})


def matching(df: pd.DataFrame, hints: list[str]) -> list:
    return [c for c in df.columns if any(h in str(c).strip().lower() for h in hints)]


def pick_text(df: pd.DataFrame, given: str | None):
    if given:
        if given not in df.columns:
            sys.exit(f"Column '{given}' not found. Columns: {list(df.columns)}")
        return given
    cands = matching(df, TEXT_HINTS) or [c for c in df.columns if df[c].dtype == object]
    if not cands:
        sys.exit(f"No text column found. Pass --column. Columns: {list(df.columns)}")
    return max(cands, key=lambda c: df[c].astype(str).str.len().mean())  # reviews are the longest field


def pick_rating(df: pd.DataFrame, given: str | None):
    if given:
        return given if given in df.columns else None
    for c in matching(df, RATING_HINTS):
        vals = pd.to_numeric(df[c], errors="coerce")
        if vals.notna().mean() > 0.8 and vals.between(0, 5).mean() > 0.8:
            return c
    return None


def language(texts: pd.Series) -> str:
    joined = "".join(texts.astype(str).head(50))
    return "zh" if len(re.findall(r"[一-鿿]", joined)) > len(joined) * 0.2 else "en"


def prepare(args) -> None:
    work = Path(args.workdir)
    work.mkdir(parents=True, exist_ok=True)
    df = read_any(Path(args.input))
    tcol, rcol = pick_text(df, args.column), pick_rating(df, args.rating_column)
    out = pd.DataFrame({"text": df[tcol].astype("string").fillna("").str.strip()})
    if rcol:
        out["rating"] = pd.to_numeric(df[rcol], errors="coerce")
    n_raw = len(out)

    is_default = out.text.str.lower().apply(lambda t: any(d.lower() in t for d in DEFAULT_TEXTS) and len(t) < 40)
    short = out.text.str.len() < 4
    out = out[~is_default & ~short]
    n_after_filter = len(out)
    out = out.drop_duplicates("text")
    n_unique = len(out)

    sampled = len(out) > args.max
    if sampled:  # random, not the first rows: exports are usually sorted by date
        out = out.sample(args.max, random_state=0)
    out = out.reset_index(drop=True)
    out.insert(0, "review_id", range(1, len(out) + 1))
    out.to_csv(work / "reviews.csv", index=False, encoding="utf-8")

    pick = out.sample(min(60, len(out)), random_state=1)
    (work / "taxonomy_sample.txt").write_text(
        "\n".join(f"- {t[:200]}" for t in pick.text), encoding="utf-8")
    labels = work / "labels.jsonl"
    if labels.exists() and not args.keep_labels:
        labels.rename(work / "labels.old.jsonl")

    print(json.dumps({
        "text_column": str(tcol), "rating_column": str(rcol) if rcol else None,
        "rows_in_file": n_raw, "removed_default_or_too_short": n_raw - n_after_filter,
        "removed_duplicates": n_after_filter - n_unique, "unique_reviews": n_unique,
        "randomly_sampled": sampled, "reviews_to_label": len(out), "language": language(out.text),
    }, ensure_ascii=False, indent=1))


def labeled_ids(work: Path) -> set[int]:
    ids = set()
    p = work / "labels.jsonl"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            try:
                ids.add(int(json.loads(line)["review_id"]))
            except (ValueError, KeyError, TypeError):
                pass
    return ids


def show_next(args) -> None:
    work = Path(args.workdir)
    reviews = pd.read_csv(work / "reviews.csv")
    done = labeled_ids(work)
    todo = reviews[~reviews.review_id.isin(done)]
    print(f"# labeled {len(reviews) - len(todo)}/{len(reviews)}; showing {min(args.next, len(todo))}")
    if todo.empty:
        print("# ALL DONE. Run summarize.py next.")
        return
    for _, r in todo.head(args.next).iterrows():
        item = {"review_id": int(r.review_id), "text": str(r.text)[:600]}
        if "rating" in r and pd.notna(r.get("rating")):
            item["rating"] = float(r.rating)
        print(json.dumps(item, ensure_ascii=False))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", nargs="?")
    ap.add_argument("--workdir", default="ri_work")
    ap.add_argument("--column")
    ap.add_argument("--rating-column")
    ap.add_argument("--max", type=int, default=300)
    ap.add_argument("--keep-labels", action="store_true", help="don't move an existing labels.jsonl aside")
    ap.add_argument("--next", type=int, help="print the next N unlabeled reviews")
    args = ap.parse_args()
    if args.next:
        show_next(args)
    elif args.input:
        prepare(args)
    else:
        ap.error("give an INPUT file, or --next N")


if __name__ == "__main__":
    main()
