"""Translate Chinese customer quotes into English for the English UI.

The quotes stay as they are on the page; the translation is shown under them in small gray text.
Only quotes that are actually shown get translated, in a few batched calls.

Usage (built-in JD examples, run once after regenerating briefs):
    python src/translate.py --dataset jd
"""
from __future__ import annotations

import argparse
import json
import re

import pandas as pd

import config
from llm_client import LLMError, get_client

SYSTEM = """You translate Chinese e-commerce review quotes into English for an operations team.
For each input string, give a short, natural English translation that keeps the meaning, tone and any
numbers. Read each quote in the context of "product_category" when given. Be accurate: stay close to the literal meaning, never add or reverse information, and keep
negations ("不是" = "is not"). Translate slang and set phrases by meaning (e.g. 瑕不掩瑜 -> "the flaws don't outweigh the
good points"). No notes, no romanization, no quotation marks.
Return JSON: {"translations": ["...", "..."]} with exactly one translation per input, in the same order."""

CHUNK = 60
MAX_CHARS = 400
HAN = re.compile(r"[一-鿿]")


def needs_translation(text) -> bool:
    return isinstance(text, str) and bool(HAN.search(text))


def translate_texts(client, texts, chunk: int = CHUNK, category: str = "") -> dict:
    """Returns {original: english}. Chunks that fail are skipped, so a partial result is still useful."""
    todo = list(dict.fromkeys(t.strip() for t in texts if needs_translation(t) and t.strip()))
    out = {}
    for start in range(0, len(todo), chunk):
        part = todo[start:start + chunk]
        try:
            # the product category helps with words like 坏 (spoiled fruit vs a broken device)
            res = client.complete_json(SYSTEM, json.dumps({"product_category": category, "texts": [t[:MAX_CHARS] for t in part]},
                                                          ensure_ascii=False))
        except (LLMError, RuntimeError, ValueError) as e:
            print(f"  translation batch failed: {e}")
            continue
        got = res.get("translations") if isinstance(res, dict) else None
        if not isinstance(got, list) or len(got) != len(part):
            print("  translation batch returned the wrong number of items, skipped")
            continue
        out.update({src: str(en).strip() for src, en in zip(part, got) if str(en).strip()})
    return out


QUOTE_RE = re.compile(r"[\"'“‘「『]([^\"'”’」』]*[一-鿿][^\"'”’」』]*)[\"'”’」』]")


def quotes_in(text: str) -> list[str]:
    """Chinese quotes cited inside a brief's evidence sentence."""
    return [m.strip() for m in QUOTE_RE.findall(text or "") if m.strip()]


def example_quotes(dataset: str) -> list[str]:
    """Every Chinese quote the ?examples=1 page can show in English mode: the 'Example quote' column of the
    fix-first table (first complaint per aspect, for 'All' and for each group) and quotes cited in the briefs."""
    d = config.app_dir(dataset)
    aspects = pd.read_csv(d / "aspects.csv")
    neg = aspects[aspects.sentiment == "negative"]
    texts = set()
    for part in [neg] + [g for _, g in neg.groupby("group_id")]:
        texts.update(part.groupby(["aspect_label", "owner"]).evidence.first().dropna().tolist())
    briefs = json.loads((d / "briefs.json").read_text()) if (d / "briefs.json").exists() else {}
    for b in briefs.values():
        for item in b.get("fix_first", []):
            texts.update(quotes_in(item.get("evidence", "")))
    return sorted(t for t in texts if needs_translation(t))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, choices=list(config.DATASETS))
    ap.add_argument("--provider", default=None)
    args = ap.parse_args()
    out = config.app_dir(args.dataset) / "quotes_en.json"
    have = json.loads(out.read_text()) if out.exists() else {}
    todo = [t for t in example_quotes(args.dataset) if t not in have]
    print(f"{len(todo)} quotes to translate ({len(have)} already done)")
    have.update(translate_texts(get_client(args.provider), todo))
    out.write_text(json.dumps(have, indent=1, ensure_ascii=False))
    print(f"Done: {len(have)} translations -> {out}")


if __name__ == "__main__":
    main()
