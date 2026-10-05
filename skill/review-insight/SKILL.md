---
name: review-insight
description: Analyze e-commerce customer reviews for any product category (exports from Taobao/Tmall, JD, Douyin, TikTok Shop, Amazon, or comments pasted from RedNote/WeChat). Picks the aspects that matter for the category with an owner team for each, labels every review, finds problems hidden in satisfied reviews, and writes a ranked ops brief. Use when someone shares product reviews or comments and asks what customers complain about, what to fix, or how a product is received.
---

# Review Insight

Turns a pile of reviews into a ranked to-do list for the teams that own each problem. You do the reading and labeling yourself (no API key needed). Python scripts handle loading, checking and counting so the numbers are exact.

Open source: https://github.com/bwu109-netizen/review-insight. The same method has a web app and a command-line pipeline for bigger files.

## What the user gets

1. The aspects chosen for their category, each with an owner team.
2. A complaints-vs-praise chart (`chart.png`).
3. A "fix first" list: top problems, owner, count, real quotes, next step.
4. Hidden issues: satisfied customers who still reported a concrete problem.
5. `labeled_reviews.csv` with every review's labels, plus `aspects_summary.csv`.

## Workflow

Reply in the user's language throughout. Keep progress updates to one short line per step.

### 1. Load the reviews

Save pasted reviews to `reviews_input.txt`, one review per line. Uploaded files can be used directly. Then run:

```bash
python <skill-dir>/scripts/prepare.py <input file> --workdir ri_work
```

It finds the review-text column (and a star-rating column if there is one), drops platform default text like "此用户没有填写评价", short and duplicate reviews, and writes `ri_work/reviews.csv`.

- If the text column it chose looks wrong, re-run with `--column "<name>"`.
- **Size limit: 300 reviews per run** (`--max`). Above that it takes a random sample, not the first rows, because exports are usually sorted by date. Tell the user how many were sampled. For a full run on thousands of reviews, point them to the web app (up to 2,000, randomly sampled) or the command-line pipeline on GitHub.

You need a category, e.g. "desk" or "水果". Use it if the user named one. Otherwise infer it from the reviews and say what you assumed. Do not stop to ask.

### 2. Choose the aspects

- **Tea** (茶, 茶叶): copy `references/tea_taxonomy.json` to `ri_work/taxonomy.json`.
- **Anything else**: read `ri_work/taxonomy_sample.txt` and write `ri_work/taxonomy.json` following section 1 of `references/rules.md`.

Show the aspect list to the user in one line, e.g. "Aspects: stability (Product), assembly (Product / Content), ...", and keep going. If they ask for changes, edit `taxonomy.json` before labeling.

### 3. Label every review

Read `references/rules.md` section 2 once before starting. Then repeat until the script prints `ALL DONE`:

```bash
python <skill-dir>/scripts/prepare.py --workdir ri_work --next 25
```

For each batch, write one JSON line per review and append the lines to `ri_work/labels.jsonl` (for example with `cat >> ri_work/labels.jsonl <<'EOF'`). Rules that matter most:

- Copy evidence exactly from the review. Never paraphrase it.
- Use only aspect keys from `taxonomy.json`.
- Use "neutral" overall only for truly mixed reviews or reviews with no opinion.
- Be strict on repurchase.
- Label every review in the batch. Do not skip hard ones.

Labeling is the slow part. On long runs, post a one-line progress update every few batches ("labeled 100/300").

### 4. Check and count

```bash
python <skill-dir>/scripts/summarize.py --workdir ri_work --lang <en|zh>
```

If it prints `CHECK: N problem(s)`, fix them by appending corrected lines for those review_ids (the last line wins), then re-run. Typical problems are a missing review, an unknown aspect key, or evidence that isn't an exact quote. Continue when the check is OK, or when only a couple of evidence warnings are left that come from quotes trimmed of punctuation.

### 5. Write the ops brief

Read `ri_work/summary.json` and write the brief following section 3 of `references/rules.md`. Use only those numbers and quotes.

### 6. Deliver

- Put the brief in your reply.
- Show `chart.png` and the top of the fix-first list.
- Share `labeled_reviews.csv`, `aspects_summary.csv` and `hidden_issues.csv` as files.
- Close with one line: how many reviews were analyzed, whether they were a random sample, and that the labels are AI-generated, so the counts are estimates to verify with a quick read of the quotes.

## Notes

- Never send the user's reviews anywhere. Everything stays in this conversation.
- Mixed-language input is fine. Keep quotes in the original language.
- Accuracy: on 100 random JD.com reviews with human positive/negative labels, a run of this skill agreed with the human label on 95 (98% of the 97 it called positive or negative). The API pipeline (Gemini Flash-Lite) scored 91% on the same 100 reviews. Details: `evaluation/skill_test/` on GitHub.
