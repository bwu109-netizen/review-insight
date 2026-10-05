"""One-time: move the first Amazon run (v1 file names) to the multi-dataset layout.

    data/processed/sample_for_labeling.csv -> data/processed/amazon_tea_sample.csv (new columns)
    data/labels/labels.jsonl               -> data/labels/amazon_tea.jsonl

Usage:
    python src/migrate_v2.py
"""
import json

import pandas as pd

import config
from prepare_amazon import to_unified


def main() -> None:
    old_sample = config.PROCESSED_DIR / "sample_for_labeling.csv"
    new_sample = config.sample_file("amazon_tea")
    if old_sample.exists() and not new_sample.exists():
        s = pd.read_csv(old_sample)
        to_unified(s).to_csv(new_sample, index=False)
        old_sample.rename(config.PROCESSED_DIR / "sample_for_labeling.v1.csv")
        print(f"Sample: {len(s)} rows -> {new_sample.name}")

    old_labels = config.LABELS_DIR / "labels.jsonl"
    new_labels = config.labels_file("amazon_tea")
    if old_labels.exists() and not new_labels.exists():
        with open(old_labels) as f, open(new_labels, "w") as out:
            n = 0
            for line in f:
                if line.strip():
                    r = json.loads(line)
                    r.setdefault("category", "Tea")
                    out.write(json.dumps(r, ensure_ascii=False) + "\n")
                    n += 1
        old_labels.rename(config.LABELS_DIR / "labels.v1.jsonl")
        print(f"Labels: {n} rows -> {new_labels.name}")
    print("Migration done.")


if __name__ == "__main__":
    main()
