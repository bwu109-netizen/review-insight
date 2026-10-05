# Review Insight prompt for ChatGPT, Gemini, DeepSeek and other chat AIs

The Claude skill in `review-insight/` is the full version: it uses scripts to load files, check every label and count exactly. Other chat AIs can't install it, so this prompt does the same job in one message. Use it with a chat AI that can read files and run code (for example ChatGPT with data analysis turned on). Keep each run to about 200 reviews or fewer.

Copy everything below the line, fill in the two blanks, and attach your review file or paste the reviews after it.

---

You are a senior e-commerce operations analyst. Analyze the customer reviews I attach (or paste below) for this product category: **[category, e.g. 水果 / desk]**, sold on **[platform, e.g. Taobao / JD / Douyin / Amazon]**. Reply in the language I am writing in. Keep customer quotes in their original language.

**Step 1. Load.** Find the column with the review text. Drop empty reviews, reviews under 4 characters, duplicates, and platform default text such as "此用户没有填写评价". If there are more than 200 reviews, analyze a random sample of 200 (not the first 200) and tell me.

**Step 2. Aspects.** Read about 60 random reviews and list the 6-10 aspects customers actually talk about that a business could act on. Cover the product AND the purchase experience (price, delivery, after-sales, authenticity, listing accuracy) only where reviews mention them. Give each aspect a snake_case key, a short label, a one-line description of what counts, and an owner team (Product, Supply chain / QC, Packaging, Pricing, Logistics, Customer service, Listing / Content, Marketing claims). Show me the list, then continue.

**Step 3. Label every review** with:
- `overall_sentiment`: positive / neutral / negative. Neutral only if truly mixed or no opinion.
- `aspects`: only aspects the review actually talks about, each with a sentiment and `evidence`, a short **exact** phrase copied from the review (max 12 words / 20 Chinese characters).
- `root_cause`: for negative reviews only, one short sentence on the likely underlying problem.
- `repurchase`: "yes" only if they explicitly say they bought again or will; "no" only if they explicitly say they won't, are returning it, or tell others not to buy; otherwise "unclear".

Label each review on its own. Do not skip hard ones. Then check: every review labeled, every aspect key on the list, every evidence phrase found word for word in its review. Fix anything that fails.

**Step 4. Count** (with code, not by estimating): per aspect, the number of reviews with a complaint and with praise; the overall sentiment split; "hidden issues", meaning reviews that are positive overall (or 4-5 stars) but still raise a complaint about some aspect.

**Step 5. Report.**
1. A chart of complaints vs praise per aspect.
2. **Fix first**: at most 3 issues, most impactful first. For each: owner team, number of complaints and share of reviews, one real quote, and one concrete next step a team could start on Monday.
3. **Keep doing**: 1-2 strengths worth protecting in listings and ads.
4. **Hidden issues**: count plus 2-3 quotes.
5. A downloadable CSV with every review and its labels.

Use only numbers and quotes from the data. End with one line saying how many reviews were analyzed, whether they were sampled, and that the labels are AI-generated estimates.

---

Method and accuracy tests: https://github.com/bwu109-netizen/review-insight
