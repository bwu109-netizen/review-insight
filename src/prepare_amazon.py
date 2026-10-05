"""Prepare the overseas sample: Amazon Fine Food Reviews, tea products only.

Usage:
    python src/prepare_amazon.py                # download (once) + filter + sample
    python src/prepare_amazon.py --per-product 100 --products 15
"""
import argparse
import html
import re

import pandas as pd
import requests
from tqdm import tqdm

import config
from config import AMAZON_RAW as RAW_FILE, AMAZON_URL as DATASET_URL, TEA_REVIEWS_FILE

TEA_RE = re.compile(r"\b(?:tea|teas|chai|matcha|oolong|rooibos|earl grey|chamomile|herbal infusion)\b")
NOT_TEA_RE = re.compile(r"\b(?:coffee|espresso|k-?cup|cocoa|hot chocolate)\b")


def download(url: str = DATASET_URL, dest=RAW_FILE) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        print(f"Already downloaded: {dest.name}")
        return
    print("Downloading Amazon Fine Food Reviews (one time, a few hundred MB)...")
    with requests.get(url, stream=True, timeout=60, allow_redirects=True) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        tmp = dest.with_suffix(".part")
        with open(tmp, "wb") as f, tqdm(total=total, unit="B", unit_scale=True) as bar:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
                bar.update(len(chunk))
        tmp.rename(dest)


def clean_text(s: str) -> str:
    s = html.unescape(str(s))
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def filter_tea(df: pd.DataFrame, min_reviews: int = 40, min_tea_share: float = 0.6) -> pd.DataFrame:
    df = df.copy()
    df["Summary"] = df["Summary"].fillna("").map(clean_text)
    df["Text"] = df["Text"].fillna("").map(clean_text)
    # Same review is often copied across product variants: keep one copy
    df = df.drop_duplicates(subset=["UserId", "Time", "Text"])

    blob = (df["Summary"] + " " + df["Text"]).str.lower()
    df["mentions_tea"] = blob.str.contains(TEA_RE)
    df["mentions_other"] = blob.str.contains(NOT_TEA_RE)

    stats = df.groupby("ProductId").agg(
        n_reviews=("Id", "size"),
        tea_share=("mentions_tea", "mean"),
        other_share=("mentions_other", "mean"),
    )
    tea_products = stats[
        (stats.n_reviews >= min_reviews)
        & (stats.tea_share >= min_tea_share)
        & (stats.other_share < 0.3)
    ].index
    out = df[df.ProductId.isin(tea_products)].drop(columns=["mentions_tea", "mentions_other"])
    out["date"] = pd.to_datetime(out["Time"], unit="s").dt.date
    out = out.rename(columns={"Id": "review_id", "ProductId": "product_id", "Score": "rating"})
    return out.reset_index(drop=True)


def make_sample(tea: pd.DataFrame, n_products: int, per_product: int, seed: int = 42) -> pd.DataFrame:
    """Top products by review count; within each, sample evenly across star ratings
    so the AI sees enough negative reviews (most Amazon reviews are 5 stars)."""
    top = tea.product_id.value_counts().head(n_products).index
    parts = []
    for pid in top:
        g = tea[tea.product_id == pid]
        per_star = max(1, per_product // 5)
        shuffled = g.sample(frac=1, random_state=seed)
        picked = shuffled[shuffled.groupby("rating").cumcount() < per_star]
        if len(picked) < per_product:  # top up with remaining reviews
            rest = g.drop(picked.index)
            picked = pd.concat([picked, rest.sample(min(len(rest), per_product - len(picked)), random_state=seed)])
        parts.append(picked)
    # shuffle so that a quick test (--limit 20) already sees a mix of products and ratings
    sample = pd.concat(parts).sample(frac=1, random_state=seed)
    return to_unified(sample.rename(columns={"Summary": "title", "Text": "text"}))


def to_unified(s: pd.DataFrame) -> pd.DataFrame:
    """Map to the shared sample schema (see config.DATASETS)."""
    return pd.DataFrame({
        "review_id": s["review_id"].astype(int),
        "dataset": "amazon_tea",
        "market": "overseas",
        "platform": "Amazon US",
        "category": "Tea",
        "group_id": s["product_id"],
        "rating": s["rating"].astype(int),
        "human_label": pd.NA,  # no human sentiment labels; star rating is used as a proxy
        "title": s["title"].fillna(""),
        "text": s["text"].fillna(""),
    })


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--products", type=int, default=15, help="how many tea products to label")
    ap.add_argument("--per-product", type=int, default=100, help="reviews sampled per product")
    args = ap.parse_args()

    download()
    df = pd.read_parquet(RAW_FILE)
    print(f"All reviews: {len(df):,}")
    tea = filter_tea(df)
    tea.to_parquet(TEA_REVIEWS_FILE, index=False)
    print(f"Tea products: {tea.product_id.nunique()}, tea reviews: {len(tea):,} -> {TEA_REVIEWS_FILE.name}")
    print("Rating mix:", tea.rating.value_counts(normalize=True).sort_index().round(3).to_dict())

    sample = make_sample(tea, args.products, args.per_product)
    out = config.sample_file("amazon_tea")
    sample.to_csv(out, index=False)
    print(f"Sample for AI labeling: {len(sample):,} reviews -> {out.name}")


if __name__ == "__main__":
    main()
