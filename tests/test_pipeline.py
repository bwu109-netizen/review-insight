"""Offline tests: no internet or API key needed. Run: python -m pytest -q"""
import json
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import config  # noqa: E402
import label_reviews  # noqa: E402
from analyze import build_tables  # noqa: E402
from evaluate import metrics, reference  # noqa: E402
from generate_taxonomy import clean  # noqa: E402
from prepare_amazon import filter_tea, make_sample  # noqa: E402
from prepare_jd import build_sample  # noqa: E402
from taxonomy import TEA_TAXONOMY, build_system_prompt  # noqa: E402


def fake_amazon():
    rows, i = [], 0
    for pid, word in [("TEA1", "green tea"), ("TEA2", "chai tea"), ("COF1", "coffee")]:
        for k in range(50):
            i += 1
            rows.append(dict(Id=i, ProductId=pid, UserId=f"u{i}", ProfileName="x",
                             HelpfulnessNumerator=0, HelpfulnessDenominator=0,
                             Score=(k % 5) + 1, Time=1300000000 + i,
                             Summary=f"Nice {word}", Text=f"I like this {word}.<br />Good &amp; fresh"))
    return pd.DataFrame(rows)


def test_amazon_filter_and_unified_sample():
    tea = filter_tea(fake_amazon())
    assert set(tea.product_id) == {"TEA1", "TEA2"}
    s = make_sample(tea, n_products=2, per_product=20)
    assert len(s) == 40 and set(s.rating) == {1, 2, 3, 4, 5}
    assert list(s.columns) == ["review_id", "dataset", "market", "platform", "category", "group_id",
                               "rating", "human_label", "title", "text"]


def test_jd_sample_is_balanced_and_skips_short():
    raw = pd.DataFrame({
        "cat": ["水果"] * 40 + ["酒店"] * 10,
        "label": [0, 1] * 25,
        "review": [f"这个水果第{i}次买，评价内容足够长" for i in range(40)] + ["好"] * 10,
    })
    s = build_sample(raw, per_category=20)
    assert len(s) == 20 and set(s.category) == {"水果"}
    assert (s.human_label == "positive").sum() == 10


def test_generated_taxonomy_is_cleaned():
    tax = clean({"category": "Fruit", "aspects": [
        {"key": "Freshness!", "label_en": "Freshness", "owner": "Supply chain"},
        {"key": "freshness", "label_en": "dup"},
        {"key": "taste"}, {"key": "delivery", "owner": "Logistics"}]}, "水果")
    assert [a["key"] for a in tax["aspects"]] == ["freshness", "taste", "delivery"]
    assert tax["aspects"][1]["owner"] == "Product"


def test_prompt_mentions_language_and_aspects():
    p = build_system_prompt(TEA_TAXONOMY, "zh", has_rating=False)
    assert "Simplified Chinese" in p and "listing_accuracy" in p and "star rating" not in p


class FakeClient:
    name, model = "fake", "fake-1"

    def complete_json(self, system, user):
        items = json.loads(user.split("\n", 1)[1])
        res = [{"review_id": it["review_id"],
                "overall_sentiment": "negative" if "差" in it["text"] else "positive",
                "aspects": [{"aspect": "freshness", "sentiment": "negative", "evidence": "不新鲜"},
                            {"aspect": "made_up", "sentiment": "positive"}],
                "root_cause": "冷链问题", "repurchase": "no"} for it in items[:-1]]
        return {"results": res}  # drops the last one on purpose


def test_label_resume_analyze_evaluate(tmp_path):
    tax = {"category": "Fruit", "aspects": [
        {"key": "freshness", "label_en": "Freshness", "label_zh": "新鲜度", "owner": "Supply chain", "description": ""}]}
    sample = pd.DataFrame(dict(
        review_id=[1, 2, 3, 4], dataset="jd", market="domestic", platform="JD.com",
        category="水果", group_id="水果", rating=pd.NA,
        human_label=["negative", "positive", "negative", "positive"],
        title="", text=["很差", "很好吃", "太差了", "不错"]))
    out = tmp_path / "jd.jsonl"
    n1 = label_reviews.run(FakeClient(), sample, "jd", batch_size=4, rpm=0, out_path=out, taxonomies={"水果": tax})
    assert n1 == 3
    row = json.loads(out.read_text().splitlines()[0])
    assert [a["aspect"] for a in row["aspects"]] == ["freshness"]  # invalid aspect dropped
    label_reviews.run(FakeClient(), sample, "jd", batch_size=4, rpm=0, out_path=out, taxonomies={"水果": tax})
    assert label_reviews.load_done_ids(out) == {1, 2, 3}

    import analyze
    labels = analyze.load_labels(out)
    reviews, aspects, groups = build_tables("jd", sample, labels, taxonomies={"水果": tax})
    assert len(reviews) == 3 and aspects.owner.eq("Supply chain").all()
    assert reviews.loc[reviews.review_id == 2, "hidden_issue"].item()  # positive overall + negative aspect

    ref, name = reference(reviews)
    m = metrics(ref, reviews.overall_sentiment)
    assert "human" in name and m["accuracy"] == pytest.approx(1.0)


def test_custom_run_end_to_end():
    import custom

    class C(FakeClient):
        def complete_json(self, system, user):
            if "review-analysis schemes" in system:
                return {"category": "Fruit", "aspects": [{"key": "freshness", "owner": "Supply chain"},
                                                         {"key": "taste"}, {"key": "delivery"}]}
            return super().complete_json(system, user)

    s = custom.to_sample(["很差不新鲜", "很好吃", "太差了", "不错", "x"], "水果", "小红书")
    assert len(s) == 4
    tax, reviews, aspects, groups = custom.run_custom(C(), s, "水果", rpm=0)
    assert len(reviews) == 3 and groups.reviews.sum() == 3

    class B(C):
        def complete_json(self, system, user):
            assert "Simplified Chinese" in system and "reviews_analyzed" in user
            return {"name": "水果", "summary": "x", "fix_first": [], "keep_doing": []}
    assert custom.make_brief(B(), reviews, aspects, tax, "zh")["name"] == "水果"
