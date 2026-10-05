# Rules

These are the same rules the Review Insight web app and command-line pipeline send to the model, so results from the skill are comparable.

## 1. Choosing aspects (taxonomy)

Read `taxonomy_sample.txt`. List the **6-10 aspects customers actually talk about** that a business could act on.

- Cover the product itself AND the purchase experience (price, delivery, after-sales, authenticity, listing accuracy), but only the ones these reviews actually mention.
- Merge near-duplicates. Prefer aspects that would lead to different actions or different teams.
- Every aspect needs an owner team. Pick from: Product, Product / Sourcing, Supply chain, Supply chain / QC, Packaging, Pricing, Logistics, Customer service, Listing / Content, Marketing claims, Operations.
- Check the list against the data: an aspect that no sampled review mentions should not be on it. One that keeps coming up but has no home should be added.

Write `ri_work/taxonomy.json`:

```json
{"category": "Desk",
 "source": "claude-skill",
 "aspects": [
  {"key": "stability", "label_en": "Stability", "label_zh": "稳固性",
   "description": "wobbles, shakes, load capacity", "owner": "Product"},
  {"key": "assembly", "label_en": "Assembly", "label_zh": "安装",
   "description": "instructions, missing screws, holes don't line up, installation service", "owner": "Product / Content"}
 ]}
```

`key` is snake_case English. `description` says what counts, so labeling stays consistent across batches.

For tea, use `references/tea_taxonomy.json` as is. It was written by hand from real tea e-commerce work.

## 2. Labeling each review

For EACH review, extract structured insight an operations team can act on.

- Only tag an aspect if the review actually talks about it. Do not guess.
- `evidence` is a short **exact** phrase copied from the review (max 12 words / 20 Chinese characters). `summarize.py` checks this.
- `root_cause` only for negative reviews: one short sentence on the most likely underlying problem, written in the review's language. Otherwise `null`.
- `repurchase`: be strict, this is used to estimate loyalty.
  - `"yes"` ONLY if the text explicitly says they bought it again, reordered, subscribed, stocked up, or will buy again.
  - `"no"` ONLY if it explicitly says they won't buy again, are returning it, switching, or tells others not to buy.
  - Praise or complaints alone are `"unclear"`.
- `overall_sentiment`: the reviewer's overall verdict on the purchase. Use `"neutral"` only when it is truly mixed or has no opinion.
- If there is a star rating, judge sentiment from the text, not only the stars.
- Label each review on its own. Do not let earlier reviews, or what you expect the totals to look like, change the call.

One JSON object per line in `ri_work/labels.jsonl`:

```json
{"review_id": 12, "overall_sentiment": "negative", "aspects": [{"aspect": "stability", "sentiment": "negative", "evidence": "桌子晃得厉害"}, {"aspect": "assembly", "sentiment": "positive", "evidence": "安装很简单"}], "root_cause": "桌腿连接件强度不够", "repurchase": "unclear"}
```

## 3. The ops brief

You are a senior e-commerce operations analyst writing for a weekly ops meeting. Use ONLY the numbers and quotes in `summary.json`; never invent facts. Write in the user's language and keep customer quotes in their original language.

```
<Category>: <N> reviews

Summary: 2 sentences. What customers like and the main problem.

Fix first (at most 3, most impactful first; fewer if there are almost no complaints)
1. <Issue> (owner: <team from owner_teams>)
   Evidence: <how many complaints, share of reviews> + one short quote
   Next step: <one concrete action>

Keep doing: 1-2 strengths worth protecting in listings and ads.

Hidden issues: <count> satisfied customers still reported a concrete problem, e.g. <one quote>.
```

A good "next step" is something a team could start on Monday: "ask the warehouse to add a corner protector for orders shipped by courier X", not "improve quality".
