"""Offline test of the Claude skill's helper scripts."""
import json
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest

SCRIPTS = Path(__file__).resolve().parent.parent / "skill/review-insight/scripts"


def run(*args, cwd):
    return subprocess.run([sys.executable, *map(str, args)], cwd=cwd, capture_output=True, text=True, check=True).stdout


def test_skill_prepare_and_summarize(tmp_path):
    pytest.importorskip("matplotlib")  # the chart needs it; Claude's sandbox has it
    texts = ["桌子很稳，安装简单", "桌子晃得厉害，螺丝少了两颗", "此用户没有填写评价", "好", "桌子很稳，安装简单",
             "整体满意，就是桌面有划痕"]
    pd.DataFrame({"评价内容": texts, "评分": [5, 1, 5, 5, 5, 4]}).to_csv(tmp_path / "in.csv", index=False)
    info = json.loads(run(SCRIPTS / "prepare.py", "in.csv", "--workdir", "w", cwd=tmp_path))
    assert info["reviews_to_label"] == 3 and info["rating_column"] == "评分"
    assert "labeled 0/3" in run(SCRIPTS / "prepare.py", "--workdir", "w", "--next", "25", cwd=tmp_path)

    w = tmp_path / "w"
    (w / "taxonomy.json").write_text(json.dumps({"category": "Desk", "aspects": [
        {"key": "stability", "label_en": "Stability", "label_zh": "稳固", "owner": "Product"},
        {"key": "assembly", "label_en": "Assembly", "label_zh": "安装", "owner": "Product"}]}, ensure_ascii=False))
    lines = [
        {"review_id": 1, "overall_sentiment": "positive", "aspects": [{"aspect": "stability", "sentiment": "positive", "evidence": "桌子很稳"}]},
        {"review_id": 2, "overall_sentiment": "negative", "aspects": [{"aspect": "stability", "sentiment": "negative", "evidence": "晃得很"}]},
        {"review_id": 3, "overall_sentiment": "positive", "aspects": [{"aspect": "finish", "sentiment": "negative", "evidence": "桌面有划痕"}]},
        # corrected line for review 2 and 3, appended later: the last line wins
        {"review_id": 2, "overall_sentiment": "negative", "aspects": [{"aspect": "stability", "sentiment": "negative", "evidence": "桌子晃得厉害"}, {"aspect": "assembly", "sentiment": "negative", "evidence": "螺丝少了两颗"}], "root_cause": "少配件"},
    ]
    (w / "labels.jsonl").write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in lines))
    out = run(SCRIPTS / "summarize.py", "--workdir", "w", cwd=tmp_path)
    assert "CHECK: 1 problem" in out and "unknown aspect 'finish'" in out  # review 3 still uses a bad key

    with open(w / "labels.jsonl", "a") as f:
        f.write("\n" + json.dumps({"review_id": 3, "overall_sentiment": "positive", "aspects": [
            {"aspect": "stability", "sentiment": "negative", "evidence": "桌面有划痕"}]}, ensure_ascii=False))
    out = run(SCRIPTS / "summarize.py", "--workdir", "w", "--lang", "zh", cwd=tmp_path)
    assert "CHECK: OK" in out
    s = json.loads((w / "summary.json").read_text())
    assert s["reviews_analyzed"] == 3 and s["hidden_issues_in_satisfied_reviews"] == 1
    top = s["aspects_ranked_by_complaints"][0]
    assert top["aspect"] == "stability" and top["complaints"] == 2
    assert (w / "chart.png").exists() and (w / "labeled_reviews.csv").exists()
