"""Send reviews to the LLM in batches and save structured labels.

Reviews are batched within one category so each call uses that category's taxonomy.
Safe to stop (Ctrl+C) and re-run: reviews already labeled are skipped.
Human labels (if any) are never sent to the model.

Usage:
    python src/label_reviews.py --dataset jd --limit 20     # quick test
    python src/label_reviews.py --dataset jd                # whole sample
    python src/label_reviews.py --dataset jd --provider deepseek
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import pandas as pd

import config
from llm_client import LLMError, get_client
from taxonomy import REPURCHASE, SENTIMENTS, aspect_keys, build_system_prompt, load_taxonomy

MAX_REVIEW_CHARS = 1500  # long reviews are trimmed to save tokens


def build_user_prompt(batch: pd.DataFrame) -> str:
    items = []
    for r in batch.itertuples():
        item = {"review_id": int(r.review_id)}
        if pd.notna(r.rating):
            item["stars"] = int(r.rating)
        if isinstance(r.title, str) and r.title.strip():
            item["title"] = r.title
        item["text"] = str(r.text)[:MAX_REVIEW_CHARS]
        items.append(item)
    return "Reviews:\n" + json.dumps(items, ensure_ascii=False)


def validate(result: dict, allowed_aspects: set[str]) -> dict | None:
    """Keep only well-formed fields; drop anything outside the taxonomy."""
    try:
        rid = int(result["review_id"])
    except (KeyError, TypeError, ValueError):
        return None
    overall = str(result.get("overall_sentiment", "")).lower()
    if overall not in SENTIMENTS:
        return None
    aspects, seen = [], set()
    for a in result.get("aspects") or []:
        if not isinstance(a, dict):
            continue
        key = str(a.get("aspect", "")).lower()
        sent = str(a.get("sentiment", "")).lower()
        if key in allowed_aspects and sent in SENTIMENTS and key not in seen:
            seen.add(key)
            aspects.append({"aspect": key, "sentiment": sent, "evidence": str(a.get("evidence", ""))[:200]})
    rep = str(result.get("repurchase", "unclear")).lower()
    root = result.get("root_cause")
    return {
        "review_id": rid,
        "overall_sentiment": overall,
        "aspects": aspects,
        "root_cause": str(root) if root and overall == "negative" else None,
        "repurchase": rep if rep in REPURCHASE else "unclear",
    }


def load_done_ids(path: Path) -> set[int]:
    if not path.exists():
        return set()
    with open(path) as f:
        return {json.loads(line)["review_id"] for line in f if line.strip()}


def run(client, sample: pd.DataFrame, dataset: str, batch_size: int, rpm: float,
        out_path: Path | None = None, taxonomies: dict | None = None) -> int:
    out_path = out_path or config.labels_file(dataset)
    meta = config.DATASETS.get(dataset, {"language": "en"})
    done = load_done_ids(out_path)
    todo = sample[~sample.review_id.isin(done)]
    print(f"{len(done)} already labeled, {len(todo)} to go, provider={client.name}")
    gap = 60.0 / rpm if rpm > 0 else 0
    written = 0
    with open(out_path, "a") as out:
        for cat, group in todo.groupby("category", sort=False):
            tax = (taxonomies or {}).get(cat) or load_taxonomy(dataset, cat)
            allowed = set(aspect_keys(tax))
            system = build_system_prompt(tax, meta["language"], has_rating=group.rating.notna().any())
            for start in range(0, len(group), batch_size):
                batch = group.iloc[start:start + batch_size]
                t0 = time.time()
                try:
                    resp = client.complete_json(system, build_user_prompt(batch))
                except LLMError as e:
                    print(f"  [{cat}] batch failed: {e}")
                    if "HTTP 4" in str(e) and "429" not in str(e):
                        raise  # key or model problem: stop and fix .env
                    continue
                wanted = set(batch.review_id.astype(int))
                for raw in resp.get("results", []):
                    row = validate(raw, allowed)
                    if row and row["review_id"] in wanted:
                        row["category"] = cat
                        row["provider"] = client.name
                        row["model"] = getattr(client, "model", "")
                        out.write(json.dumps(row, ensure_ascii=False) + "\n")
                        wanted.discard(row["review_id"])
                        written += 1
                out.flush()
                missing = f", {len(wanted)} missing (re-run to retry)" if wanted else ""
                print(f"  [{cat}] +{len(batch) - len(wanted)}{missing}")
                sleep = gap - (time.time() - t0)
                if sleep > 0:
                    time.sleep(sleep)
    return written


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, choices=list(config.DATASETS))
    ap.add_argument("--limit", type=int, default=None, help="only label the first N reviews")
    ap.add_argument("--provider", default=None, help="gemini or deepseek (default from .env)")
    ap.add_argument("--batch-size", type=int, default=config.BATCH_SIZE)
    ap.add_argument("--rpm", type=float, default=config.REQUESTS_PER_MINUTE)
    args = ap.parse_args()

    sample = pd.read_csv(config.sample_file(args.dataset))
    if args.limit:
        sample = sample.head(args.limit)
    n = run(get_client(args.provider), sample, args.dataset, args.batch_size, args.rpm)
    print(f"Done. New labels written: {n} -> {config.labels_file(args.dataset)}")


if __name__ == "__main__":
    main()
