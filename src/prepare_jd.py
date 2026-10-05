"""Prepare the Chinese JD.com review sample (online_shopping_10_cats).

62k JD.com reviews in 10 categories, each with a human label (1 = positive, 0 = negative).
We keep the 6 physical-product categories, drop very short or duplicate reviews,
and sample an equal number of positive and negative reviews per category.
The human label is kept ONLY for evaluation; it is never shown to the LLM.

Usage:
    python src/prepare_jd.py                 # 150 reviews per category
    python src/prepare_jd.py --per-category 300
"""
from __future__ import annotations

import argparse
import re
import zipfile

import pandas as pd
import requests

import config

# Chinese name -> English label used in the dashboard
CATEGORIES = {
    "计算机": "Laptops",
    "平板": "Tablets",
    "手机": "Phones",
    "水果": "Fruit",
    "衣服": "Clothing",
    "洗发水": "Shampoo",
}
# Left out: 酒店 (hotels, not a product), 书籍 (books), 蒙牛 (mostly brand-scandal comments,
# not product reviews), 热水器 (only 575 reviews, 83% positive).


def download(dest=config.JD_RAW) -> None:
    if dest.exists() and dest.stat().st_size > 1_000_000:
        print(f"Already downloaded: {dest.name}")
        return
    print("Downloading online_shopping_10_cats (4 MB)...")
    r = requests.get(config.JD_URL, timeout=120)
    r.raise_for_status()
    dest.write_bytes(r.content)


def load_raw(path=config.JD_RAW) -> pd.DataFrame:
    with zipfile.ZipFile(path) as z:
        df = pd.read_csv(z.open("online_shopping_10_cats.csv"))
    df["review"] = df["review"].fillna("").astype(str).str.replace("﻿", "", regex=False).map(
        lambda s: re.sub(r"\s+", " ", s).strip()
    )
    return df


def build_sample(df: pd.DataFrame, per_category: int, seed: int = 42) -> pd.DataFrame:
    df = df[df["cat"].isin(CATEGORIES)]
    df = df[df["review"].str.len() >= 8]  # "好评!" alone has nothing to analyze
    df = df.drop_duplicates(subset=["cat", "review"])
    parts = []
    for cat in CATEGORIES:
        g = df[df["cat"] == cat]
        for label in (0, 1):
            pool = g[g["label"] == label]
            parts.append(pool.sample(min(len(pool), per_category // 2), random_state=seed))
    s = pd.concat(parts).sample(frac=1, random_state=seed).reset_index()
    out = pd.DataFrame({
        "review_id": s["index"].astype(int) + 1,  # stable id = row number in the original file
        "dataset": "jd",
        "market": "domestic",
        "platform": "JD.com",
        "category": s["cat"],
        "group_id": s["cat"],
        "rating": pd.NA,
        "human_label": s["label"].map({1: "positive", 0: "negative"}),
        "title": "",
        "text": s["review"],
    })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-category", type=int, default=150)
    args = ap.parse_args()
    download()
    df = load_raw()
    print(f"All reviews: {len(df):,} in {df['cat'].nunique()} categories")
    sample = build_sample(df, args.per_category)
    sample.to_csv(config.sample_file("jd"), index=False)
    print(f"Sample: {len(sample):,} reviews -> {config.sample_file('jd').name}")
    print(sample.groupby(["category", "human_label"]).size().unstack().to_string())


if __name__ == "__main__":
    main()
