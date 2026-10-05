"""Score the Claude skill test: 100 random JD.com reviews (random_state=7 from data/processed/jd_sample.csv).

The skill only saw jd_test_input.csv (review text, no labels). Its labels are in ri_work/labels.jsonl.
This compares its overall sentiment with the dataset's human labels, and with the API pipeline
(Gemini Flash-Lite, data/labels/jd.jsonl) on the same 100 reviews.

Run from the repo root:  python evaluation/skill_test/score.py
"""
import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

sample = pd.read_csv(ROOT / "data/processed/jd_sample.csv")
test = sample.sample(100, random_state=7)[["review_id", "category", "human_label", "text"]]

skill_reviews = pd.read_csv(HERE / "ri_work/reviews.csv")  # skill's own ids -> text
skill = {}
for line in (HERE / "ri_work/labels.jsonl").read_text(encoding="utf-8").splitlines():
    r = json.loads(line)
    skill[r["review_id"]] = r["overall_sentiment"]  # last line wins, same as summarize.py
skill_reviews["skill"] = skill_reviews.review_id.map(skill)
test = test.merge(skill_reviews[["text", "skill"]], on="text", how="left")

api = {}
api_path = ROOT / "data/labels/jd.jsonl"
if api_path.exists():
    for line in api_path.read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        api[r["review_id"]] = r["overall_sentiment"]
test["api"] = test.review_id.map(api)


def score(col):
    d = test.dropna(subset=[col])
    committed = d[d[col] != "neutral"]
    return {"n": len(d),
            "agreement": round((d[col] == d.human_label).mean(), 3),
            "agreement_when_committed": round((committed[col] == committed.human_label).mean(), 3),
            "neutral": int((d[col] == "neutral").sum())}


out = {"skill (Claude, in conversation)": score("skill")}
if test.api.notna().any():
    out["API pipeline (Gemini Flash-Lite)"] = score("api")
    both = test.dropna(subset=["api"])
    out["skill vs API, same answer"] = round((both.skill == both.api).mean(), 3)
print(json.dumps(out, indent=1, ensure_ascii=False))
test.to_csv(HERE / "skill_vs_human.csv", index=False, encoding="utf-8-sig")
(HERE / "results.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
