"""Review Insight: Streamlit dashboard (English by default, Chinese on toggle).

Run locally:  streamlit run app.py
The two built-in datasets are precomputed (data/app/), so browsing needs no API key.
The main page (ui/ + src/web_app.py) analyzes uploaded reviews with the visitor's own API key.
"""
import json
import sys
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "src"))
APP_DIR = ROOT / "data" / "app"

# Diverging pair (validated reference palette): blue = positive, red = negative
POS, NEG = "#2a78d6", "#e34948"

st.set_page_config(page_title="Review Insight", layout="wide")

# ------------------------------------------------------------------ i18n
if "lang" not in st.session_state:
    st.session_state.lang = "en"

T = {
    "subtitle": {
        "en": "Paste or upload e-commerce reviews for any product. An LLM decides which aspects matter for that "
              "category, labels every review, and turns complaints into a ranked to-do list for the team that owns "
              "each problem. Tested on 900 JD.com reviews: 89% agreement with human labels (98% when the AI commits "
              "to positive or negative).",
        "zh": "粘贴或上传任意商品的电商评论。大模型会先判断这个品类该看哪些维度，再逐条标注评论，最后把差评整理成按优先级排好、"
              "分给对应团队的待办清单。已在 900 条京东评论上验证：与人工标签一致率 89%（AI 明确判好评或差评时为 98%）。"},
    "github": {"en": "Method, examples and full evaluation on GitHub", "zh": "方法、示例和完整评估见 GitHub"},
    "examples_link": {"en": "View example results", "zh": "查看示例结果"},
    "market": {"en": "Market", "zh": "市场"},
    "m_jd": {"en": "Domestic: JD.com (Chinese)", "zh": "国内：京东（中文）"},
    "m_amz": {"en": "Overseas: Amazon US (English)", "zh": "海外：美国亚马逊（英文）"},
    "m_custom": {"en": "Analyze your own reviews", "zh": "分析你自己的评价"},
    "no_data": {"en": "No results for this dataset yet. Run the pipeline (see README).",
                "zh": "这个数据集还没有结果，请先运行流程（见 README）。"},
    "tab_insights": {"en": "Insights", "zh": "洞察"},
    "tab_acc": {"en": "How accurate is the AI?", "zh": "AI 准不准？"},
    "tab_method": {"en": "Method", "zh": "方法"},
    "category": {"en": "Category", "zh": "品类"},
    "product": {"en": "Product", "zh": "产品"},
    "all": {"en": "All", "zh": "全部"},
    "k_reviews": {"en": "Reviews analyzed", "zh": "分析评论数"},
    "k_star_neg": {"en": "1-2 star reviews", "zh": "1-2 星评论占比"},
    "k_human_neg": {"en": "Human-labeled negative", "zh": "人工标注差评占比"},
    "k_ai_neg": {"en": "AI: negative overall", "zh": "AI 判为差评"},
    "k_hidden": {"en": "Hidden issues", "zh": "隐藏问题"},
    "k_hidden_help": {"en": "Satisfied customers who still report a concrete problem "
                            "(e.g. '5 stars, but only 90 of 100 bags arrived'). Overall ratings miss these.",
                      "zh": "整体满意、但仍提到具体问题的评论（比如“5 星，但 100 包只到了 90 包”）。只看星级会漏掉。"},
    "h_teams": {"en": "Which teams get the most complaints, across all categories",
                "zh": "跨品类看：哪个团队收到的投诉最多"},
    "c_teams": {"en": "Each category has its own AI-generated aspects, so the cross-category view groups them by owner team.",
                "zh": "每个品类的维度都由 AI 单独生成，所以跨品类时按负责团队汇总。"},
    "h_aspects": {"en": "What customers talk about, and how they feel", "zh": "顾客在聊什么，态度如何"},
    "c_aspects": {"en": "Sorted by number of complaints. Neutral mentions are left out of the chart.",
                  "zh": "按差评数量排序，中性提及未画在图里。"},
    "axis": {"en": "← negative mentions   |   positive mentions →", "zh": "← 负面提及   |   正面提及 →"},
    "neg": {"en": "Negative", "zh": "负面"},
    "pos": {"en": "Positive", "zh": "正面"},
    "mentions": {"en": "Mentions", "zh": "提及次数"},
    "aspect": {"en": "Aspect", "zh": "维度"},
    "owner_team": {"en": "Owner team", "zh": "负责团队"},
    "no_mentions": {"en": "No aspect mentions for this selection.", "zh": "当前选择下没有维度提及。"},
    "h_fix": {"en": "Fix first", "zh": "优先解决"},
    "no_complaints": {"en": "No complaints found for this selection.", "zh": "当前选择下没有差评。"},
    "col_problem": {"en": "Problem area", "zh": "问题领域"},
    "col_complaints": {"en": "Complaints", "zh": "差评数"},
    "col_example": {"en": "Example quote", "zh": "原句示例"},
    "col_example_en": {"en": "In English", "zh": "英文"},
    "col_share": {"en": "Share of reviews", "zh": "占评论比例"},
    "h_brief": {"en": "AI ops brief", "zh": "AI 运营简报"},
    "evidence": {"en": "Evidence", "zh": "依据"},
    "next_step": {"en": "Next step", "zh": "下一步"},
    "keep": {"en": "Keep doing", "zh": "继续保持"},
    "brief_caption": {"en": "Written by {m} from the aggregated labels, not from raw reviews.",
                      "zh": "由 {m} 根据汇总后的标签生成，不是直接读原始评论。"},
    "h_score": {"en": "Scorecard", "zh": "总览"},
    "c_score": {"en": "Pick a {x} above to read its AI ops brief.", "zh": "在上方选择一个{x}，查看它的 AI 运营简报。"},
    "col_reviews": {"en": "Reviews", "zh": "评论数"},
    "col_stars": {"en": "Avg stars", "zh": "平均星级"},
    "col_ainegs": {"en": "AI negative", "zh": "AI 差评占比"},
    "col_hidden": {"en": "Hidden issues", "zh": "隐藏问题"},
    "col_top": {"en": "Top complaint", "zh": "最大问题"},
    "h_hidden": {"en": "Hidden issues in satisfied reviews", "zh": "满意评论里的隐藏问题"},
    "none": {"en": "None for this selection.", "zh": "当前选择下没有。"},
    "col_stars1": {"en": "Stars", "zh": "星级"},
    "col_quote": {"en": "Quote", "zh": "原句"},
    "col_review": {"en": "Review", "zh": "评论"},
    "browse": {"en": "Browse all labeled reviews", "zh": "浏览全部已标注评论"},
    "f_sent": {"en": "Overall sentiment", "zh": "整体情感"},
    "f_aspect": {"en": "Mentions aspect", "zh": "提到的维度"},
    "any": {"en": "Any", "zh": "不限"},
    "acc_none": {"en": "No evaluation yet.", "zh": "还没有评估结果。"},
    "acc_amz_warn": {
        "en": "Amazon has no human sentiment labels, so this compares the AI with star ratings. The model sees the "
              "stars, so this is a sanity check, not an independent test. See the JD.com tab for the real evaluation.",
        "zh": "亚马逊数据没有人工情感标签，这里只能和星级对比。但模型打标签时看得到星级，所以这只是自查，不算独立测试。"
              "真正的准确率评估请看京东那一栏。"},
    "acc_ref": {"en": "Reference: **{r}**. The model never sees the reference label.",
                "zh": "对照标准：**{r}**。模型打标签时看不到这个标签。"},
    "ref_human": {"en": "human label (dataset authors)", "zh": "人工标签（数据集作者标注）"},
    "ref_star": {"en": "star rating proxy (1-2 = negative, 4-5 = positive, 3 excluded)",
                 "zh": "以星级代替（1-2 星为差评，4-5 星为好评，3 星不计）"},
    "a_agree": {"en": "Agreement", "zh": "一致率"},
    "a_agree_help": {"en": "Neutral AI answers count as disagreement.", "zh": "AI 判为“中性”的也算作不一致。"},
    "a_agree_ex": {"en": "Agreement, excl. neutral", "zh": "一致率（不含中性）"},
    "a_prec": {"en": "Negative: precision", "zh": "差评：精确率"},
    "a_prec_help": {"en": "Of the reviews the AI called negative, how many humans also called negative.",
                    "zh": "AI 判为差评的评论里，人工也判为差评的比例。"},
    "a_rec": {"en": "Negative: recall", "zh": "差评：召回率"},
    "a_rec_help": {"en": "Of the reviews humans called negative, how many the AI caught.",
                   "zh": "人工判为差评的评论里，AI 抓出来的比例。"},
    "a_n": {"en": "n = {n:,} reviews. AI said 'neutral' for {p:.1%} of them.",
            "zh": "共 {n:,} 条评论，其中 AI 判为“中性”的占 {p:.1%}。"},
    "a_manual": {"en": "**Manual check:** I read all {r} reviews where the AI and the human label directly contradict "
                        "(one says positive, the other negative). The AI was right in {a}, the dataset label in {l}, "
                        "unclear {u}. So most of the gap comes from 'neutral' answers on genuinely mixed reviews, "
                        "not from wrong calls.",
                  "zh": "**人工复核：** 我逐条读了 AI 与人工标签完全相反的 {r} 条评论（一个判好评、一个判差评）。"
                        "其中 AI 判对 {a} 条，数据集标签对 {l} 条，说不清 {u} 条。所以剩下的差距主要来自 AI 对好坏参半的评论给了“中性”，"
                        "而不是判错。"},
    "a_bycat": {"en": "Agreement by category", "zh": "分品类一致率"},
    "a_conf": {"en": "**Confusion table** (rows: reference, columns: AI)", "zh": "**混淆表**（行：对照标签，列：AI 判断）"},
    "a_read": {"en": "Read the {n} disagreements", "zh": "查看 {n} 条不一致的评论"},
    "a_read_c": {"en": "Many disagreements are 'neutral' answers on genuinely mixed reviews, and some are label noise "
                       "in the original dataset (e.g. a review about rude couriers marked positive). Reading them is "
                       "part of the evaluation.",
                 "zh": "很多不一致是 AI 对好坏参半的评论给了“中性”，还有一些是原始数据标错了（比如抱怨快递员态度差的评论被标成好评）。"
                       "逐条读这些分歧也是评估的一部分。"},
    "sent_positive": {"en": "positive", "zh": "好评"},
    "sent_neutral": {"en": "neutral", "zh": "中性"},
    "sent_negative": {"en": "negative", "zh": "差评"},
}

CATEGORY_NAME = {
    "计算机": {"en": "Laptops", "zh": "电脑"}, "平板": {"en": "Tablets", "zh": "平板"},
    "手机": {"en": "Phones", "zh": "手机"}, "水果": {"en": "Fruit", "zh": "水果"},
    "衣服": {"en": "Clothing", "zh": "衣服"}, "洗发水": {"en": "Shampoo", "zh": "洗发水"},
}
OWNER_ZH = {
    "Product": "产品", "Product / Sourcing": "产品 / 采购", "Supply chain": "供应链",
    "Supply chain / QC": "供应链 / 质检", "Packaging": "包装", "Pricing": "定价",
    "Product / Content": "产品 / 内容", "Marketing claims": "营销宣传", "Logistics": "物流",
    "Listing / Content": "商品页 / 内容", "Listing": "商品页", "Customer service": "客服",
    "Operations": "运营",
}
PLATFORMS = {
    "en": ["Taobao / Tmall", "JD.com", "Douyin", "RedNote (Xiaohongshu)", "WeChat Channels", "TikTok Shop",
           "Amazon", "Other"],
    "zh": ["淘宝 / 天猫", "京东", "抖音", "小红书", "微信视频号", "TikTok Shop", "亚马逊", "其他"],
}
METHOD = {
    "en": """
- **Domestic data:** online_shopping_10_cats (ChineseNlpCorpus), 62k JD.com reviews with human positive/negative labels.
  Six product categories, 150 reviews each, half positive and half negative. The human label is used only for evaluation.
- **Overseas data:** Amazon Fine Food Reviews (McAuley & Leskovec, 2013). 15 tea products, 100 reviews each, sampled evenly across 1-5 stars.
- **Aspects:** tea uses a hand-written scheme from my own tea e-commerce work. Every other category gets 6-10 aspects
  proposed by the LLM from real reviews, each mapped to an owner team, then checked by a person against the data
  (saved in `data/taxonomies/`, editable).
- **Labeling:** Gemini Flash-Lite (free tier), 20 reviews per call, structured JSON validated against the scheme.
- **Briefs:** one more LLM call per product/category, using only aggregated counts and quotes.
- **Limitations:** both datasets are 2010-2014 reviews; balanced sampling makes negative shares higher than on real listings;
  some human labels in the JD data are noisy; repurchase intent is only counted when stated explicitly.
""",
    "zh": """
- **国内数据：** online_shopping_10_cats（ChineseNlpCorpus），6.2 万条京东评论，每条都有人工标注的好评/差评。
  取 6 个商品品类，每类 150 条，好差评各半。人工标签只用于评估。
- **海外数据：** Amazon Fine Food Reviews（McAuley & Leskovec, 2013）。15 个茶叶产品，每个 100 条，1-5 星均衡抽样。
- **分析维度：** 茶叶用的是我根据自己做茶叶电商的经验手写的维度；其他品类由大模型读真实评论后提出 6-10 个维度，
  每个维度对应一个负责团队，再由人根据数据核对修改（保存在 `data/taxonomies/`，可编辑）。
- **标注：** Gemini Flash-Lite（免费档），每次 20 条，输出结构化 JSON 并按维度表校验。
- **简报：** 每个产品/品类再调用一次大模型，只基于汇总后的数字和原句。
- **局限：** 两份数据都是 2010-2014 年的评论；均衡抽样会让差评占比高于真实商品页；京东数据有部分人工标签有误；
  复购意向只统计明确说出来的。
""",
}


def t(key, **kw):
    s = T[key][st.session_state.lang]
    return s.format(**kw) if kw else s


def zh():
    return st.session_state.lang == "zh"


# ------------------------------------------------------------------ data
@st.cache_data
def load(dataset: str):
    d = APP_DIR / dataset
    if not (d / "reviews.csv").exists():
        return None

    def j(name):
        return json.loads((d / name).read_text()) if (d / name).exists() else {}

    return {
        "reviews": pd.read_csv(d / "reviews.csv"),
        "aspects": pd.read_csv(d / "aspects.csv"),
        "groups": pd.read_csv(d / "groups.csv"),
        "briefs": j("briefs.json"),
        "briefs_zh": j("briefs_zh.json"),
        "eval": j("eval.json") or None,
        "errors": pd.read_csv(d / "eval_errors.csv") if (d / "eval_errors.csv").exists() else None,
        # English for Chinese quotes, made offline by src/translate.py (English mode only)
        "quotes_en": j("quotes_en.json"),
    }


def localize_aspects(A: pd.DataFrame) -> pd.DataFrame:
    """Add display columns in the current language."""
    A = A.copy()
    if zh() and "aspect_label_zh" in A:
        A["aspect_show"] = A["aspect_label_zh"].where(A["aspect_label_zh"].notna() & (A["aspect_label_zh"] != ""),
                                                      A["aspect_label"])
    else:
        A["aspect_show"] = A["aspect_label"]
    A["owner_show"] = A["owner"].map(lambda o: OWNER_ZH.get(o, o)) if zh() else A["owner"]
    return A


def briefs_for(data):
    return (data["briefs_zh"] or data["briefs"]) if zh() else data["briefs"]


def group_name(dataset, gid, briefs):
    if dataset == "jd":
        c = CATEGORY_NAME.get(gid, {})
        return c.get(st.session_state.lang, gid) if zh() else f"{c.get('en', gid)} ({gid})"
    name = briefs.get(gid, {}).get("name")
    return f"{name} ({gid})" if name else gid


def sent_label(s):
    return t(f"sent_{s}") if f"sent_{s}" in T else s


# ------------------------------------------------------------------ views
def kpis(R, baseline_key):
    c1, c2, c3, c4 = st.columns(4)
    c1.metric(t("k_reviews"), f"{len(R):,}")
    c2.metric(t(baseline_key), f"{R.baseline_negative.mean():.0%}")
    c3.metric(t("k_ai_neg"), f"{R.ai_negative.mean():.0%}")
    c4.metric(t("k_hidden"), f"{int(R.hidden_issue.sum())}", help=t("k_hidden_help"))


def aspect_chart(A, by="aspect_show", title_key="aspect"):
    if A.empty:
        st.info(t("no_mentions"))
        return
    counts = A.groupby([by, "sentiment"]).size().unstack(fill_value=0)
    for col in ("positive", "negative"):
        if col not in counts:
            counts[col] = 0
    counts = counts.reset_index()
    order = counts.sort_values("negative", ascending=False)[by].tolist()
    neg_l, pos_l = t("neg"), t("pos")
    long = pd.concat([
        pd.DataFrame({"k": counts[by], "sentiment": neg_l, "value": -counts.negative, "n": counts.negative}),
        pd.DataFrame({"k": counts[by], "sentiment": pos_l, "value": counts.positive, "n": counts.positive}),
    ])
    chart = (
        alt.Chart(long).mark_bar(cornerRadius=4, height=14)
        .encode(
            y=alt.Y("k:N", sort=order, title=None, axis=alt.Axis(labelLimit=220)),
            x=alt.X("value:Q", title=t("axis"), axis=alt.Axis(labelExpr="abs(datum.value)", gridOpacity=0.3)),
            color=alt.Color("sentiment:N", scale=alt.Scale(domain=[neg_l, pos_l], range=[NEG, POS]),
                            legend=alt.Legend(orient="top", title=None)),
            tooltip=[alt.Tooltip("k:N", title=t(title_key)), alt.Tooltip("sentiment:N", title=" "),
                     alt.Tooltip("n:Q", title=t("mentions"))],
        )
        .properties(height=alt.Step(32))
    )
    st.altair_chart(chart, use_container_width=True)


def fix_first(A, R, quotes_en=None):
    neg = A[A.sentiment == "negative"]
    if neg.empty:
        st.info(t("no_complaints"))
        return
    fix = (neg.groupby(["aspect_show", "owner_show"])
           .agg(complaints=("review_id", "size"), example=("evidence", "first"))
           .reset_index().sort_values("complaints", ascending=False))
    fix["share"] = (fix.complaints / len(R)).map("{:.0%}".format)
    if not zh() and quotes_en:
        fix.insert(fix.columns.get_loc("example") + 1, "example_en", fix.example.map(lambda q: quotes_en.get(str(q).strip(), "")))
    st.dataframe(fix.rename(columns={"aspect_show": t("col_problem"), "owner_show": t("owner_team"),
                                     "complaints": t("col_complaints"), "example": t("col_example"),
                                     "example_en": t("col_example_en"),
                                     "share": t("col_share")}),
                 hide_index=True, width="stretch",
                 # narrow numbers, room for the quote and its translation
                 column_config={t("col_problem"): st.column_config.TextColumn(width="medium"),
                                t("owner_team"): st.column_config.TextColumn(width="small"),
                                t("col_complaints"): st.column_config.NumberColumn(width="small"),
                                t("col_example"): st.column_config.TextColumn(width="medium"),
                                t("col_example_en"): st.column_config.TextColumn(width="large"),
                                t("col_share"): st.column_config.TextColumn(width="small")})


def brief_view(b, quotes_en=None):
    st.write(b.get("summary", ""))
    from translate import quotes_in
    for item in b.get("fix_first", []):
        ev = item.get("evidence", "")
        # English mode: the Chinese quote stays, its translation goes underneath in small gray text
        en = [quotes_en[q] for q in quotes_in(ev) if quotes_en and q in quotes_en] if not zh() else []
        en_line = (f"  \n<span style='color:#8a8a8a;font-size:0.85em'>{'; '.join(en)}</span>") if en else ""
        st.markdown(f"**{item.get('issue', '')}** ({item.get('owner', '')})  \n"
                    f"{t('evidence')}: {ev}{en_line}  \n{t('next_step')}: {item.get('action', '')}",
                    unsafe_allow_html=True)
    if b.get("keep_doing"):
        st.markdown(f"**{t('keep')}:** " + "; ".join(b["keep_doing"]))
    st.caption(t("brief_caption", m=b.get("model") or "LLM"))


def hidden_issues(R, A):
    neg = A[A.sentiment == "negative"][["review_id", "aspect_show", "evidence"]]
    hid = R[R.hidden_issue].merge(neg, on="review_id", how="left")
    if hid.empty:
        st.info(t("none"))
        return
    cols = (["rating"] if R.rating.notna().any() else []) + ["aspect_show", "evidence", "text"]
    st.dataframe(hid[cols].rename(columns={"rating": t("col_stars1"), "aspect_show": t("col_problem"),
                                           "evidence": t("col_quote"), "text": t("col_review")}),
                 hide_index=True, width="stretch", height=300)


def explorer(R, A, key):
    f1, f2 = st.columns(2)
    opts = ["positive", "neutral", "negative"]
    sent = f1.multiselect(t("f_sent"), opts, default=["negative"], format_func=sent_label, key=key + "s")
    anyl = t("any")
    asp = f2.selectbox(t("f_aspect"), [anyl] + sorted(A.aspect_show.dropna().unique()), key=key + "a")
    view = R[R.overall_sentiment.isin(sent)] if sent else R
    if asp != anyl:
        view = view[view.review_id.isin(A[A.aspect_show == asp].review_id)]
    cols = [c for c in ["category", "rating", "human_label", "overall_sentiment", "repurchase", "root_cause",
                        "title", "text"] if c in view and view[c].notna().any()]
    st.dataframe(view[cols], hide_index=True, width="stretch", height=360)


def insights_tab(dataset, data):
    R_all, G = data["reviews"], data["groups"]
    A_all = localize_aspects(data["aspects"])
    briefs = briefs_for(data)
    gids = G.sort_values("reviews", ascending=False).group_id.tolist()
    label = t("category") if dataset == "jd" else t("product")
    choice = st.selectbox(label, ["__all__"] + gids,
                          format_func=lambda g: t("all") if g == "__all__" else group_name(dataset, g, briefs))
    R = R_all if choice == "__all__" else R_all[R_all.group_id == choice]
    A = A_all if choice == "__all__" else A_all[A_all.group_id == choice]

    kpis(R, "k_star_neg" if dataset == "amazon_tea" else "k_human_neg")

    if dataset == "jd" and choice == "__all__":
        st.subheader(t("h_teams"))
        st.caption(t("c_teams"))
        aspect_chart(A, by="owner_show", title_key="owner_team")
    else:
        st.subheader(t("h_aspects"))
        aspect_chart(A)
        st.caption(t("c_aspects"))

    st.subheader(t("h_fix"))
    fix_first(A, R, data.get("quotes_en"))

    if choice != "__all__" and choice in briefs:
        st.subheader(f"{t('h_brief')}: {briefs[choice].get('name', choice)}")
        brief_view(briefs[choice], data.get("quotes_en"))
    elif choice == "__all__":
        st.subheader(t("h_score"))
        board = G.copy()
        board["name"] = board.group_id.map(lambda g: group_name(dataset, g, briefs))
        if zh() and "top_negative_aspect" in board:
            en2zh = dict(zip(data["aspects"].aspect_label, data["aspects"].get("aspect_label_zh", data["aspects"].aspect_label)))
            board["top_negative_aspect"] = board.top_negative_aspect.map(lambda x: en2zh.get(x, x) if isinstance(x, str) else x)
        cols = ["name", "reviews"] + (["avg_rating"] if board.avg_rating.notna().any() else []) + \
               ["ai_negative_share", "hidden_issues", "top_negative_aspect"]
        st.dataframe(
            board.sort_values("ai_negative_share", ascending=False)[cols].rename(columns={
                "name": label, "reviews": t("col_reviews"), "avg_rating": t("col_stars"),
                "ai_negative_share": t("col_ainegs"), "hidden_issues": t("col_hidden"),
                "top_negative_aspect": t("col_top")}),
            hide_index=True, width="stretch",
            column_config={t("col_stars"): st.column_config.NumberColumn(format="%.2f"),
                           t("col_ainegs"): st.column_config.NumberColumn(format="percent")})
        st.caption(t("c_score", x=label if zh() else label.lower()))

    st.subheader(t("h_hidden"))
    hidden_issues(R, A)
    with st.expander(t("browse")):
        explorer(R, A, key=dataset)


def accuracy_tab(dataset, data):
    ev = data["eval"]
    if not ev:
        st.info(t("acc_none"))
        return
    o = ev["overall"]
    if dataset != "jd":
        st.warning(t("acc_amz_warn"))
    st.markdown(t("acc_ref", r=t("ref_human") if dataset == "jd" else t("ref_star")))
    c1, c2, c3, c4 = st.columns(4)
    c1.metric(t("a_agree"), f"{o['accuracy']:.1%}", help=t("a_agree_help"))
    c2.metric(t("a_agree_ex"), f"{o['accuracy_excl_neutral']:.1%}")
    c3.metric(t("a_prec"), f"{o['negative_precision']:.1%}", help=t("a_prec_help"))
    c4.metric(t("a_rec"), f"{o['negative_recall']:.1%}", help=t("a_rec_help"))
    st.caption(t("a_n", n=o["n"], p=o["neutral_share"]))
    if ev.get("manual_review"):
        m = ev["manual_review"]
        st.info(t("a_manual", r=m["reviewed"], a=m["ai_right"], l=m["label_right"], u=m["unclear"]))

    if ev.get("by_category"):
        cat_col = t("category")
        rows = [{cat_col: CATEGORY_NAME.get(k, {}).get(st.session_state.lang, k), "acc": v["accuracy"], "n": v["n"]}
                for k, v in ev["by_category"].items()]
        df = pd.DataFrame(rows)
        chart = (alt.Chart(df).mark_bar(cornerRadius=4, height=16, color=POS)
                 .encode(y=alt.Y(f"{cat_col}:N", sort="-x", title=None),
                         x=alt.X("acc:Q", scale=alt.Scale(domain=[0, 1]), axis=alt.Axis(format="%"), title=None),
                         tooltip=[cat_col, alt.Tooltip("acc:Q", format=".1%", title=t("a_agree")), "n"])
                 .properties(height=alt.Step(32), title=t("a_bycat")))
        st.altair_chart(chart, use_container_width=True)

    conf = pd.DataFrame(o["confusion"]).fillna(0).astype(int)
    conf.index = [sent_label(i) for i in conf.index]
    conf.columns = [sent_label(c) for c in conf.columns]
    st.markdown(t("a_conf"))
    st.dataframe(conf)
    if data["errors"] is not None and len(data["errors"]):
        with st.expander(t("a_read", n=len(data["errors"]))):
            st.caption(t("a_read_c"))
            st.dataframe(data["errors"], hide_index=True, width="stretch", height=360)


# ------------------------------------------------------------------ layout
GITHUB_URL = "https://github.com/bwu109-netizen/review-insight"

# The main page is the Stitch-style front end (ui/ + src/web_app.py). The built-in JD.com / Amazon
# examples are documented in the README and stay reachable at ?examples=1 (used for the README screenshots).
if st.query_params.get("examples") == "1":
    head, toggle = st.columns([5, 1])
    with toggle:
        st.radio("Language / 语言", ["en", "zh"], key="lang", horizontal=True,
                 format_func=lambda x: "English" if x == "en" else "中文", label_visibility="collapsed")
    with head:
        st.title("Review Insight")
    st.caption(t("subtitle"))
    st.markdown(f"**[{t('examples_link')} →]({GITHUB_URL}#examples)**  ·  [{t('github')}]({GITHUB_URL})")
    market = st.radio(t("market"), ["jd", "amazon_tea"], horizontal=True,
                      format_func=lambda m: {"jd": t("m_jd"), "amazon_tea": t("m_amz")}[m])
    data = load(market)
    if data is None:
        st.warning(t("no_data"))
    else:
        t1, t2, t3 = st.tabs([t("tab_insights"), t("tab_acc"), t("tab_method")])
        with t1:
            insights_tab(market, data)
        with t2:
            accuracy_tab(market, data)
        with t3:
            st.markdown(METHOD[st.session_state.lang])
else:
    import web_app

    web_app.main()
