/* Review Insight front end.
 *
 * Runs inside a Streamlit custom component (no build step). Markup and Tailwind classes follow the
 * Stitch prototypes in docs/stitch/ (S1-S7); copy, fields and behaviour follow docs/PRD.md.
 * Python (app.py / src/web_app.py) runs the analysis and sends progress and results back as args.
 */
(function () {
  "use strict";

  var GITHUB = "https://github.com/bwu109-netizen/review-insight";
  var LINKS = {
    how: GITHUB + "#what-it-does",
    examples: GITHUB + "#examples",
    method: GITHUB + "#results",
    claude: GITHUB + "#use-it-inside-claude-no-api-key",
    github: GITHUB,
  };
  // Column detection by name, most specific first. Seller exports (Douyin, Taobao, JD) also carry the
  // shop's reply and a follow-up review, which are often longer than the review itself, so length alone
  // picks the wrong column.
  var TEXT_NAMES = ["评价内容", "评论内容", "买家评价", "评价正文", "评论正文", "初评内容", "review text", "review content",
    "review body", "comment", "评价", "评论", "review", "content", "text", "内容"];
  var NOT_TEXT = ["回复", "reply", "追评", "follow", "商品名称", "商品规格", "规格", "昵称", "标题", "title", "name", "id"];
  var RATING_NAMES = ["评价得分", "商品评分", "评分", "得分", "星级", "打分", "rating", "score", "stars", "star"];
  var DATE_NAMES = ["评价日期", "评价时间", "评论时间", "评论日期", "日期", "时间", "date", "time"];
  var FOLLOW_NAMES = ["追评内容", "追加评论", "追评", "follow-up", "followup", "additional review"];
  var NOT_DATE = ["追评", "回复", "reply", "follow"];
  var NOT_FOLLOW = ["时间", "日期", "time", "date"];
  var OWNER_ZH = {
    "Product": "产品", "Product / Sourcing": "产品 / 采购", "Supply chain": "供应链",
    "Supply chain / QC": "供应链 / 质检", "Packaging": "包装", "Pricing": "定价",
    "Product / Content": "产品 / 内容", "Marketing claims": "营销宣传", "Logistics": "物流",
    "Listing / Content": "商品页 / 内容", "Listing": "商品页", "Customer service": "客服",
    "Operations": "运营",
  };
  var PROVIDER_ORDER = ["gemini", "deepseek", "openai", "claude", "qwen", "kimi", "glm", "custom"];
  var PROVIDER_NAMES = {
    gemini: ["Google Gemini", "Google Gemini"], deepseek: ["DeepSeek", "DeepSeek"],
    openai: ["OpenAI", "OpenAI"], claude: ["Anthropic Claude", "Anthropic Claude"],
    qwen: ["Qwen (Alibaba Cloud)", "通义千问"], kimi: ["Kimi (Moonshot)", "Kimi（月之暗面）"],
    glm: ["GLM (Zhipu)", "智谱 GLM"], custom: ["Other OpenAI-compatible", "其他 OpenAI 兼容接口"],
  };
  var PLATFORMS = {
    en: ["Taobao / Tmall", "JD.com", "Douyin", "RedNote (Xiaohongshu)", "WeChat Channels", "TikTok Shop", "Amazon", "Other"],
    zh: ["淘宝 / 天猫", "京东", "抖音", "小红书", "微信视频号", "TikTok Shop", "亚马逊", "其他"],
  };

  // ------------------------------------------------------------------ copy (PRD sections 5 and 10)
  var T = {
    nav_how: ["How it works", "方法"], nav_examples: ["Examples", "示例"], nav_github: ["GitHub", "GitHub"],
    nav_cta: ["Analyze reviews", "开始分析"], menu: ["Menu", "菜单"],

    hero_eyebrow: ["AI Review Analysis", "AI 评论分析"],
    hero_a: ["Thousands of reviews.", "成千上万条评论，"],
    hero_b: [" One ranked fix list.", "一份排好序的待办清单。"],
    hero_sub: ["Upload a seller export or paste comments. AI picks the aspects for your category, labels every review, and tells each team what to fix first.",
      "上传后台导出的评价或直接粘贴评论。AI 按品类选出分析维度、逐条打标签，并告诉每个团队先改什么。"],
    hero_cta: ["Analyze reviews", "开始分析"], hero_examples: ["View example results", "查看示例结果"],
    scroll: ["SCROLL", "向下滚动"],

    stat1: ["Agreement with human labels", "与人工标签一致率"],
    stat2: ["JD.com reviews tested", "京东评论验证条数"], stat2_u: ["reviews", "条"],
    stat3: ["AI providers supported", "可选 AI 服务商"], stat3_u: ["providers", "种"],
    stat_note: ["98% when the AI commits to positive or negative. Method on GitHub", "AI 明确判好评或差评时一致率 98%，方法见 GitHub"],

    prob_eyebrow: ["The problem #001 — #004", "问题 #001 — #004"],
    prob_a: ["Your team shouldn't read every review.", "没人有时间读完每一条评论，"],
    prob_b: ["But someone has to.", "但总得有人读。"],
    prob_p: ["Reviews are scattered, mixed and messy. A star average hides operational problems until customers stop coming back.",
      "评论分散、好坏参半、格式杂乱。只看平均星级，运营问题会一直藏到顾客不再回购。"],
    p1t: ["Thousands of reviews, no time", "评论太多，没时间看"], p1d: ["Every back-end can export them. Nobody reads them.", "后台都能导出，但没人读。"],
    p2t: ["Problems hide in 5-star reviews", "问题藏在五星好评里"], p2d: ["“Great tea, but only 90 of 100 bags arrived.”", "「茶很好，但 100 包只到了 90 包」"],
    p2c1: ["Missing items", "少发漏发"], p2c2: ["Hidden in 5 stars", "藏在五星里"], p2tag: ["CRITICAL", "重点"],
    p3t: ["No owner for each complaint", "投诉没人认领"], p3d: ["Packaging, logistics or product? Nobody knows who should act.", "是包装、物流还是产品？不知道该谁改。"],
    p4t: ["Star ratings miss the why", "星级说不出原因"], p4d: ["A 3.8 average doesn't tell you what to fix.", "3.8 分的均分说不出该改什么。"],

    tool_eyebrow: ["Analyze", "开始分析"], tool_a: ["Three steps.", "三步设置，"], tool_b: [" Results in minutes.", "几分钟出结果。"],
    tool_sub: ["AI reads every review, picks the aspects for your category and writes the fix list.", "AI 逐条阅读评论，按品类选出维度，并写出待办清单。"],
    s1: ["01 · Reviews", "01 · 评论"], s2: ["02 · AI model", "02 · AI 模型"], s3: ["03 · Scale", "03 · 分析规模"],
    required: ["Required", "必填"], ready: ["Ready", "已就绪"],
    f_cat: ["Product category", "商品品类"], ph_cat: ["e.g. fruit, desk, laptop", "例如：水果、桌子、笔记本电脑"],
    f_plat: ["Platform", "平台"], f_source: ["Review source", "评论来源"], limit: ["200MB limit", "上限 200MB"],
    tab_upload: ["Upload file", "上传文件"], tab_paste: ["Paste", "粘贴"],
    drop_a: ["Drop a CSV or Excel export here, or ", "把 CSV 或 Excel 导出文件拖到这里，或"], browse: ["browse", "选择文件"],
    drop_b: ["CSV or XLSX up to 200MB. UTF-8 and GBK are detected automatically.", "支持 CSV、XLSX，200MB 以内，自动识别 UTF-8 和 GBK 编码。"],
    reading: ["Reading file", "正在读取"], rows: ["rows", "行"], remove: ["Remove", "移除"], file_ok: ["File read", "读取成功"],
    detected: ["Detected:", "已识别："], d_text: ["review text", "评论"], d_rating: ["rating", "评分"], d_date: ["date", "日期"],
    change: ["Change", "修改"], done_map: ["Done", "完成"], none: ["(none)", "（无）"],
    map_text: ["Review text column", "评论内容列"], map_rating: ["Star rating column (optional)", "评分列（可选）"],
    map_date: ["Date column (optional)", "日期列（可选）"],
    map_follow: ["Follow-up review column (optional)", "追评列（可选）"], d_follow: ["follow-up", "追评"],
    preview: ["Preview · first 3 reviews", "预览 · 前 3 条评论"], pv_text: ["Review text sent to AI", "发给 AI 的评论"],
    pv_rating: ["Rating", "评分"], pv_date: ["Date", "日期"],
    map_note: ["Rating and date are used to keep each star level and month at its real share when sampling, and to spot problems inside satisfied reviews.",
      "评分列和日期列用于按星级和月份分层抽样，并识别「5 星但有问题」的隐藏问题。"],
    ready_n: ["{n} reviews ready", "已读入 {n} 条"], removed: ["({m} empty or duplicate removed)", "（已去掉 {m} 条空白或重复）"],
    err_nousable: ["No usable reviews found. Check the review text column.", "没有找到可用的评论，请检查评论列。"],
    err_read: ["Couldn't read this file. Save it as CSV (UTF-8 or GBK) or XLSX.", "无法读取这个文件，请另存为 CSV（UTF-8 或 GBK）或 XLSX。"],
    paste_ph: ["Paste reviews here, one per line", "在这里粘贴评论，每行一条"],

    free: ["Free tier", "免费"], paid: ["Paid", "付费"],
    f_provider: ["Provider", "服务商"], f_model: ["Model", "模型"],
    ph_model: ["Model name from your provider's console", "填你在服务商后台看到的模型名"],
    f_key: ["API key", "API key"], ph_key: ["Paste your API key", "粘贴你的 API key"],
    key_opt: ["Optional: a free Gemini key is configured", "可不填：已配置免费 Gemini key"],
    privacy: ["Used for this session only, never stored.", "只在本次使用，不会保存。"],
    get_key: ["Get a key", "申请 key"], f_base: ["Base URL (OpenAI-compatible)", "Base URL（OpenAI 兼容接口）"],
    advanced: ["Advanced", "高级设置"],
    err_key: ["This key was rejected. Check it and try again.", "这个 key 无效，请检查后重试。"],
    err_model: ["Model not found. Copy the exact name from your provider's console.", "找不到这个模型，请从服务商后台复制准确的模型名。"],
    err_base: ["Fill in the base URL of the OpenAI-compatible endpoint.", "请填写 OpenAI 兼容接口的 Base URL。"],
    check_key: ["Check your key at {u}", "去 {u} 检查 key"], retry: ["Try again", "重试"],
    show_key: ["Show or hide the key", "显示或隐藏 key"], clear_key: ["Clear", "清空"],

    detected_n: ["{n} reviews detected", "共 {n} 条评论"],
    tier_free: ["{n} reviews uploaded. With Gemini's free tier, a random sample of {s} will be analyzed (shares within about ±2%). Switch to a paid provider to analyze up to {lim}.",
      "共 {n} 条，Gemini 免费额度下将随机抽 {s} 条分析（占比误差约 ±2%）。换用付费接口可分析最多 {lim} 条。"],
    opt_sample: ["Sample {s}", "抽样 {s} 条"], opt_sample_d: ["About {m} min · shares within ±2%", "约 {m} 分钟 · 占比误差约 ±2%"],
    recommended: ["Recommended", "推荐"], opt_sample_f: ["Best speed / accuracy balance", "速度和准确度最平衡"],
    opt_all: ["All {n}", "全部 {n} 条"], opt_max: ["Sample {n} (max)", "抽样 {n} 条（上限）"],
    opt_all_d: ["About {m} min · better for rare issues and per-month breakdowns", "约 {m} 分钟 · 适合找少见问题、按月细分"],
    exhaustive: ["Exhaustive", "全量"], opt_all_f: ["Covers rare issues", "覆盖少见问题"],
    over_limit: ["To label every review, use the command-line version on GitHub.", "如需全部标注，请用 GitHub 上的命令行版本。"],
    strat_note: ["Sampling keeps each star level and month at its real share.", "抽样时各星级、月份保持真实比例。"],

    analyze: ["Analyze reviews", "开始分析"], analyze_n: ["Analyze {n} reviews", "分析 {n} 条评论"],
    est: ["{n} reviews · about {m} min", "{n} 条 · 约 {m} 分钟"], keep_open: ["Keep this tab open", "完成前请不要关闭页面"],
    start_hint: ["Fill in a category, add reviews, and add an API key to start", "填写品类、添加评论并提供 API key 后即可开始"],
    still: ["Still needed: {x}", "还差：{x}"], need_cat: ["category", "品类"], need_rev: ["reviews", "评论"],
    need_key: ["API key", "API key"], need_model: ["model", "模型"], need_base: ["base URL", "Base URL"],
    trust1: ["Key not stored", "不保存 key"], trust2: ["Results stay in this session", "结果只留在本次会话"],
    trust3: ["Sent only to your AI provider", "只发给你选的 AI 服务商"],
    feat1t: ["Aspects per category", "按品类选维度"], feat1d: ["AI reads your reviews and picks 6-10 aspects, each with an owner team.", "AI 读取评论，选出 6-10 个分析维度，每个维度对应一个负责团队。"],
    feat2t: ["Every review labeled", "逐条打标签"], feat2d: ["Sentiment, aspects, root cause and repurchase signal for each review.", "每条评论标注情感、维度、根因和复购信号。"],
    feat3t: ["Hidden issues", "隐藏问题"], feat3d: ["Finds concrete problems inside reviews from satisfied customers.", "找出满意顾客评论里提到的具体问题。"],
    err_general: ["Something went wrong: {e}", "出错了：{e}"],
    sum_edit: ["Edit", "修改"],

    prog_title: ["Analysis in progress", "正在分析"], stage: ["Stage {a} of 4", "第 {a} / 4 步"],
    st1: ["Reading file", "读取文件"], st1d: ["{n} reviews read", "已读入 {n} 条"],
    st2: ["Choosing aspects for this category", "为这个品类生成分析维度"], st2d: ["{n} aspects chosen", "选出 {n} 个维度"],
    st3: ["Labeling reviews", "逐条标注"], batch: ["Batch {a}/{b}", "第 {a}/{b} 批"],
    st4: ["Writing the ops brief", "撰写运营简报"], pending: ["Pending", "等待中"], working: ["Working", "进行中"],
    left: ["About {m} min left", "预计还剩 {m} 分钟"], left_s: ["Less than a minute left", "预计不到 1 分钟"],
    estimating: ["Estimating time", "正在估算时间"], completed: ["{p}% completed", "已完成 {p}%"],
    stop: ["Stop and show results so far", "停止并查看已完成部分"], stopping: ["Stopping after the current requests", "正在停止，等待当前请求返回"],

    res_eyebrow: ["Results", "结果"], res_a: ["{c}, {n} reviews.", "{c}，{n} 条评论。"], res_b: [" Here's what to fix first.", "先改这几件事。"],
    scope_all: ["Analyzed all {n} reviews.", "已分析全部 {n} 条评论。"],
    scope_sample: ["Analyzed a random sample of {n} out of {t} reviews", "从 {t} 条评论中随机抽取 {n} 条分析"],
    scope_strat: [", keeping each star level and month at its real share.", "，各星级、月份按实际比例抽取。"], period: [".", "。"],
    copy: ["Copy brief", "复制简报"], copied: ["Copied", "已复制"], download: ["Download CSV", "下载 CSV"], new_run: ["New analysis", "重新分析"],
    k_rev: ["Reviews analyzed", "分析评论数"], k_rev_m: ["±{m}% margin at 95%", "95% 置信误差 ±{m}%"], k_rev_all: ["All reviews", "全部评论"],
    k_neg: ["Negative overall", "AI 判为差评"], k_neg_s: ["{n} negative reviews", "{n} 条差评"],
    k_hid: ["Hidden issues", "隐藏问题"], k_hid_s: ["Satisfied, but reported a problem", "整体满意但提到问题"],
    k_hid_help: ["Reviews that are happy overall but still mention a concrete problem.", "整体满意、但仍提到具体问题的评论。"],
    partial: ["The run stopped early, so these results cover {d} of {n} reviews.", "分析中途停止，以下结果只包含 {n} 条中的 {d} 条。"],
    reason: ["Reason: {r}", "原因：{r}"], r_quota: ["daily quota used up or rate limited", "额度用完或被限流"],
    r_stop: ["you stopped the run", "你手动停止了分析"], partial_new: ["Run a new analysis", "重新分析"],
    safety_title: ["Food safety alert", "食品安全警示"],
    safety_n: ["{n} reviews", "{n} 条评论"],
    safety_desc: ["Reviews that mention insects, foreign objects, hair, mold or spoilage. Shown however few there are: check each one and the batch it came from.",
      "提到虫、异物、头发、发霉、变质等的评论。不论条数多少都单独列出：请逐条核实，并追查对应批次。"],
    safety_more: ["Show all {n}", "查看全部 {n} 条"],
    fix_title: ["Fix first", "先改什么"], fix_rank: ["Ranked by impact", "按影响排序"], team: ["TEAM", "团队"],
    complaints: ["{n} complaints · {p}% of reviews", "{n} 条投诉 · 占 {p}%"], next: ["Next step:", "下一步："],
    see_all: ["See all {n} quotes", "查看全部 {n} 条原话"], hide_quotes: ["Hide quotes", "收起原话"],
    no_complaints: ["No clear complaints found in these reviews.", "这批评论里没有发现明显投诉。"],
    brief_fail: ["Labels are ready, but the ops brief could not be generated.", "标注已完成，但运营简报生成失败。"],
    fallback: ["Showing the aspects with the most complaints instead.", "下面按投诉数显示问题最多的维度。"],
    summary: ["Summary", "总结"], keep: ["Keep doing", "继续保持"],
    written_by: ["Written by {m} from the aggregated labels", "由 {m} 根据汇总标签生成"],
    pos_ratio: ["Positive : negative = {r} : 1", "好评 : 差评 = {r} : 1"], view_pos: ["View positive reviews", "查看好评"],
    chart_title: ["What customers talk about, and how they feel", "顾客在聊什么，态度如何"],
    chart_legend_a: ["Left: complaints", "左：投诉"], chart_legend_b: ["Right: praise", "右：好评"],
    chart_click: ["Click an aspect to filter the reviews below", "点击维度可筛选下方评论"],
    tip: ["{a} · {o} · complaints {n} · praise {p} · neutral {u}", "{a} · {o} · 投诉 {n} · 好评 {p} · 中性 {u}"],
    hid_title: ["Hidden issues in satisfied reviews", "满意评论里的隐藏问题"],
    hid_desc: ["Customers who were happy overall but still reported a concrete problem. Star ratings miss these.",
      "整体满意、但仍提到具体问题的评论，只看星级会漏掉。"],
    hid_total: ["{n} found", "共 {n} 条"], show_all: ["Show all {n}", "查看全部 {n} 条"], show_less: ["Show less", "收起"],
    none_found: ["None found", "没有发现"],
    r6_title: ["All labeled reviews", "全部标注结果"], search_ph: ["Search reviews", "搜索评论"],
    all: ["All", "全部"], s_negative: ["Negative", "差评"], s_positive: ["Positive", "好评"], s_neutral: ["Neutral", "中性"],
    any_aspect: ["All aspects", "全部维度"], showing: ["Showing {a} of {b}", "显示 {b} 条中的 {a} 条"],
    th_review: ["Review", "评论"], th_sent: ["Sentiment", "情感"], th_aspects: ["Aspects", "维度"],
    th_root: ["Root cause", "根因"], th_rep: ["Repurchase", "复购"],
    rp_yes: ["Would buy again", "会回购"], rp_no: ["Won't buy again", "不会回购"], rp_unclear: ["Unclear", "不明确"],
    page: ["Page {a} of {b}", "第 {a} / {b} 页"], prev: ["Previous", "上一页"], next_p: ["Next", "下一页"],
    no_match: ["No reviews match these filters", "没有符合筛选条件的评论"], clear: ["Clear filters", "清除筛选"],
    r7_title: ["Aspects chosen by AI for this category ({n})", "AI 为这个品类选的分析维度（{n} 个）"],
    r7_note: ["Aspects are generated from a sample of your reviews.", "维度由 AI 读取部分评论后生成。"],
    r7_tea: ["Tea uses a hand-written aspect list from the author's tea e-commerce work.", "茶叶使用作者根据茶叶电商经验手写的维度表。"],
    f_how: ["How it works", "方法说明"], f_claude: ["Use in Claude (no API key)", "在 Claude 里用（无需 API）"],
    f_built: ["Built by Boxiao Wu", "作者：吴博潇"],
  };

  // ------------------------------------------------------------------ state
  // The iframe can be 0px wide while it loads, so ask the parent page for the real width.
  var isMobile = (function () {
    try { return window.parent.innerWidth < 640; } catch (e) { return window.innerWidth > 0 && window.innerWidth < 640; }
  })();
  var S = {
    lang: "en",
    args: null,
    form: {
      category: "", platform: 0, source: isMobile ? "paste" : "file", paste: "",
      file: null, fileLoading: false, fileError: "", showMap: false,
      provider: "gemini", models: {}, keys: {}, base: "", keyVisible: false, scale: "sample",
    },
    ui: { menu: false, editTool: false, fixOpen: {}, hidAll: false, hidOpen: {}, stopping: false,
      r6: { q: "", sent: "negative", aspect: "", page: 0, open: {} } },
    evt: 0, ackFor: 0, jobSig: "", resultId: null, rendered: false,
  };

  function lang() { return S.lang === "zh" ? 1 : 0; }
  function t(key, vars) {
    var s = (T[key] || [key, key])[lang()];
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmt(n) { return Number(n || 0).toLocaleString("en-US"); }
  function $(id) { return document.getElementById(id); }
  function icon(name, cls) { return '<span class="material-symbols-outlined ' + (cls || "") + '">' + name + "</span>"; }
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ------------------------------------------------------------------ Streamlit bridge (component protocol v1)
  function post(type, data) {
    var msg = Object.assign({ isStreamlitMessage: true, type: type }, data || {});
    window.parent.postMessage(msg, "*");
  }
  function send(type, payload, big) {
    S.evt += 1;
    if (big) S.ackFor = S.evt;
    post("streamlit:setComponentValue", { value: Object.assign({ id: S.evt, type: type }, payload || {}), dataType: "json" });
  }
  function frameHeight() {
    var h = 900;
    try { h = window.parent.innerHeight || h; } catch (e) { /* cross-origin fallback */ }
    return h;
  }
  function syncHeight() {
    var h = frameHeight();
    document.documentElement.style.setProperty("--vh", h + "px");
    $("scroller").style.height = h + "px";
    post("streamlit:setFrameHeight", { height: h });
  }

  window.addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "streamlit:render") return;
    onRender(e.data.args || {});
  });

  function onRender(args) {
    S.args = args;
    if (args.handled && S.evt < args.handled) S.evt = args.handled; // ids keep counting after a reconnect
    // A big event (the reviews) has been handled: replace the stored widget value with a small one,
    // otherwise Streamlit would send the reviews back on every rerun.
    if (S.ackFor && args.handled >= S.ackFor) { S.ackFor = 0; send("ack"); }

    var job = args.job || {};
    var sig = [job.id, job.status, job.error_kind || ""].join("|");
    var res = args.result || null;
    var resId = res ? res.id : null;
    if (!S.rendered) {
      S.rendered = true;
      if (args.lang) S.lang = args.lang;
      renderAll();
      if (resId) S.resultId = resId;
      return;
    }
    if (sig !== S.jobSig) {
      if (job.status !== "running") S.ui.stopping = false;
      S.jobSig = sig;
      renderTool();
      if (job.status === "error") scrollToEl($("tool-action"), 160);
    } else if (job.status === "running") {
      renderProgress();
    }
    if (resId !== S.resultId) {
      S.resultId = resId;
      S.ui.editTool = false;
      S.ui.fixOpen = {}; S.ui.hidAll = false; S.ui.hidOpen = {}; S.ui.safetyAll = false;
      S.ui.r6 = { q: "", sent: "negative", aspect: "", page: 0, open: {} };
      renderTool();
      renderResults();
      if (resId) setTimeout(function () { scrollToEl($("results"), 96); }, 60);
    }
  }

  // ------------------------------------------------------------------ helpers
  function scroller() { return $("scroller"); }
  function scrollToEl(el, offset) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + scroller().scrollTop - (offset == null ? 88 : offset);
    scroller().scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
  }
  function cfg() { return (S.args && S.args.cfg) || {}; }
  function job() { return (S.args && S.args.job) || { status: "idle" }; }
  function result() { return (S.args && S.args.result) || null; }
  function running() { return job().status === "running"; }
  function providerCfg(p) { return (cfg().providers || {})[p || S.form.provider] || {}; }
  function kindOf(p) { return (p || S.form.provider) === "gemini" ? "gemini" : "default"; }
  function modelOf(p) {
    p = p || S.form.provider;
    return S.form.models[p] != null ? S.form.models[p] : (providerCfg(p).model || "");
  }
  function keyOf(p) { return S.form.keys[p || S.form.provider] || ""; }
  function serverKey() { return S.form.provider === "gemini" && !!cfg().server_gemini_key; }
  function estMinutes(n, kind) {
    var sp = (cfg().speed || {})[kind] || [60, 8, 20];
    var calls = Math.ceil(n / sp[2]) + 2;
    var m = Math.max(sp[0] ? calls / sp[0] : 0, calls * 10 / 60 / Math.max(sp[1], 1));
    return Math.max(1, Math.round(m));
  }
  function sampleSize() { return cfg().sample || 2000; }
  function limitFor(kind) { return ((cfg().limits || {})[kind]) || (kind === "gemini" ? 2000 : 10000); }

  // Mirrors custom.clean_reviews: trim, drop shorter than 2 characters, drop duplicates.
  function cleanCount(texts) {
    var seen = new Set();
    texts.forEach(function (x) {
      var s = (x == null ? "" : String(x)).trim();
      if (s.length >= 2) seen.add(s);
    });
    return seen.size;
  }
  function pasteLines() {
    return S.form.paste.split(/\r?\n/).filter(function (l) { return l.trim(); });
  }
  function sourceTexts() {
    var f = S.form;
    if (f.source === "paste") return pasteLines();
    if (!f.file) return [];
    var fl = f.file;
    return fl.rows.map(function (r) { return reviewText(fl, r); });
  }
  function counts() {
    var texts = sourceTexts();
    var valid = cleanCount(texts);
    return { raw: texts.length, valid: valid, removed: texts.length - valid };
  }
  function nUse(valid) {
    var kind = kindOf(), s = sampleSize();
    if (valid <= s) return valid;
    if (kind === "gemini") return s;
    return S.form.scale === "sample" ? s : Math.min(valid, limitFor(kind));
  }
  function missing() {
    var f = S.form, out = [];
    if (!f.category.trim()) out.push(t("need_cat"));
    if (!counts().valid) out.push(t("need_rev"));
    if (!keyOf() && !serverKey()) out.push(t("need_key"));
    if (!modelOf().trim()) out.push(t("need_model"));
    if (f.provider === "custom" && !f.base.trim()) out.push(t("need_base"));
    return out;
  }
  function step1Done() { return !!S.form.category.trim() && counts().valid > 0; }
  function step2Done() {
    return (!!keyOf() || serverKey()) && !!modelOf().trim() && (S.form.provider !== "custom" || !!S.form.base.trim());
  }

  // ------------------------------------------------------------------ nav + footer
  function renderNav() {
    var en = S.lang === "en";
    var langSw = '<button class="font-eyebrow-mono text-eyebrow-mono select-none cursor-pointer transition-colors" data-act="lang" type="button">' +
      '<span class="' + (en ? "text-primary" : "text-text-tertiary hover:text-primary") + '">EN</span>' +
      '<span class="text-text-tertiary"> | </span>' +
      '<span class="' + (!en ? "text-primary" : "text-text-tertiary hover:text-primary") + '">中</span></button>';
    var link = function (href, key) {
      return '<a class="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="' + href + '" rel="noopener" target="_blank">' + t(key) + "</a>";
    };
    var html =
      '<header class="pointer-events-auto mt-4 w-full max-w-[720px] h-12 bg-surface-card/80 backdrop-blur-xl border border-border-hairline rounded-full px-6 flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] relative">' +
      '<a class="flex items-center gap-2 group" data-act="top" href="#"><div class="w-5 h-5 rounded-full border border-border-focus flex items-center justify-center transition-colors group-hover:border-primary"><div class="w-1.5 h-1.5 rounded-full bg-primary"></div></div><span class="font-label-pill text-label-pill text-primary tracking-tight">Review Insight</span></a>' +
      '<nav class="hidden sm:flex items-center gap-space-lg">' + link(LINKS.how, "nav_how") + link(LINKS.examples, "nav_examples") + link(LINKS.github, "nav_github") + "</nav>" +
      '<div class="flex items-center gap-space-md">' + langSw +
      '<a class="hidden sm:flex bg-primary text-on-primary font-label-pill text-label-pill px-3.5 py-1.5 rounded-full hover:bg-primary/90 transition-opacity items-center justify-center" data-act="to-tool" href="#">' + t("nav_cta") + "</a>" +
      '<button aria-label="' + t("menu") + '" class="sm:hidden w-8 h-8 -mr-2 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary" data-act="menu" type="button">' + icon(S.ui.menu ? "close" : "menu", "text-[20px]") + "</button>" +
      "</div>" +
      (S.ui.menu
        ? '<div class="sm:hidden absolute top-14 right-0 w-56 bg-surface-card/95 backdrop-blur-xl border border-border-hairline rounded-xl p-2 flex flex-col">' +
          [["how", "nav_how"], ["examples", "nav_examples"], ["github", "nav_github"]].map(function (x) {
            return '<a class="px-3 py-3 rounded-lg font-body-md text-body-md text-on-surface-variant hover:text-primary hover:bg-surface-interactive" href="' + LINKS[x[0]] + '" rel="noopener" target="_blank">' + t(x[1]) + "</a>";
          }).join("") +
          '<a class="mt-1 bg-primary text-on-primary font-label-pill text-label-pill px-3.5 py-3 rounded-full text-center" data-act="to-tool" href="#">' + t("nav_cta") + "</a></div>"
        : "") +
      "</header>";
    $("nav").innerHTML = html;
  }

  function renderFooter() {
    var a = function (href, key) {
      return '<span><a class="hover:text-on-surface transition-colors" href="' + href + '" rel="noopener" target="_blank">' + t(key) + "</a></span>";
    };
    var dot = '<span class="opacity-40">·</span>';
    $("footer").innerHTML =
      '<div class="max-w-7xl mx-auto px-space-md text-center font-eyebrow-mono text-eyebrow-mono text-text-tertiary flex flex-wrap justify-center items-center gap-2">' +
      a(LINKS.how, "f_how") + dot + a(LINKS.github, "nav_github") + dot + a(LINKS.claude, "f_claude") + dot +
      '<span class="text-on-surface-variant">' + t("f_built") + "</span></div>";
  }

  // ------------------------------------------------------------------ S1: hero, stats band, problem list
  function renderLanding() {
    var d = function (i) { return ' style="animation-delay:' + i * 80 + 'ms"'; };
    var stat = function (label, value, unit, unitCls) {
      return '<div class="py-6 md:py-0 md:px-6 flex flex-col items-center justify-center">' +
        '<span class="font-eyebrow-mono text-eyebrow-mono text-outline uppercase tracking-wider mb-2">' + t(label) + "</span>" +
        '<div class="flex items-baseline justify-center">' +
        '<span class="font-stat-xl text-stat-xl-mobile md:text-stat-xl font-light text-primary tracking-tight font-tabular" data-count="' + value + '">' + (reduceMotion ? value : 0) + "</span>" +
        '<span class="' + unitCls + '">' + unit + "</span></div></div>";
    };
    var item = function (n, tk, dk, extra) {
      return '<div class="' + extra + ' group cursor-default transition-all duration-300 ri-problem">' +
        '<div class="ri-problem-box p-0 rounded-xl border border-transparent transition-all duration-150 relative overflow-hidden">' +
        '<div class="ri-problem-bar absolute top-0 left-0 w-1 h-full bg-primary opacity-0 transition-opacity"></div>' +
        '<div class="flex items-center justify-between">' +
        '<div class="flex items-center gap-4"><span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary ri-problem-num">#00' + n + "</span>" +
        '<h3 class="font-headline-sm text-body-lg text-primary font-medium tracking-tight">' + t(tk) + "</h3></div>" +
        icon("unfold_more", "text-[18px] text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity hidden lg:inline") + "</div>" +
        '<p class="font-body-sm text-body-sm text-outline mt-1.5 pl-10">' + t(dk) + "</p></div></div>";
    };
    var html =
      // Hero (M1)
      '<section class="relative flex flex-col items-center justify-center text-center pt-12 md:pt-20 px-space-md min-h-[calc(var(--vh,100vh)-80px)] md:min-h-0">' +
      '<div class="ri-enter inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high/60 border border-border-hairline mb-8 backdrop-blur-sm"' + d(0) + ">" +
      '<span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>' +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-outline tracking-[0.2em] uppercase">' + t("hero_eyebrow") + "</span></div>" +
      '<h1 class="ri-enter font-headline-xl text-[36px] leading-[42px] sm:text-headline-xl md:text-stat-xl tracking-tight max-w-4xl mx-auto font-light md:leading-[1.08]"' + d(1) + ">" +
      '<span class="text-primary font-light">' + t("hero_a") + "</span>" +
      '<span class="text-text-tertiary block sm:inline font-light">' + t("hero_b") + "</span></h1>" +
      '<p class="ri-enter font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed mt-6"' + d(2) + ">" + t("hero_sub") + "</p>" +
      '<div class="ri-enter mt-10 flex flex-col sm:flex-row flex-wrap gap-4 justify-center items-stretch sm:items-center w-full sm:w-auto"' + d(3) + ">" +
      '<a class="bg-primary text-on-primary font-label-pill text-label-pill px-7 py-3 rounded-full hover:bg-white hover:shadow-[0_0_24px_rgba(255,255,255,0.18)] transition-all flex items-center justify-center gap-2 group" data-act="to-tool" href="#">' +
      "<span>" + t("hero_cta") + "</span>" + icon("arrow_forward", "text-[16px] transition-transform group-hover:translate-x-0.5") + "</a>" +
      '<a class="font-label-pill text-label-pill bg-transparent border border-border-focus text-primary px-6 py-3 rounded-full hover:border-primary transition-all flex items-center justify-center gap-2" href="' + LINKS.examples + '" rel="noopener" target="_blank">' +
      "<span>" + t("hero_examples") + '</span><span class="text-text-tertiary">→</span></a></div>' +
      '<div class="ri-enter mt-20 flex flex-col items-center gap-3"' + d(4) + ">" +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary tracking-widest uppercase">' + t("scroll") + "</span>" +
      '<div class="ri-float w-[1px] h-8 bg-gradient-to-b from-primary/30 to-transparent"></div></div></section>' +
      // Stats band (M1b)
      '<section class="max-w-5xl w-full mx-auto mt-24 px-space-md reveal">' +
      '<div class="border-t border-b border-border-hairline py-12 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border-hairline text-center">' +
      stat("stat1", 89, "%", "font-headline-md text-headline-md text-outline font-light ml-1") +
      stat("stat2", 900, t("stat2_u"), "font-code-md text-code-md text-outline ml-2") +
      stat("stat3", 8, t("stat3_u"), "font-code-md text-code-md text-outline ml-2") +
      "</div>" +
      '<div class="text-center mt-6"><a class="font-eyebrow-mono text-eyebrow-mono text-outline hover:text-primary transition-colors inline-flex items-center gap-1.5" href="' + LINKS.method + '" rel="noopener" target="_blank">' +
      "<span>" + t("stat_note") + '</span><span class="text-text-tertiary">→</span></a></div></section>' +
      // Problem list (M1c)
      '<section class="max-w-5xl w-full mx-auto mt-28 mb-20 px-space-md reveal">' +
      '<div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">' +
      '<div class="lg:col-span-5 flex flex-col gap-5 lg:sticky lg:top-28">' +
      '<div class="inline-flex items-center gap-2"><span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary tracking-[0.14em] uppercase">' + t("prob_eyebrow") + "</span></div>" +
      '<h2 class="font-headline-lg text-headline-lg font-light leading-snug tracking-tight"><span class="text-primary font-light">' + t("prob_a") + "</span><br/>" +
      '<span class="text-text-tertiary font-light">' + t("prob_b") + "</span></h2>" +
      '<p class="font-body-md text-body-md text-on-surface-variant max-w-sm mt-2">' + t("prob_p") + "</p></div>" +
      '<div class="lg:col-span-7 flex flex-col divide-y divide-dashed divide-border-hairline" id="problems">' +
      item(1, "p1t", "p1d", "py-6 first:pt-0") +
      // #002 starts highlighted, as in the prototype; hovering another item moves the highlight (PRD M1c)
      '<div class="py-5 ri-problem is-active" data-default="1">' +
      '<div class="ri-problem-box p-5 rounded-xl border border-border-focus bg-surface-container-low transition-all duration-150 relative overflow-hidden shadow-sm">' +
      '<div class="ri-problem-bar absolute top-0 left-0 w-1 h-full bg-primary"></div>' +
      '<div class="flex items-center justify-between"><div class="flex items-center gap-4">' +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-primary font-semibold ri-problem-num">#002</span>' +
      '<h3 class="font-headline-sm text-body-lg text-primary font-medium tracking-tight">' + t("p2t") + "</h3></div>" +
      '<span class="font-eyebrow-mono text-[10px] px-2 py-0.5 rounded border border-border-hairline bg-surface-container-highest text-primary">' + t("p2tag") + "</span></div>" +
      '<p class="font-body-sm text-body-sm text-outline mt-2 pl-10">' + t("p2d") + "</p>" +
      '<div class="mt-4 pl-10 flex flex-wrap items-center gap-3">' +
      '<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container text-text-tertiary font-eyebrow-mono text-[11px] border border-border-hairline"><span class="w-1.5 h-1.5 rounded-full bg-data-negative"></span><span>' + t("p2c1") + "</span></div>" +
      '<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container text-text-tertiary font-eyebrow-mono text-[11px] border border-border-hairline"><span class="w-1.5 h-1.5 rounded-full bg-data-warning"></span><span>' + t("p2c2") + "</span></div>" +
      "</div></div></div>" +
      item(3, "p3t", "p3d", "py-6") +
      item(4, "p4t", "p4d", "py-6 last:pb-0") +
      "</div></div></section>";
    $("landing").innerHTML = html;
    bindProblemHover();
  }

  function bindProblemHover() {
    if (!window.matchMedia("(hover: hover)").matches) return;
    var items = Array.prototype.slice.call(document.querySelectorAll("#problems .ri-problem"));
    var on = function (el) {
      items.forEach(function (it) {
        var box = it.querySelector(".ri-problem-box"), bar = it.querySelector(".ri-problem-bar"), num = it.querySelector(".ri-problem-num");
        var active = it === el;
        if (it.getAttribute("data-default") !== "1") {
          box.classList.toggle("p-5", active); box.classList.toggle("p-0", !active);
          box.classList.toggle("border-border-focus", active); box.classList.toggle("border-transparent", !active);
          box.classList.toggle("bg-surface-container-low", active);
        } else {
          box.classList.toggle("border-border-focus", active); box.classList.toggle("border-transparent", !active);
          box.classList.toggle("bg-surface-container-low", active);
        }
        bar.classList.toggle("opacity-0", !active);
        num.classList.toggle("text-primary", active); num.classList.toggle("text-text-tertiary", !active);
      });
    };
    items.forEach(function (it) { it.addEventListener("mouseenter", function () { on(it); }); });
    $("problems").addEventListener("mouseleave", function () { on(items[1]); });
  }

  // ------------------------------------------------------------------ S2/S3/S4/S7: the tool
  var STEP_HEAD = "flex items-center justify-between mb-6 pb-4 border-b border-border-hairline";
  var CARD = "bg-surface-card border border-border-hairline rounded-2xl p-6 sm:p-8 mb-6 relative transition-all duration-200";
  var LABEL = "font-eyebrow-mono text-eyebrow-mono text-on-surface-variant mb-2 block uppercase";
  var INPUT = "w-full h-11 bg-surface-interactive border border-border-hairline rounded-xl px-4 font-body-md text-body-md text-primary placeholder-text-tertiary focus:border-border-focus focus:outline-none transition-colors";
  var SELECT = INPUT.replace("px-4", "px-4 pr-10") + " appearance-none cursor-pointer";
  var CHEVRON = '<div class="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-text-tertiary">' + icon("expand_more", "text-[18px]") + "</div>";

  function stepTitle(key, done) {
    return '<span class="font-eyebrow-mono text-body-sm uppercase ' + (done ? "text-primary" : "text-on-surface-variant") + ' tracking-wider flex items-center gap-2">' + t(key) +
      (done ? '<span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-tertiary-fixed/15 text-tertiary-fixed">' + icon("check", "text-[14px] font-bold") + "</span>" : "") +
      "</span>";
  }
  function stepBadge(done) {
    return done
      ? '<span class="font-eyebrow-mono text-eyebrow-mono text-tertiary-fixed tracking-wider bg-tertiary-fixed/10 px-2.5 py-0.5 rounded-full border border-tertiary-fixed/20 uppercase">' + t("ready") + "</span>"
      : '<span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary tracking-widest uppercase">' + t("required") + "</span>";
  }

  function renderTool() {
    var res = result();
    var run = running();
    var collapsed = !!res && !S.ui.editTool && !run;
    var html =
      '<section class="w-full max-w-[720px] mx-auto py-12 sm:py-16 px-4 scroll-mt-24" id="tool-section">' +
      '<div class="text-center mb-10 reveal">' +
      '<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-interactive border border-border-hairline mb-4">' +
      '<span class="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse"></span>' +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-on-surface-variant uppercase tracking-widest">' + t("tool_eyebrow") + "</span></div>" +
      '<h2 class="font-headline-lg text-headline-lg font-light tracking-tight"><span class="text-primary">' + t("tool_a") + "</span>" +
      '<span class="text-text-tertiary">' + t("tool_b") + "</span></h2>" +
      '<p class="font-body-sm text-body-sm text-text-tertiary mt-2 max-w-sm mx-auto">' + t("tool_sub") + "</p></div>";
    if (collapsed) {
      var m = res.meta;
      html += '<div class="bg-surface-card border border-border-hairline rounded-full px-5 h-12 flex items-center justify-between gap-3">' +
        '<div class="font-eyebrow-mono text-eyebrow-mono text-on-surface-variant uppercase tracking-wider truncate">' +
        esc(m.category) + ' <span class="text-text-tertiary">·</span> ' + fmt(m.n_labeled) + " " + t("stat2_u") +
        ' <span class="text-text-tertiary">·</span> <span class="normal-case">' + esc(m.model) + "</span></div>" +
        '<button class="font-eyebrow-mono text-eyebrow-mono text-primary underline underline-offset-4 hover:text-on-surface-variant transition-colors shrink-0" data-act="edit-tool" type="button">' + t("sum_edit") + "</button></div>";
      html += "</section>";
      $("tool").innerHTML = html;
      observeReveal();
      return;
    }
    var dim = run ? " opacity-40 pointer-events-none select-none" : "";
    html += '<div id="tool-cards" class="' + dim + '">' + card1() + card2() + '<div id="card3-wrap">' + card3() + "</div></div>";
    html += '<div id="tool-action">' + (run ? progressHtml() : actionHtml()) + "</div>";
    html += "</section>";
    $("tool").innerHTML = html;
    observeReveal();
  }

  function refreshToolParts() {
    // Cheap update while typing: step headers, scale card and action area, without touching inputs.
    var h1 = $("card1-head"), h2 = $("card2-head");
    if (h1) h1.innerHTML = stepTitle("s1", step1Done()) + stepBadge(step1Done());
    if (h2) h2.innerHTML = stepTitle("s2", step2Done()) + providerBadge();
    var c3 = $("card3-wrap");
    if (c3) c3.innerHTML = card3();
    var cnt = $("paste-count");
    if (cnt) cnt.innerHTML = pasteCountHtml();
    if (!running() && $("tool-action")) $("tool-action").innerHTML = actionHtml();
  }

  function card1() {
    var f = S.form;
    var plats = PLATFORMS[S.lang].map(function (p, i) {
      return '<option value="' + i + '"' + (i === f.platform ? " selected" : "") + ">" + esc(p) + "</option>";
    }).join("");
    var tabOn = "flex-1 sm:flex-initial px-5 py-1.5 rounded-full font-label-pill text-label-pill bg-surface-container-high text-primary border border-border-hairline transition-all flex items-center justify-center gap-1.5";
    var tabOff = "flex-1 sm:flex-initial px-5 py-1.5 rounded-full font-label-pill text-label-pill text-text-tertiary hover:text-primary border border-transparent transition-colors flex items-center justify-center gap-1.5";
    var up = f.source === "file";
    return '<section class="' + CARD + '">' +
      '<div class="' + STEP_HEAD + '" id="card1-head">' + stepTitle("s1", step1Done()) + stepBadge(step1Done()) + "</div>" +
      '<div class="space-y-5">' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">' +
      '<div><label class="' + LABEL + '" for="f-category">' + t("f_cat") + "</label>" +
      '<input class="' + INPUT + '" id="f-category" data-in="category" placeholder="' + esc(t("ph_cat")) + '" type="text" value="' + esc(f.category) + '"/></div>' +
      '<div><label class="' + LABEL + '" for="f-platform">' + t("f_plat") + "</label>" +
      '<div class="relative"><select class="' + SELECT + '" id="f-platform" data-in="platform">' + plats + "</select>" + CHEVRON + "</div></div></div>" +
      '<div class="pt-1"><div class="flex items-center justify-between mb-2">' +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-on-surface-variant uppercase">' + t("f_source") + "</span>" +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary uppercase">' + t("limit") + "</span></div>" +
      '<div class="inline-flex p-1 bg-surface-container-lowest border border-border-hairline rounded-full w-full sm:w-auto" role="tablist">' +
      '<button class="' + (up ? tabOn : tabOff) + '" data-act="source" data-v="file" role="tab" type="button">' + icon("upload_file", "text-[15px]") + t("tab_upload") + "</button>" +
      '<button class="' + (!up ? tabOn : tabOff) + '" data-act="source" data-v="paste" role="tab" type="button">' + icon("content_paste", "text-[15px]") + t("tab_paste") + "</button>" +
      "</div></div>" +
      (up ? uploadPanel() : pastePanel()) +
      "</div></section>";
  }

  function uploadPanel() {
    var f = S.form;
    if (f.fileLoading) {
      return '<div class="border border-dashed border-border-focus rounded-xl p-8 sm:p-10 text-center bg-surface-container-lowest/60 flex flex-col items-center justify-center">' +
        '<p class="font-eyebrow-mono text-eyebrow-mono text-on-surface-variant uppercase">' + t("reading") + "</p>" +
        '<div class="relative w-40 h-[2px] mt-4 bg-surface-container-high rounded-full overflow-hidden"><div class="ri-indeterminate"></div></div></div>';
    }
    if (!f.file) {
      return '<div class="relative group/drop" id="dropzone">' +
        '<input accept=".csv,.xlsx,.xls,.txt" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" id="file-input" type="file"/>' +
        '<div class="border border-dashed ' + (f.fileError ? "border-data-negative/60" : "border-border-hairline") + ' rounded-xl p-8 sm:p-10 text-center bg-surface-container-lowest/60 group-hover/drop:border-border-focus group-hover/drop:bg-surface-interactive/40 transition-all flex flex-col items-center justify-center" id="dropzone-box">' +
        '<div class="w-10 h-10 rounded-full bg-surface-interactive border border-border-hairline flex items-center justify-center mb-3 text-on-surface-variant group-hover/drop:text-primary group-hover/drop:scale-105 transition-all">' + icon("cloud_upload", "text-[20px]") + "</div>" +
        '<p class="font-body-md text-body-md text-primary font-normal">' + t("drop_a") + '<span class="text-primary underline decoration-border-focus underline-offset-4">' + t("browse") + "</span></p>" +
        '<p class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary mt-2">' + t("drop_b") + "</p>" +
        '<div class="mt-4 flex flex-wrap justify-center items-center gap-3">' +
        '<span class="inline-flex items-center gap-1 font-eyebrow-mono text-[10px] text-text-tertiary bg-surface-card px-2 py-0.5 rounded border border-border-hairline"><span class="w-1 h-1 rounded-full bg-tertiary-fixed-dim"></span> UTF-8</span>' +
        '<span class="inline-flex items-center gap-1 font-eyebrow-mono text-[10px] text-text-tertiary bg-surface-card px-2 py-0.5 rounded border border-border-hairline"><span class="w-1 h-1 rounded-full bg-tertiary-fixed-dim"></span> GB18030 / GBK</span>' +
        '<span class="inline-flex items-center gap-1 font-eyebrow-mono text-[10px] text-text-tertiary bg-surface-card px-2 py-0.5 rounded border border-border-hairline">.XLSX</span>' +
        "</div>" +
        (f.fileError ? '<p class="font-eyebrow-mono text-eyebrow-mono text-data-negative mt-4 flex items-center gap-1.5">' + icon("error", "text-[14px]") + esc(f.fileError) + "</p>" : "") +
        "</div></div>";
    }
    var file = f.file, c = counts();
    var col = function (i) {
      return i == null || i < 0 ? '<span class="text-text-tertiary">' + t("none") + "</span>"
        : '<code class="text-primary bg-surface-container-high px-1.5 py-0.5 rounded text-[12px]">\'' + esc(file.columns[i]) + "'</code>";
    };
    var opts = function (sel, allowNone) {
      return (allowNone ? '<option value="-1"' + (sel < 0 ? " selected" : "") + ">" + t("none") + "</option>" : "") +
        file.columns.map(function (name, i) { return '<option value="' + i + '"' + (i === sel ? " selected" : "") + ">" + esc(name) + "</option>"; }).join("");
    };
    var bad = c.valid === 0;
    return '<div class="bg-surface-interactive border ' + (bad ? "border-data-negative/60" : "border-border-focus") + ' rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">' +
      '<div class="flex items-center gap-3 min-w-0">' +
      '<div class="w-10 h-10 rounded-lg bg-surface-card border border-border-hairline flex items-center justify-center shrink-0">' + icon("description", "text-primary text-[20px]") + "</div>" +
      '<div class="min-w-0"><div class="flex items-baseline flex-wrap gap-x-2">' +
      '<span class="font-body-md text-body-md text-primary font-medium truncate">' + esc(file.name) + "</span>" +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary shrink-0">' + fmt(file.rows.length) + " " + t("rows") + " · " + sizeText(file.size) + "</span></div>" +
      (bad
        ? '<div class="flex items-center gap-1 text-data-negative text-[11px] font-eyebrow-mono mt-0.5">' + icon("error", "text-[13px]") + t("err_nousable") + "</div>"
        : '<div class="flex items-center gap-1 text-tertiary-fixed text-[11px] font-eyebrow-mono mt-0.5">' + icon("verified", "text-[13px]") + t("file_ok") + "</div>") +
      "</div></div>" +
      '<button class="self-end sm:self-center font-eyebrow-mono text-eyebrow-mono text-text-tertiary hover:text-data-negative px-3 py-1.5 rounded hover:bg-data-negative/10 transition-colors flex items-center gap-1" data-act="remove-file" type="button">' + icon("delete", "text-[14px]") + t("remove") + "</button></div>" +
      '<div class="mt-4 pt-3 border-t border-border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-2">' +
      '<div class="font-code-md text-code-md text-on-surface-variant flex items-center flex-wrap gap-1.5">' +
      '<span class="text-text-tertiary font-eyebrow-mono text-eyebrow-mono uppercase">' + t("detected") + "</span>" +
      '<span class="text-on-surface">' + t("d_text") + " = " + col(file.textCol) + "</span>" +
      '<span class="text-text-tertiary">·</span><span class="text-on-surface">' + t("d_rating") + " = " + col(file.ratingCol) + "</span>" +
      '<span class="text-text-tertiary">·</span><span class="text-on-surface">' + t("d_date") + " = " + col(file.dateCol) + "</span>" +
      (file.followCol >= 0 ? '<span class="text-text-tertiary">·</span><span class="text-on-surface">' + t("d_follow") + " = " + col(file.followCol) + "</span>" : "") +
      "</div>" +
      '<button class="font-eyebrow-mono text-eyebrow-mono text-primary underline underline-offset-4 hover:text-on-surface-variant transition-colors self-start sm:self-auto cursor-pointer shrink-0" data-act="toggle-map" type="button">' + (f.showMap ? t("done_map") : t("change")) + "</button></div>" +
      (f.showMap
        ? '<div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">' +
          '<div><label class="' + LABEL + '">' + t("map_text") + '</label><div class="relative"><select class="' + SELECT + '" data-in="textCol">' + opts(file.textCol, false) + "</select>" + CHEVRON + "</div></div>" +
          '<div><label class="' + LABEL + '">' + t("map_rating") + '</label><div class="relative"><select class="' + SELECT + '" data-in="ratingCol">' + opts(file.ratingCol, true) + "</select>" + CHEVRON + "</div></div>" +
          '<div><label class="' + LABEL + '">' + t("map_date") + '</label><div class="relative"><select class="' + SELECT + '" data-in="dateCol">' + opts(file.dateCol, true) + "</select>" + CHEVRON + "</div></div>" +
          '<div><label class="' + LABEL + '">' + t("map_follow") + '</label><div class="relative"><select class="' + SELECT + '" data-in="followCol">' + opts(file.followCol, true) + "</select>" + CHEVRON + "</div></div>" +
          '<p class="sm:col-span-2 font-eyebrow-mono text-eyebrow-mono text-text-tertiary leading-relaxed">' + t("map_note") + "</p></div>"
        : "") +
      '<div class="mt-3 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full ' + (bad ? "bg-data-negative" : "bg-tertiary-fixed") + '"></span>' +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary">' + t("ready_n", { n: fmt(c.valid) }) +
      (c.removed ? ' <span class="text-outline-variant font-code-md">' + t("removed", { m: fmt(c.removed) }) + "</span>" : "") + "</span></div>" +
      previewHtml(file);
  }

  // First 3 rows that have review text, exactly as they will be sent, so a wrong column is obvious at a glance.
  function previewHtml(file) {
    var rows = [];
    for (var k = 0; k < file.rows.length && rows.length < 3; k++) {
      var txt = reviewText(file, file.rows[k]);
      if (txt.length >= 2) rows.push({ t: txt, r: file.ratingCol >= 0 ? file.rows[k][file.ratingCol] : null, d: file.dateCol >= 0 ? normDate(file.rows[k][file.dateCol]) : null });
    }
    if (!rows.length) return "";
    var hasR = file.ratingCol >= 0, hasD = file.dateCol >= 0;
    return '<div class="mt-4 rounded-xl border border-border-hairline bg-surface-container-lowest/60 overflow-hidden">' +
      '<div class="px-4 py-2.5 border-b border-border-hairline font-eyebrow-mono text-eyebrow-mono text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">' +
      icon("visibility", "text-[14px]") + t("preview") + "</div>" +
      '<table class="w-full text-left border-collapse"><thead><tr class="font-eyebrow-mono text-[10px] uppercase tracking-wider text-text-tertiary">' +
      '<th class="py-2 px-4 font-medium">' + t("pv_text") + "</th>" +
      (hasR ? '<th class="py-2 px-3 font-medium w-16">' + t("pv_rating") + "</th>" : "") +
      (hasD ? '<th class="py-2 px-4 font-medium w-28 hidden sm:table-cell">' + t("pv_date") + "</th>" : "") +
      '</tr></thead><tbody class="divide-y divide-white/[0.05] font-body-sm text-body-sm text-on-surface">' +
      rows.map(function (x) {
        return '<tr class="align-top"><td class="py-2.5 px-4"><span class="line-clamp-2">' + esc(x.t) + "</span></td>" +
          (hasR ? '<td class="py-2.5 px-3 font-eyebrow-mono text-[11px] text-data-warning whitespace-nowrap">' + (x.r == null ? "" : "★ " + esc(x.r)) + "</td>" : "") +
          (hasD ? '<td class="py-2.5 px-4 font-eyebrow-mono text-[11px] text-text-tertiary whitespace-nowrap hidden sm:table-cell">' + esc(x.d || "") + "</td>" : "") +
          "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function pasteCountHtml() {
    var c = counts();
    if (!c.raw) return "";
    return '<span class="w-1.5 h-1.5 rounded-full bg-tertiary-fixed"></span><span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary">' +
      t("ready_n", { n: fmt(c.valid) }) + (c.removed ? ' <span class="text-outline-variant font-code-md">' + t("removed", { m: fmt(c.removed) }) + "</span>" : "") + "</span>";
  }
  function pastePanel() {
    return '<div><textarea class="w-full h-40 bg-surface-interactive border border-border-hairline rounded-xl p-4 font-code-md text-code-md text-primary placeholder-text-tertiary focus:border-border-focus focus:outline-none transition-colors resize-y" data-in="paste" placeholder="' + esc(t("paste_ph")) + '" rows="6">' + esc(S.form.paste) + "</textarea>" +
      '<div class="mt-3 flex items-center gap-2" id="paste-count">' + pasteCountHtml() + "</div></div>";
  }
  function sizeText(b) {
    if (b == null) return "";
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + " KB";
    return (b / 1024 / 1024).toFixed(1) + " MB";
  }

  function providerBadge() {
    return S.form.provider === "gemini"
      ? '<span class="font-eyebrow-mono text-[10px] bg-surface-interactive text-on-surface-variant border border-border-hairline px-2.5 py-0.5 rounded-full tracking-wide uppercase">' + t("free") + "</span>"
      : '<span class="font-eyebrow-mono text-[10px] tracking-wider bg-primary/10 text-primary border border-border-focus px-2.5 py-0.5 rounded-full uppercase">' + t("paid") + "</span>";
  }

  function card2() {
    var f = S.form, p = providerCfg(), j = job();
    var errKind = j.status === "error" ? j.error_kind : "";
    var keyErr = errKind === "key", modelErr = errKind === "model", baseErr = errKind === "base";
    var opts = PROVIDER_ORDER.filter(function (k) { return (cfg().providers || {})[k]; }).map(function (k) {
      return '<option value="' + k + '"' + (k === f.provider ? " selected" : "") + ">" + esc(PROVIDER_NAMES[k][lang()]) +
        (k === "gemini" ? " · " + t("free") : "") + "</option>";
    }).join("");
    var keyInput = keyErr
      // S7: invalid key
      ? '<input autocomplete="off" class="w-full h-11 px-4 pr-24 rounded-xl font-code-md text-code-md text-primary bg-[#1F1414] focus:outline-none transition-colors duration-150" data-in="key" id="f-key" placeholder="' + esc(t("ph_key")) + '" style="box-shadow: inset 0 0 0 2px #E5675A;" type="' + (f.keyVisible ? "text" : "password") + '" value="' + esc(keyOf()) + '"/>'
      : '<input autocomplete="off" class="' + INPUT.replace("px-4", "pl-4 pr-24") + '" data-in="key" id="f-key" placeholder="' + esc(serverKey() ? t("key_opt") : t("ph_key")) + '" type="' + (f.keyVisible ? "text" : "password") + '" value="' + esc(keyOf()) + '"/>';
    var keyUrl = p.key_url || "";
    var html = '<section class="' + CARD + ' mb-8">' +
      '<div class="' + STEP_HEAD + '" id="card2-head">' + stepTitle("s2", step2Done()) + providerBadge() + "</div>" +
      '<div class="space-y-5">' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">' +
      '<div><label class="' + LABEL + '" for="f-provider">' + t("f_provider") + "</label>" +
      '<div class="relative"><select class="' + SELECT + '" data-in="provider" id="f-provider">' + opts + "</select>" + CHEVRON + "</div></div>" +
      '<div><label class="' + LABEL.replace("text-on-surface-variant", modelErr ? "text-data-negative" : "text-on-surface-variant") + '" for="f-model">' + t("f_model") + "</label>" +
      '<input class="' + INPUT.replace("font-body-md text-body-md", "font-code-md text-code-md") + (modelErr ? " !border-data-negative" : "") + '" data-in="model" id="f-model" placeholder="' + esc(t("ph_model")) + '" type="text" value="' + esc(modelOf()) + '"/>' +
      (modelErr ? '<p class="font-eyebrow-mono text-eyebrow-mono text-data-negative mt-2 leading-relaxed">' + t("err_model") + "</p>" : "") +
      "</div></div>" +
      '<div class="flex flex-col gap-1.5">' +
      '<div class="flex items-center justify-between mb-0.5"><label class="font-eyebrow-mono text-eyebrow-mono uppercase flex items-center gap-1.5 ' + (keyErr ? "text-data-negative" : "text-on-surface-variant") + '" for="f-key"><span>' + t("f_key") + "</span>" + (keyErr ? '<span class="text-data-negative">*</span>' : "") + "</label></div>" +
      '<div class="relative flex items-center">' + keyInput +
      '<div class="absolute right-2 flex items-center gap-1">' +
      '<button aria-label="' + esc(t("show_key")) + '" class="h-8 w-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-primary transition-colors" data-act="key-eye" type="button">' + icon(f.keyVisible ? "visibility_off" : "visibility", "text-[18px]") + "</button>" +
      (keyOf() ? '<button aria-label="' + esc(t("clear_key")) + '" class="h-8 w-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-data-negative transition-colors" data-act="key-clear" type="button">' + icon("close", "text-[18px]") + "</button>" : "") +
      "</div></div>" +
      (keyErr
        ? '<div class="flex flex-col gap-2 mt-2"><div class="flex items-start gap-2 text-data-negative font-eyebrow-mono text-eyebrow-mono leading-relaxed">' +
          '<svg class="w-4 h-4 text-data-negative shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>' +
          "<span>" + t("err_key") + (j.error_code ? " (HTTP " + esc(j.error_code) + ")" : "") + "</span></div>" +
          '<div class="flex flex-wrap items-center justify-between gap-3 pt-2 pl-6">' +
          (keyUrl ? '<a class="font-body-sm text-body-sm text-on-surface-variant hover:text-primary underline underline-offset-4 decoration-outline-variant hover:decoration-primary transition-colors flex items-center gap-1 group" href="' + esc(keyUrl) + '" rel="noopener noreferrer" target="_blank"><span>' + t("check_key", { u: esc(keyUrl.replace(/^https?:\/\//, "")) }) + "</span>" + icon("arrow_outward", "text-[14px] transition-transform group-hover:translate-x-0.5") + "</a>" : "<span></span>") +
          '<button class="px-3 py-1 bg-surface-interactive hover:bg-surface-container-high text-on-surface font-eyebrow-mono text-[11px] rounded-full transition-all flex items-center gap-1.5 hover:text-primary" data-act="analyze" type="button">' + icon("refresh", "text-[13px]") + "<span>" + t("retry") + "</span></button></div></div>"
        : '<div class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">' +
          '<span class="flex items-center gap-1.5">' + icon("lock", "text-[14px] text-text-tertiary") + t("privacy") + "</span>" +
          (keyUrl ? '<a class="text-on-surface-variant underline hover:text-primary transition-colors inline-flex items-center gap-0.5" href="' + esc(keyUrl) + '" rel="noopener noreferrer" target="_blank">' + t("get_key") + " " + icon("arrow_forward", "text-[12px]") + "</a>" : "") +
          "</div>") +
      "</div>";
    if (f.provider === "custom") {
      html += '<details class="group" open><summary class="list-none cursor-pointer font-eyebrow-mono text-eyebrow-mono text-text-tertiary uppercase flex items-center gap-1 hover:text-primary">' + icon("expand_more", "text-[16px] transition-transform group-open:rotate-180") + t("advanced") + "</summary>" +
        '<div class="pt-3"><label class="' + LABEL.replace("text-on-surface-variant", baseErr ? "text-data-negative" : "text-on-surface-variant") + '" for="f-base">' + t("f_base") + "</label>" +
        '<input class="' + INPUT.replace("font-body-md text-body-md", "font-code-md text-code-md") + (baseErr ? " !border-data-negative" : "") + '" data-in="base" id="f-base" placeholder="https://.../v1" type="text" value="' + esc(f.base) + '"/>' +
        (baseErr ? '<p class="font-eyebrow-mono text-eyebrow-mono text-data-negative mt-2">' + t("err_base") + "</p>" : "") + "</div></details>";
    }
    html += "</div></section>";
    return html;
  }

  function card3() {
    var c = counts(), s = sampleSize();
    if (c.valid <= s) return "";
    var kind = kindOf(), lim = limitFor(kind);
    var hasStrata = S.form.source === "file" && S.form.file && (S.form.file.ratingCol >= 0 || S.form.file.dateCol >= 0);
    var body;
    if (kind === "gemini") {
      body = '<div class="flex items-start gap-3 bg-surface-container-lowest/60 border border-border-hairline rounded-xl p-4">' +
        icon("info", "text-[16px] text-outline mt-0.5") +
        '<p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">' + t("tier_free", { n: fmt(c.valid), s: fmt(s), lim: fmt(limitFor("default")) }) + "</p></div>";
    } else {
      var nAll = Math.min(c.valid, lim);
      var cardHtml = function (id, on, chip, chipOn, title, desc, footIcon, foot) {
        return '<div class="scale-card relative ' + (on ? "bg-surface-interactive/90 border-2 border-primary/40" : "bg-surface-card border border-border-hairline hover:border-border-focus") + ' rounded-xl p-5 cursor-pointer transition-all duration-150 flex flex-col justify-between" data-act="scale" data-v="' + id + '" role="radio" aria-checked="' + on + '" tabindex="0">' +
          '<div><div class="flex items-start justify-between gap-2 mb-3">' +
          (chipOn ? '<span class="font-eyebrow-mono text-[10px] bg-primary text-surface-container-lowest font-semibold px-2 py-0.5 rounded-full inline-block uppercase tracking-wider">' + chip + "</span>"
            : '<span class="font-eyebrow-mono text-[10px] bg-surface-container-high text-on-surface-variant font-medium px-2 py-0.5 rounded-full inline-block uppercase tracking-wider">' + chip + "</span>") +
          '<div class="w-4 h-4 rounded-full border ' + (on ? "border-primary" : "border-outline-variant") + ' flex items-center justify-center bg-transparent mt-0.5"><div class="w-2 h-2 rounded-full ' + (on ? "bg-primary" : "bg-transparent") + '"></div></div></div>' +
          '<h3 class="font-headline-sm text-headline-sm ' + (on ? "text-primary" : "text-primary/80") + ' font-medium tracking-tight">' + title + "</h3>" +
          '<p class="font-body-sm text-body-sm text-text-tertiary mt-1.5 leading-relaxed">' + desc + "</p></div>" +
          '<div class="pt-4 mt-3 border-t border-border-hairline"><span class="font-eyebrow-mono text-[11px] ' + (on ? "text-tertiary-fixed" : "text-text-tertiary") + ' flex items-center gap-1.5">' + icon(footIcon, "text-[14px]") + foot + "</span></div></div>";
      };
      body = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup">' +
        cardHtml("sample", S.form.scale === "sample", t("recommended"), true, t("opt_sample", { s: fmt(s) }), t("opt_sample_d", { m: estMinutes(s, kind) }), "bolt", t("opt_sample_f")) +
        cardHtml("all", S.form.scale !== "sample", t("exhaustive"), false, c.valid > lim ? t("opt_max", { n: fmt(nAll) }) : t("opt_all", { n: fmt(nAll) }), t("opt_all_d", { m: estMinutes(nAll, kind) }), "all_inclusive", t("opt_all_f")) +
        "</div>";
      if (c.valid > lim) {
        body += '<p class="mt-3 font-eyebrow-mono text-eyebrow-mono text-text-tertiary"><a class="underline underline-offset-4 hover:text-primary" href="' + LINKS.github + '" rel="noopener" target="_blank">' + t("over_limit") + "</a></p>";
      }
    }
    if (hasStrata) {
      body += '<div class="mt-4 pt-3 flex items-start gap-2 text-text-tertiary font-eyebrow-mono text-eyebrow-mono leading-relaxed">' + icon("info", "text-[14px] mt-0.5 text-outline") + "<span>" + t("strat_note") + "</span></div>";
    }
    return '<section class="' + CARD + ' mb-8">' +
      '<div class="' + STEP_HEAD + '">' + stepTitle("s3", false).replace("text-on-surface-variant", "text-primary") +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary tracking-wider uppercase">' + t("detected_n", { n: fmt(c.valid) }) + "</span></div>" +
      body + "</section>";
  }

  function actionHtml() {
    var need = missing(), j = job();
    var genErr = j.status === "error" && (j.error_kind === "general" || j.error_kind === "reviews")
      ? '<div class="mb-4 flex items-start gap-2 text-data-negative font-eyebrow-mono text-eyebrow-mono leading-relaxed">' + icon("error", "text-[14px] mt-0.5") + "<span>" + esc(t("err_general", { e: j.error || "" })) + "</span></div>"
      : "";
    if (need.length) {
      var emptyAll = need.length >= 3;
      return '<div class="pt-2">' + genErr +
        '<div class="ri-sticky-cta"><button class="w-full h-[52px] rounded-full bg-surface-interactive/80 text-text-tertiary border border-border-hairline font-label-pill text-label-pill cursor-not-allowed flex items-center justify-center gap-2 select-none transition-all" disabled type="button">' +
        icon("insights", "text-[18px] opacity-40") + "<span>" + t("analyze") + "</span></button></div>" +
        '<div class="text-center mt-3.5 font-eyebrow-mono text-eyebrow-mono text-text-tertiary flex items-center justify-center gap-2">' +
        '<span class="w-1.5 h-1.5 rounded-full bg-text-tertiary/60"></span><span>' + (emptyAll ? t("start_hint") : t("still", { x: need.join(", ") })) + "</span></div>" +
        '<div class="mt-12 pt-8 border-t border-white/[0.05] grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">' +
        [["schema", "feat1t", "feat1d"], ["fact_check", "feat2t", "feat2d"], ["visibility", "feat3t", "feat3d"]].map(function (x) {
          return '<div class="p-3.5 rounded-xl bg-surface-card/40 border border-white/[0.04]"><div class="flex items-center gap-2 text-primary font-body-sm text-body-sm mb-1">' +
            icon(x[0], "text-[16px] text-on-surface-variant") + t(x[1]) + '</div><p class="font-body-sm text-body-sm text-text-tertiary text-xs leading-relaxed">' + t(x[2]) + "</p></div>";
        }).join("") + "</div></div>";
    }
    var c = counts(), n = nUse(c.valid), m = estMinutes(n, kindOf());
    return '<div class="flex flex-col items-center">' + genErr +
      '<div class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary text-center mb-3 flex items-center justify-center gap-2">' +
      '<span class="w-1.5 h-1.5 rounded-full bg-border-focus"></span><span>' + t("est", { n: fmt(n), m: m }) + (m > 1.5 ? " · " + t("keep_open") : "") + "</span></div>" +
      '<div class="ri-sticky-cta w-full"><button class="w-full h-[52px] rounded-full bg-primary text-on-primary font-headline-sm text-body-lg font-medium hover:bg-white hover:shadow-[0_0_24px_rgba(255,255,255,0.2)] active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 group" data-act="analyze" type="button">' +
      "<span>" + t("analyze_n", { n: fmt(n) }) + "</span>" + icon("arrow_forward", "text-[20px] transition-transform duration-200 group-hover:translate-x-0.5") + "</button></div>" +
      trustRow("mt-4") + "</div>";
  }

  function trustRow(cls) {
    return '<div class="' + cls + ' flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-text-tertiary font-eyebrow-mono text-[10px] uppercase tracking-wider">' +
      '<span class="flex items-center gap-1">' + icon("lock", "text-[12px]") + t("trust1") + "</span><span>·</span>" +
      '<span class="flex items-center gap-1">' + icon("memory", "text-[12px]") + t("trust2") + "</span><span>·</span>" +
      '<span class="flex items-center gap-1">' + icon("code", "text-[12px]") + t("trust3") + "</span></div>";
  }

  // S4: progress block
  function progressHtml() {
    var j = job();
    var stage = j.stage || 2;
    var row = function (n, label, state, right) {
      if (state === "current") {
        return '<div class="flex items-center justify-between gap-3 text-body-sm font-body-sm bg-surface-interactive/80 px-3 py-2 rounded-lg border border-border-focus">' +
          '<div class="flex items-center gap-3 min-w-0"><span class="font-eyebrow-mono text-[11px] text-primary font-medium w-5 shrink-0">0' + n + "</span>" +
          '<span class="text-primary font-medium truncate">' + label + "</span></div>" +
          '<div class="flex items-center gap-2 shrink-0"><span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span>' +
          '<span class="font-eyebrow-mono text-eyebrow-mono text-primary font-medium tracking-wide uppercase">' + right + "</span></div></div>";
      }
      if (state === "done") {
        return '<div class="flex items-center justify-between gap-3 text-body-sm font-body-sm px-3"><div class="flex items-center gap-3 min-w-0">' +
          '<span class="font-eyebrow-mono text-[11px] text-text-tertiary w-5 shrink-0">0' + n + '</span><span class="text-on-surface-variant font-normal truncate">' + label + "</span></div>" +
          '<div class="flex items-center gap-1.5 text-tertiary-fixed font-eyebrow-mono text-[11px] shrink-0">' + icon("check", "text-[15px] font-bold") +
          '<span class="text-text-tertiary font-eyebrow-mono text-[11px]">' + right + "</span></div></div>";
      }
      return '<div class="flex items-center justify-between gap-3 text-body-sm font-body-sm px-3"><div class="flex items-center gap-3 min-w-0">' +
        '<span class="font-eyebrow-mono text-[11px] text-text-tertiary w-5 shrink-0">0' + n + '</span><span class="text-text-tertiary font-normal truncate">' + label + "</span></div>" +
        '<span class="font-eyebrow-mono text-[11px] text-text-tertiary tracking-wider uppercase shrink-0">' + t("pending") + "</span></div>";
    };
    var st = function (n) { return n < stage ? "done" : n === stage ? "current" : "pending"; };
    var label3 = t("st3") + (stage >= 3 ? " " + fmt(j.done) + " / " + fmt(j.total) : "");
    var pct = stage >= 4 ? 100 : stage === 3 && j.total ? Math.floor(100 * j.done / j.total) : 0;
    var eta;
    if (stage >= 4) eta = t("working");
    else if (j.eta == null) eta = t("estimating");
    else if (j.eta < 60) eta = t("left_s");
    else eta = t("left", { m: Math.round(j.eta / 60) });
    var bar = stage === 2
      ? '<div class="relative w-full bg-surface-container-high h-[2px] rounded-full overflow-hidden mb-3"><div class="ri-indeterminate"></div></div>'
      : '<div class="w-full bg-surface-container-high h-[2px] rounded-full overflow-hidden mb-3"><div class="bg-primary h-full rounded-full duration-200 transition-all" style="width: ' + pct + '%"></div></div>';
    return '<section class="bg-surface-card border border-border-hairline rounded-2xl p-6 sm:p-7 relative overflow-hidden" id="progress" aria-live="polite">' +
      '<div class="flex items-center justify-between pb-4 border-b border-border-hairline mb-5">' +
      '<span class="font-eyebrow-mono text-body-sm uppercase text-primary tracking-wider flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>' + t("prog_title") + "</span>" +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary tracking-widest uppercase bg-surface-interactive px-2.5 py-0.5 rounded border border-border-hairline">' + t("stage", { a: stage }) + "</span></div>" +
      '<div class="flex flex-col gap-3.5 mb-6">' +
      row(1, t("st1"), "done", t("st1d", { n: fmt(j.n_rows || j.total) })) +
      row(2, t("st2"), st(2), stage > 2 && j.n_aspects ? t("st2d", { n: j.n_aspects }) : stage > 2 ? "" : t("working")) +
      row(3, label3, st(3), stage > 3 ? fmt(j.done) + " / " + fmt(j.total) : j.batches ? t("batch", { a: j.batch || 0, b: j.batches }) : t("working")) +
      row(4, t("st4"), st(4), t("working")) +
      "</div>" +
      '<div class="pt-4 border-t border-border-hairline">' + bar +
      '<div class="flex items-center justify-between font-eyebrow-mono text-[11px] text-text-tertiary"><span class="uppercase tracking-widest">' + eta + "</span>" +
      (stage >= 3 ? '<span class="text-primary font-medium tracking-wide uppercase">' + t("completed", { p: pct }) + "</span>" : "<span></span>") + "</div></div>" +
      '<div class="mt-5 pt-3 flex flex-col items-center justify-center">' +
      (S.ui.stopping || j.stop
        ? '<span class="font-body-sm text-body-sm text-text-tertiary py-1.5 px-4 inline-flex items-center gap-1.5">' + icon("hourglass_top", "text-[15px]") + t("stopping") + "</span>"
        : '<button class="font-body-sm text-body-sm text-text-tertiary hover:text-primary transition-colors py-1.5 px-4 rounded hover:bg-surface-interactive cursor-pointer inline-flex items-center justify-center gap-1.5" data-act="stop" type="button">' + icon("stop_circle", "text-[15px]") + t("stop") + "</button>") +
      trustRow("mt-3") + "</div></section>";
  }
  function renderProgress() {
    var el = $("tool-action");
    if (el) el.innerHTML = progressHtml();
  }

  // ------------------------------------------------------------------ S5/S6: results
  function aspectIndex(res) {
    var idx = {};
    // Counts are reviews, not mentions (a review can mention one aspect twice), matching the brief payload.
    res.aspects.forEach(function (a, i) { idx[a.key] = { a: a, i: i, neg: 0, pos: 0, neu: 0, quotes: [], reviews: {}, negRev: {}, seen: {} }; });
    res.mentions.forEach(function (m) {
      var x = idx[m.a];
      if (!x) return;
      x.reviews[m.i] = true;
      var k = m.s + "|" + m.i;
      if (m.s === "negative" && m.e) x.quotes.push(m.e);
      if (x.seen[k]) return;
      x.seen[k] = true;
      if (m.s === "negative") { x.neg += 1; x.negRev[m.i] = true; }
      else if (m.s === "positive") x.pos += 1;
      else x.neu += 1;
    });
    return idx;
  }
  function aspectLabel(a) { return S.lang === "zh" ? (a.label_zh || a.label_en) : a.label_en; }
  function ownerLabel(o) { return S.lang === "zh" ? (OWNER_ZH[o] || o) : o; }
  function pct(n, d) { return d ? Math.round(100 * n / d) : 0; }

  // Link each brief item to the aspect it talks about, so the card can show counts and all quotes.
  function matchAspect(item, idx, used) {
    var text = [item.issue, item.evidence, item.action].join(" ").toLowerCase();
    var best = null;
    Object.keys(idx).forEach(function (k) {
      if (best || used[k]) return;
      var x = idx[k];
      if (x.quotes.some(function (q) { return q && q.length >= 4 && text.indexOf(String(q).toLowerCase()) >= 0; })) best = k;
    });
    if (best) return best;
    Object.keys(idx).forEach(function (k) {
      if (best || used[k]) return;
      var a = idx[k].a;
      var names = [a.label_en, a.label_zh].filter(Boolean).map(function (s) { return s.toLowerCase(); });
      if (names.some(function (s) { return s.length >= 2 && text.indexOf(s) >= 0; })) best = k;
    });
    if (best) return best;
    var owner = String(item.owner || "").toLowerCase();
    Object.keys(idx).filter(function (k) {
      var o = String(idx[k].a.owner || "").toLowerCase();
      return !used[k] && idx[k].neg > 0 && owner && (o === owner || (OWNER_ZH[idx[k].a.owner] || "") === item.owner);
    }).sort(function (a, b) { return idx[b].neg - idx[a].neg; }).slice(0, 1).forEach(function (k) { best = k; });
    return best;
  }

  function fixItems(res, idx) {
    var brief = res.brief;
    var used = {};
    if (brief && brief.fix_first && brief.fix_first.length) {
      // New briefs name exactly one aspect per item; older ones (no "aspect") fall back to text matching.
      var items = [];
      brief.fix_first.forEach(function (it) {
        var k = it.aspect ? (idx[it.aspect] && !used[it.aspect] ? it.aspect : null) : matchAspect(it, idx, used);
        if (it.aspect && !k) return;
        if (k) used[k] = true;
        if (items.length < 3) items.push({ issue: it.issue, owner: it.owner, evidence: it.evidence, action: it.action, key: k });
      });
      if (items.length) return items;
    }
    return Object.keys(idx).filter(function (k) { return idx[k].neg > 0; })
      .sort(function (a, b) { return idx[b].neg - idx[a].neg; }).slice(0, 3)
      .map(function (k) { return { issue: aspectLabel(idx[k].a), owner: ownerLabel(idx[k].a.owner), evidence: "", action: "", key: k }; });
  }

  // Food safety words. A single mention matters, so these are scanned in every review text, not left
  // to the aspect labels. Negated uses ("没有虫子", "无杂质", "no bugs") are skipped.
  var SAFETY_ZH = ["食物中毒", "拉肚子", "腹泻", "呕吐", "虫子", "有虫", "生虫", "长虫", "虫卵", "虫眼", "活虫", "死虫",
    "小虫", "飞虫", "蛀虫", "虫", "异物", "杂物", "头发", "毛发", "发霉", "霉变", "霉味", "霉点", "长霉", "长毛", "霉",
    "变质", "过期", "腐烂", "石子", "沙子", "玻璃渣", "碎玻璃", "玻璃碴", "塑料片", "铁丝", "苍蝇", "蟑螂"];
  var SAFETY_EN = ["food poisoning", "foreign object", "cockroach", "maggot", "insects?", "bugs?", "worms?", "hairs?",
    "mou?ldy?", "rotten", "spoiled", "expired", "broken glass", "glass shards?", "diarrh?o?ea", "vomit(?:ed|ing)?"];
  var SAFETY_NOT = /冬虫夏草|虫草/g; // product names, not insects
  var SAFETY_RE = new RegExp(SAFETY_ZH.join("|") + "|\\b(?:" + SAFETY_EN.join("|") + ")\\b", "gi");
  function safetyHits(text) {
    var hits = [], m, s2 = String(text || "").replace(SAFETY_NOT, function (x) { return "\u25a1".repeat(x.length); });
    SAFETY_RE.lastIndex = 0;
    while ((m = SAFETY_RE.exec(s2))) {
      var start = m.index, word = m[0];
      // negated only when the negation sits right before the word: 没有虫子, 没有发现虫, 无霉点, 不发霉
      var negated = /[\u4e00-\u9fff]/.test(word)
        ? /(没有|没|无|不|未|零|防|免)(发现|看到|见到|见|有|任何|一点|一只)?$/.test(s2.slice(Math.max(0, start - 6), start))
        : /\b(no|not|without|zero|free of)\s*(any\s*)?$/.test(s2.slice(Math.max(0, start - 16), start).toLowerCase());
      if (negated) continue;
      hits.push({ start: start, end: start + word.length, word: word });
    }
    return hits;
  }
  function safetyRows(res) {
    return res.reviews.map(function (r) { return { r: r, hits: safetyHits(r.t) }; }).filter(function (x) { return x.hits.length; });
  }
  function markHits(text, hits) {
    var out = "", pos = 0;
    hits.forEach(function (h) {
      out += esc(text.slice(pos, h.start)) + '<span class="text-data-negative font-medium">' + esc(text.slice(h.start, h.end)) + "</span>";
      pos = h.end;
    });
    return out + esc(text.slice(pos));
  }
  function safetyHtml(res) {
    var rows = safetyRows(res);
    if (!rows.length) return "";
    var shown = S.ui.safetyAll ? rows : rows.slice(0, 5);
    var words = {};
    rows.forEach(function (x) { x.hits.forEach(function (h) { words[h.word.toLowerCase()] = (words[h.word.toLowerCase()] || 0) + 1; }); });
    return '<section class="mb-space-xl bg-surface-card border border-border-hairline border-l-2 border-l-data-negative rounded-r-xl p-5" id="safety">' +
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">' +
      '<h3 class="font-eyebrow-mono text-eyebrow-mono uppercase tracking-wider text-data-negative flex items-center gap-2">' + icon("warning", "text-[16px]") + t("safety_title") + "</h3>" +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-data-negative bg-data-negative/10 px-2 py-0.5 rounded uppercase">' + t("safety_n", { n: fmt(rows.length) }) + "</span></div>" +
      '<p class="font-body-sm text-body-sm text-on-surface-variant">' + t("safety_desc") + "</p>" +
      '<div class="mt-3 flex flex-wrap gap-1.5">' + Object.keys(words).map(function (w) {
        return '<span class="font-eyebrow-mono text-[11px] px-2 py-0.5 rounded-full border border-data-negative/25 bg-data-negative/5 text-data-negative">' + esc(w) + " ×" + words[w] + "</span>";
      }).join("") + "</div>" +
      '<ul class="mt-4 divide-y divide-white/[0.05] border-t border-white/[0.05]">' + shown.map(function (x) {
        var stars = x.r.r ? " · " + "★".repeat(Math.round(x.r.r)) : "";
        return '<li class="py-3 flex flex-col gap-1"><p class="font-body-md text-body-md text-on-surface leading-relaxed">' + markHits(x.r.t, x.hits) + "</p>" +
          '<span class="font-eyebrow-mono text-[10px] text-text-tertiary">#' + x.r.i + stars + "</span></li>";
      }).join("") + "</ul>" +
      (rows.length > 5 ? '<button class="mt-2 font-eyebrow-mono text-eyebrow-mono text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" data-act="safety-all" type="button">' +
        (S.ui.safetyAll ? t("show_less") : t("safety_more", { n: fmt(rows.length) })) + icon(S.ui.safetyAll ? "expand_less" : "expand_more", "text-[14px]") + "</button>" : "") +
      "</section>";
  }

  function renderResults() {
    var res = result();
    var el = $("results");
    if (!res) { el.innerHTML = ""; return; }
    var m = res.meta, R = res.reviews, idx = aspectIndex(res);
    var nNeg = R.filter(function (r) { return r.s === "negative"; }).length;
    var nPos = R.filter(function (r) { return r.s === "positive"; }).length;
    var nHid = R.filter(function (r) { return r.h; }).length;
    var html = '<div class="max-w-[960px] w-full mx-auto pt-4 pb-12 px-4 scroll-mt-24" id="results-top">';
    html += safetyHtml(res);

    // S6 banner
    if (m.run_err) {
      var reason = m.reason_kind === "stop" ? t("r_stop") : m.reason_kind === "quota" ? t("r_quota") : m.run_err;
      html += '<div class="bg-surface-card border border-border-hairline border-l-2 border-l-data-warning rounded-r-xl p-4 mb-space-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">' +
        '<div class="flex flex-wrap items-center gap-3"><span class="w-2 h-2 rounded-full bg-data-warning animate-pulse shrink-0"></span>' +
        '<span class="font-code-md text-code-md text-primary">' + t("partial", { d: fmt(m.n_labeled), n: fmt(m.n_sample) }) + "</span>" +
        '<span class="font-eyebrow-mono text-eyebrow-mono text-data-warning bg-data-warning/10 px-2 py-0.5 rounded tracking-wider">' + esc(t("reason", { r: reason })) + "</span></div>" +
        '<div class="flex items-center gap-3 shrink-0"><button class="font-eyebrow-mono text-code-md text-primary underline underline-offset-4 hover:text-on-surface-variant transition-colors flex items-center gap-1.5 cursor-pointer" data-act="new" type="button"><span>' + t("partial_new") + "</span>" + icon("arrow_forward", "text-[14px]") + "</button></div></div>";
    }

    // R1
    var scope = m.sampled
      ? t("scope_sample", { n: fmt(m.n_sample), t: fmt(m.n_total) }) + (m.stratified ? t("scope_strat") : t("period"))
      : t("scope_all", { n: fmt(m.n_labeled) });
    var margin = null;
    if (m.sampled && m.n_total > 1) {
      var n = m.n_labeled, N = m.n_total;
      margin = (196 * Math.sqrt(0.25 / n) * Math.sqrt((N - n) / (N - 1))).toFixed(1);
    }
    html += '<header class="flex flex-col gap-6 reveal">' +
      '<div class="flex flex-col md:flex-row md:items-start md:justify-between gap-6"><div class="space-y-1.5 max-w-2xl">' +
      '<div class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>' +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-on-surface-variant uppercase tracking-widest">' + t("res_eyebrow") + "</span></div>" +
      '<h2 class="font-headline-lg text-headline-lg tracking-tight"><span class="text-primary font-light">' + esc(t("res_a", { c: m.category, n: fmt(m.n_labeled) })) + "</span>" +
      '<span class="text-outline font-light">' + t("res_b") + "</span></h2>" +
      '<p class="font-eyebrow-mono text-[11px] text-text-tertiary leading-relaxed">' + scope + "</p></div>" +
      '<div class="flex flex-wrap items-center gap-2.5 shrink-0 pt-1">' +
      '<button class="bg-surface-card hover:bg-surface-interactive text-on-surface text-label-pill font-label-pill px-4 py-2 rounded-full border border-border-hairline hover:border-border-focus transition-all flex items-center gap-1.5" data-act="copy" id="btn-copy" type="button">' + icon("content_copy", "text-[15px] text-on-surface-variant") + "<span>" + t("copy") + "</span></button>" +
      '<button class="bg-primary hover:bg-primary/90 text-surface-container-lowest text-label-pill font-label-pill px-4 py-2 rounded-full transition-opacity flex items-center gap-1.5 shadow-sm" data-act="download" type="button">' + icon("download", "text-[15px]") + "<span>" + t("download") + "</span></button>" +
      '<button class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary hover:text-primary transition-colors flex items-center gap-1 px-2 py-1" data-act="new" type="button"><span>' + t("new_run") + "</span>" + icon("arrow_forward", "text-[13px]") + "</button>" +
      "</div></div>" +
      '<div class="border-y border-border-hairline py-6 md:py-8 my-4 grid grid-cols-3 divide-x divide-border-hairline">' +
      statCol(t("k_rev"), fmt(m.n_labeled), "text-primary", margin ? t("k_rev_m", { m: margin }) : t("k_rev_all"), "text-text-tertiary") +
      statCol(t("k_neg"), pct(nNeg, R.length) + "%", "text-data-negative", t("k_neg_s", { n: fmt(nNeg) }), "text-data-negative/80") +
      statCol(t("k_hid"), fmt(nHid), "text-primary", t("k_hid_s"), "text-text-tertiary", t("k_hid_help")) +
      "</div></header>";

    // R2
    var items = fixItems(res, idx);
    html += '<section class="mt-10 reveal">';
    if (!res.brief && m.brief_err) {
      html += '<p class="mb-4 font-eyebrow-mono text-[11px] text-outline flex items-start gap-1.5">' + icon("info", "text-[14px]") + "<span>" + t("brief_fail") + " " + t("fallback") + "</span></p>";
    }
    html += '<div class="flex items-center justify-between mb-4"><h3 class="font-eyebrow-mono text-eyebrow-mono uppercase tracking-wider text-text-tertiary flex items-center gap-2"><span class="w-1.5 h-1.5 bg-data-negative rounded-sm"></span>' + t("fix_title") + "</h3>" +
      '<span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary uppercase">' + t("fix_rank") + "</span></div>";
    if (!items.length) {
      html += '<div class="bg-surface-card border border-border-hairline rounded-xl p-6 font-body-md text-body-md text-on-surface-variant">' + t("no_complaints") + "</div>";
    } else {
      html += '<div class="space-y-4">' + items.map(function (it, i) { return fixCard(it, i, idx, R.length); }).join("") + "</div>";
    }
    html += "</section>";

    // R3
    var brief = res.brief;
    var ratio = nNeg ? (nPos / nNeg).toFixed(2) : null;
    if (brief && (brief.summary || (brief.keep_doing || []).length)) {
      html += '<section class="my-10 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-surface-card border border-border-hairline rounded-xl reveal">' +
        '<div class="flex flex-col justify-between"><div><span class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary uppercase tracking-widest block mb-2">01 · ' + t("summary") + "</span>" +
        '<p class="font-body-md text-body-md text-on-surface leading-relaxed">' + esc(brief.summary || "") + "</p></div>" +
        '<div class="mt-4 pt-4 border-t border-border-hairline flex items-center gap-3"><span class="font-eyebrow-mono text-[10px] text-text-tertiary uppercase">' + esc(t("written_by", { m: brief.model || m.model || "LLM" })) + "</span></div></div>" +
        '<div class="border-t md:border-t-0 md:border-l border-border-hairline pt-6 md:pt-0 md:pl-6 flex flex-col justify-between"><div>' +
        '<div class="flex items-center gap-1.5 mb-2"><span class="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim"></span><span class="font-eyebrow-mono text-eyebrow-mono text-tertiary-fixed-dim uppercase tracking-widest">02 · ' + t("keep") + "</span></div>" +
        '<ul class="space-y-3 font-body-sm text-body-sm text-on-surface">' + (brief.keep_doing || []).slice(0, 2).map(function (k) {
          return '<li class="flex items-start gap-2.5"><span class="text-tertiary-fixed-dim shrink-0 text-sm mt-0.5">●</span><span>' + esc(k) + "</span></li>";
        }).join("") + "</ul></div>" +
        '<div class="mt-4 pt-4 border-t border-border-hairline flex items-center justify-between gap-3">' +
        '<span class="font-eyebrow-mono text-[10px] text-text-tertiary uppercase">' + (ratio ? t("pos_ratio", { r: ratio }) : "") + "</span>" +
        '<button class="font-eyebrow-mono text-[10px] text-tertiary-fixed-dim hover:underline cursor-pointer" data-act="view-pos" type="button">' + t("view_pos") + " →</button></div></div></section>";
    }

    // R4
    html += chartHtml(idx);
    // R5
    html += hiddenHtml(res, idx);
    // R6
    html += '<section class="mt-12 reveal scroll-mt-24" id="r6"><div class="flex items-center justify-between mb-4"><h3 class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary uppercase tracking-wider">' + t("r6_title") + "</h3></div>" +
      '<div class="bg-surface-card border border-border-hairline rounded-xl overflow-hidden" id="r6-box">' + tableHtml(res, idx) + "</div></section>";
    // R7
    html += aspectsHtml(res);
    html += "</div>";
    el.innerHTML = html;
    observeReveal();
  }

  function statCol(label, value, valueCls, sub, subCls, help) {
    return '<div class="px-2 sm:px-6 py-0 text-center flex flex-col justify-center items-center' + (help ? " group relative cursor-help" : "") + '">' +
      '<div class="flex items-center gap-1"><span class="font-eyebrow-mono text-[10px] sm:text-eyebrow-mono text-text-tertiary uppercase mb-1">' + label + "</span>" +
      (help ? icon("info", "text-[13px] text-text-tertiary mb-1") : "") + "</div>" +
      '<div class="font-stat-xl text-[20px] leading-7 sm:text-stat-xl-mobile md:text-stat-xl ' + valueCls + ' font-light tracking-tight flex items-baseline justify-center font-tabular"><span>' + value + "</span></div>" +
      '<span class="font-eyebrow-mono text-[10px] ' + subCls + ' mt-1 hidden sm:block">' + esc(sub) + "</span>" +
      (help ? '<span class="ri-tip top-full mt-2 left-1/2 -translate-x-1/2 font-eyebrow-mono text-[11px] text-on-surface whitespace-normal w-56">' + esc(help) + "</span>" : "") +
      "</div>";
  }

  function fixCard(it, i, idx, nReviews) {
    var x = it.key ? idx[it.key] : null;
    var quote = x && x.quotes.length ? cardQuote(it, x) : "";
    var open = !!S.ui.fixOpen[i];
    var owner = it.owner || (x ? ownerLabel(x.a.owner) : "");
    return '<article class="bg-surface-card border border-border-hairline rounded-xl p-6 hover:border-border-focus transition-all group">' +
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.05]">' +
      '<div class="flex flex-wrap items-center gap-3"><span class="font-headline-sm text-headline-sm text-primary font-normal">' + (i + 1) + " · " + esc(it.issue) + "</span>" +
      (owner ? '<span class="bg-surface-interactive border border-border-hairline text-[11px] font-eyebrow-mono px-2.5 py-0.5 rounded-full text-on-surface-variant">' + t("team") + (S.lang === "zh" ? "：" : ": ") + esc(owner) + "</span>" : "") + "</div>" +
      (x ? '<span class="font-eyebrow-mono text-eyebrow-mono text-data-negative tracking-wide font-medium bg-data-negative/10 px-2 py-0.5 rounded uppercase shrink-0 self-start sm:self-auto">' + t("complaints", { n: fmt(x.neg), p: pct(x.neg, nReviews) }) + "</span>" : "") +
      "</div>" +
      (quote ? '<blockquote class="border-l-2 border-primary/40 pl-4 py-1.5 text-body-md text-on-surface italic my-4 bg-surface-container-lowest/50 rounded-r line-clamp-3 sm:line-clamp-none">' + quoteMarks(quote) + "</blockquote>"
        : it.evidence ? '<p class="my-4 font-body-sm text-body-sm text-on-surface-variant">' + esc(it.evidence) + "</p>" : '<div class="h-4"></div>') +
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">' +
      '<p class="font-body-sm text-body-sm text-on-surface-variant">' + (it.action ? '<span class="text-primary font-medium">' + t("next") + "</span> " + esc(it.action) : "") + "</p>" +
      (x && x.quotes.length > 1
        ? '<button class="shrink-0 font-eyebrow-mono text-eyebrow-mono text-on-surface-variant group-hover:text-primary transition-colors flex items-center gap-1 hover:underline" data-act="fix-quotes" data-i="' + i + '" type="button"><span>' + (open ? t("hide_quotes") : t("see_all", { n: fmt(x.quotes.length) })) + "</span>" + icon(open ? "expand_less" : "arrow_forward", "text-[13px]") + "</button>"
        : "") + "</div>" +
      (open && x
        ? '<ul class="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1 border-t border-white/[0.05] pt-4">' + x.quotes.slice(0, 20).map(function (q) {
            return '<li class="border-l-2 border-primary/20 pl-3 font-body-sm text-body-sm text-on-surface">' + quoteMarks(q) + "</li>";
          }).join("") + "</ul>"
        : "") +
      "</article>";
  }
  // the most complete quote up to 60 characters reads best as evidence
  function bestQuote(quotes) {
    return quotes.slice().sort(function (p, q) {
      var sp = p.length <= 60 ? p.length : -p.length, sq = q.length <= 60 ? q.length : -q.length;
      return sq - sp;
    })[0];
  }
  // Prefer the quote the brief itself cites, if it really is one of this aspect's complaints.
  function cardQuote(it, x) {
    var ev = String(it.evidence || "");
    var cited = x.quotes.filter(function (q) { return q && q.length >= 2 && ev.indexOf(q) >= 0; })
      .sort(function (a, b) { return b.length - a.length; })[0];
    return cited || bestQuote(x.quotes);
  }
  function quotePlain(q) { return /[\u4e00-\u9fff]/.test(q) ? "「" + q + "」" : "\u201c" + q + "\u201d"; }
  function quoteMarks(q) {
    var zh = /[一-鿿]/.test(q);
    return zh ? "「" + esc(q) + "」" : "“" + esc(q) + "”";
  }

  function chartHtml(idx) {
    var keys = Object.keys(idx).filter(function (k) { return idx[k].neg || idx[k].pos; })
      .sort(function (a, b) { return idx[b].neg - idx[a].neg || idx[b].pos - idx[a].pos; });
    if (!keys.length) return "";
    var max = Math.max.apply(null, keys.map(function (k) { return Math.max(idx[k].neg, idx[k].pos); })) || 1;
    var rows = keys.map(function (k) {
      var x = idx[k], name = aspectLabel(x.a);
      var wn = (x.neg / max * 85).toFixed(1), wp = (x.pos / max * 85).toFixed(1);
      return '<button class="w-full text-left grid grid-cols-12 items-center gap-2 text-xs group relative rounded hover:bg-surface-interactive/40 transition-colors" data-act="aspect" data-k="' + esc(k) + '" type="button">' +
        '<div class="col-span-12 sm:col-span-3 md:col-span-2 font-body-sm text-body-sm text-on-surface truncate pt-1 sm:pt-0">' + esc(name) + "</div>" +
        '<div class="col-span-12 sm:col-span-9 md:col-span-10 grid grid-cols-2 gap-0 relative items-center h-8 bg-surface-container-lowest/60 rounded px-2">' +
        '<div class="absolute left-1/2 top-0 bottom-0 w-[1px] bg-border-focus z-10"></div>' +
        '<div class="flex justify-end items-center pr-2 h-full"><div class="flex items-center gap-1.5 justify-end w-full">' +
        '<span class="font-eyebrow-mono text-[10px] text-data-negative shrink-0 font-tabular">' + fmt(x.neg) + "</span>" +
        '<div class="bg-data-negative h-4 rounded-l ri-bar" data-w="' + wn + '" style="width: ' + (reduceMotion ? wn : 0) + '%;"></div></div></div>' +
        '<div class="flex justify-start items-center pl-2 h-full"><div class="flex items-center gap-1.5 w-full">' +
        '<div class="bg-tertiary-fixed-dim h-4 rounded-r ri-bar" data-w="' + wp + '" style="width: ' + (reduceMotion ? wp : 0) + '%;"></div>' +
        '<span class="font-eyebrow-mono text-[10px] text-tertiary-fixed-dim shrink-0 font-tabular">' + fmt(x.pos) + "</span></div></div></div>" +
        '<span class="ri-tip bottom-full mb-1 left-1/2 -translate-x-1/2 font-eyebrow-mono text-[11px] text-on-surface">' +
        esc(t("tip", { a: name, o: ownerLabel(x.a.owner), n: x.neg, p: x.pos, u: x.neu })) + "</span></button>";
    }).join("");
    return '<section class="my-12 reveal" id="r4">' +
      '<div class="flex flex-col sm:flex-row sm:items-end justify-between pb-3 mb-6 border-b border-border-hairline"><div>' +
      '<h3 class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary uppercase tracking-wider">' + t("chart_title") + "</h3>" +
      '<p class="font-eyebrow-mono text-[11px] text-outline mt-1">' + t("chart_legend_a") + ' (<span class="text-data-negative font-medium">●</span>) │ ' + t("chart_legend_b") + ' (<span class="text-tertiary-fixed-dim font-medium">●</span>)</p></div>' +
      '<span class="font-eyebrow-mono text-[11px] text-text-tertiary mt-2 sm:mt-0">' + t("chart_click") + "</span></div>" +
      '<div class="bg-surface-card border border-border-hairline rounded-xl p-6 space-y-3 sm:space-y-4 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:16px_16px]">' + rows + "</div></section>";
  }

  function hiddenHtml(res, idx) {
    var firstNeg = {};
    res.mentions.forEach(function (m) { if (m.s === "negative" && !firstNeg[m.i]) firstNeg[m.i] = m; });
    var rows = res.reviews.filter(function (r) { return r.h; });
    var head = '<div class="flex flex-col sm:flex-row sm:items-baseline justify-between mb-4 gap-1"><div>' +
      '<h3 class="font-eyebrow-mono text-eyebrow-mono text-text-tertiary uppercase tracking-wider flex items-center gap-2">' + icon("visibility", "text-[14px] text-data-warning") + t("hid_title") + "</h3>" +
      '<p class="font-eyebrow-mono text-[11px] text-outline mt-1">' + t("hid_desc") + "</p></div>" +
      '<span class="font-eyebrow-mono text-[11px] text-text-tertiary uppercase">' + t("hid_total", { n: fmt(rows.length) }) + "</span></div>";
    if (!rows.length) {
      return '<section class="my-12 reveal">' + head + '<p class="font-body-sm text-body-sm text-text-tertiary">' + t("none_found") + "</p></section>";
    }
    var shown = S.ui.hidAll ? rows : rows.slice(0, 5);
    var list = shown.map(function (r) {
      var m = firstNeg[r.i], x = m ? idx[m.a] : null, open = !!S.ui.hidOpen[r.i];
      var stars = r.r ? '<span class="font-eyebrow-mono text-[11px] text-data-warning flex items-center gap-0.5 whitespace-nowrap">' + "★★★★★".slice(0, Math.round(r.r)) + '<span class="text-on-surface-variant ml-1">' + Number(r.r).toFixed(1) + "</span></span>" : "";
      return '<div class="p-4 flex flex-col gap-2 hover:bg-surface-interactive/60 transition-colors cursor-pointer" data-act="hid-row" data-i="' + r.i + '">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div class="flex items-center gap-3 min-w-0">' +
        (x ? '<span class="bg-surface-container border border-border-hairline text-[11px] font-eyebrow-mono text-outline px-2 py-0.5 rounded-full shrink-0">' + esc(aspectLabel(x.a)) + "</span>" : "") +
        '<span class="font-body-sm text-body-sm text-on-surface font-medium">' + (m && m.e ? quoteMarks(m.e) : "") + "</span></div>" +
        '<div class="flex items-center gap-3 shrink-0 self-end sm:self-auto">' + stars + "</div></div>" +
        '<p class="font-body-sm text-body-sm text-text-tertiary ' + (open ? "" : "line-clamp-1") + '">' + esc(r.t) + "</p></div>";
    }).join("");
    return '<section class="my-12 reveal">' + head +
      '<div class="bg-surface-card border border-border-hairline rounded-xl divide-y divide-border-hairline">' + list + "</div>" +
      (rows.length > 5 ? '<button class="mt-3 font-eyebrow-mono text-eyebrow-mono text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" data-act="hid-all" type="button">' + (S.ui.hidAll ? t("show_less") : t("show_all", { n: fmt(rows.length) })) + icon(S.ui.hidAll ? "expand_less" : "expand_more", "text-[14px]") + "</button>" : "") +
      "</section>";
  }

  var PAGE = 25;
  function filteredReviews(res, idx) {
    var f = S.ui.r6, q = f.q.trim().toLowerCase();
    var inAspect = f.aspect && idx[f.aspect] ? idx[f.aspect].reviews : null;
    return res.reviews.filter(function (r) {
      if (f.sent !== "all" && r.s !== f.sent) return false;
      if (inAspect && !inAspect[r.i]) return false;
      if (q && String(r.t).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function sentBadge(s) {
    var cls = s === "negative" ? "text-data-negative" : s === "positive" ? "text-tertiary-fixed-dim" : "text-outline";
    var dot = s === "negative" ? "bg-data-negative" : s === "positive" ? "bg-tertiary-fixed-dim" : "bg-[#6B6B6B]";
    return '<div class="flex items-center gap-1.5 font-eyebrow-mono text-[11px] ' + cls + '"><span class="w-1.5 h-1.5 rounded-full ' + dot + '"></span><span>' + t("s_" + s) + "</span></div>";
  }
  function repBadge(v) {
    if (v === "yes") return '<span class="font-eyebrow-mono text-[11px] text-tertiary-fixed-dim">' + t("rp_yes") + "</span>";
    if (v === "no") return '<span class="font-eyebrow-mono text-[11px] text-data-negative">' + t("rp_no") + "</span>";
    return '<span class="font-eyebrow-mono text-[11px] text-text-tertiary">' + t("rp_unclear") + "</span>";
  }

  function tableHtml(res, idx) {
    var f = S.ui.r6, R = res.reviews;
    var byReview = {};
    res.mentions.forEach(function (m) { (byReview[m.i] = byReview[m.i] || []).push(m); });
    var cnt = { all: R.length, negative: 0, positive: 0, neutral: 0 };
    R.forEach(function (r) { if (cnt[r.s] != null) cnt[r.s] += 1; });
    var rows = filteredReviews(res, idx);
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (f.page >= pages) f.page = pages - 1;
    var view = rows.slice(f.page * PAGE, f.page * PAGE + PAGE);
    var pill = function (v, label) {
      var on = f.sent === v;
      var onCls = v === "negative" ? "bg-data-negative/20 border border-data-negative/30 text-data-negative font-medium"
        : v === "positive" ? "bg-tertiary-fixed-dim/15 border border-tertiary-fixed-dim/30 text-tertiary-fixed-dim font-medium"
          : "bg-surface-container-high border border-border-hairline text-on-surface font-medium";
      return '<button class="font-eyebrow-mono text-[11px] px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ' + (on ? onCls : "text-text-tertiary hover:text-on-surface border border-transparent") + '" data-act="r6-sent" data-v="' + v + '" type="button">' + label + "</button>";
    };
    var aspectOpts = '<option value="">' + t("any_aspect") + "</option>" + res.aspects.map(function (a) {
      return '<option value="' + esc(a.key) + '"' + (f.aspect === a.key ? " selected" : "") + ">" + esc(aspectLabel(a)) + "</option>";
    }).join("");
    var tags = function (r, all) {
      var ms = (byReview[r.i] || []).filter(function (m) { return idx[m.a]; });
      // negatives first; three tags per row, the rest as "+N" (the row expands on click)
      ms.sort(function (a, b) { return (a.s === "negative" ? 0 : 1) - (b.s === "negative" ? 0 : 1); });
      var shown = all ? ms : ms.slice(0, 3);
      return shown.map(function (m) {
        var c = m.s === "negative" ? "text-data-negative/90" : m.s === "positive" ? "text-tertiary-fixed-dim" : "text-on-surface-variant";
        return '<span class="font-eyebrow-mono text-[10px] bg-surface-container px-2 py-0.5 rounded whitespace-nowrap ' + c + '">' + esc(aspectLabel(idx[m.a].a)) + "</span>";
      }).join("") + (ms.length > shown.length ? '<span class="font-eyebrow-mono text-[10px] px-1.5 py-0.5 text-text-tertiary">+' + (ms.length - shown.length) + "</span>" : "");
    };
    var meta = function (r) { return "#" + r.i + (r.r ? " · " + "★".repeat(Math.round(r.r)) : ""); };
    var html =
      '<div class="p-4 border-b border-border-hairline flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest/40">' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<div class="relative min-w-[200px] max-w-xs flex-1 sm:flex-none">' + icon("search", "absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-[16px]") +
      '<input class="w-full bg-surface border border-border-hairline rounded-md pl-8 pr-3 py-1.5 font-body-sm text-body-sm text-on-surface placeholder:text-text-tertiary focus:border-border-focus focus:outline-none transition-colors" data-in="r6-q" id="r6-q" placeholder="' + esc(t("search_ph")) + '" type="text" value="' + esc(f.q) + '"/></div>' +
      '<div class="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-full border border-border-hairline overflow-x-auto max-w-full">' +
      pill("all", t("all")) + pill("negative", t("s_negative") + " (" + fmt(cnt.negative) + ")") + pill("positive", t("s_positive") + " (" + fmt(cnt.positive) + ")") + pill("neutral", t("s_neutral") + " (" + fmt(cnt.neutral) + ")") +
      "</div></div>" +
      '<div class="flex items-center justify-between md:justify-end gap-3 font-eyebrow-mono text-[11px] text-text-tertiary">' +
      '<span class="uppercase whitespace-nowrap">' + t("showing", { a: fmt(rows.length), b: fmt(R.length) }) + "</span>" +
      '<div class="relative"><select class="appearance-none bg-transparent text-on-surface hover:underline pr-5 cursor-pointer focus:outline-none font-eyebrow-mono text-[11px] max-w-[160px] truncate" data-in="r6-aspect">' + aspectOpts + "</select>" +
      icon("expand_more", "text-[14px] absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none") + "</div></div></div>";
    if (!rows.length) {
      return html + '<div class="p-10 text-center font-body-sm text-body-sm text-text-tertiary">' + t("no_match") +
        ' · <button class="text-primary underline underline-offset-4" data-act="r6-clear" type="button">' + t("clear") + "</button></div>";
    }
    // table (>= 640px)
    html += '<div class="overflow-x-auto hidden sm:block"><table class="w-full text-left border-collapse"><thead>' +
      '<tr class="border-b border-border-hairline text-text-tertiary font-eyebrow-mono text-[10px] uppercase tracking-wider bg-surface-container-lowest/20">' +
      '<th class="py-3 px-4 w-4/12 font-medium">' + t("th_review") + '</th><th class="py-3 px-4 w-1/12 font-medium">' + t("th_sent") + "</th>" +
      '<th class="py-3 px-4 w-3/12 font-medium">' + t("th_aspects") + '</th><th class="py-3 px-4 w-2/12 font-medium">' + t("th_root") + "</th>" +
      '<th class="py-3 px-4 w-2/12 font-medium text-right">' + t("th_rep") + "</th></tr></thead>" +
      '<tbody class="divide-y divide-white/[0.05] font-body-sm text-body-sm text-on-surface">' +
      view.map(function (r) {
        var open = !!f.open[r.i];
        return '<tr class="hover:bg-surface-interactive/40 transition-colors cursor-pointer align-top" data-act="r6-row" data-i="' + r.i + '">' +
          '<td class="py-3.5 px-4"><div class="flex flex-col"><span class="text-on-surface ' + (open ? "" : "line-clamp-1") + '">' + esc(r.t) + "</span>" +
          '<span class="font-eyebrow-mono text-[10px] text-text-tertiary mt-0.5">' + meta(r) + "</span></div></td>" +
          '<td class="py-3.5 px-4 whitespace-nowrap">' + sentBadge(r.s) + "</td>" +
          '<td class="py-3.5 px-4"><div class="flex flex-wrap gap-1">' + tags(r, open) + "</div></td>" +
          '<td class="py-3.5 px-4"><span class="font-eyebrow-mono text-[11px] text-outline ' + (open ? "" : "line-clamp-1") + '">' + esc(r.rc || "") + "</span></td>" +
          '<td class="py-3.5 px-4 text-right">' + repBadge(r.rp) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    // card list (< 640px, PRD section 9)
    html += '<div class="sm:hidden divide-y divide-white/[0.05]">' + view.map(function (r) {
      var open = !!f.open[r.i];
      return '<div class="p-4 flex flex-col gap-2" data-act="r6-row" data-i="' + r.i + '">' +
        '<div class="flex items-center justify-between">' + sentBadge(r.s) + '<span class="font-eyebrow-mono text-[10px] text-text-tertiary">' + meta(r) + "</span></div>" +
        '<p class="font-body-md text-[15px] leading-6 text-on-surface ' + (open ? "" : "line-clamp-3") + '">' + esc(r.t) + "</p>" +
        '<div class="flex flex-wrap gap-1">' + tags(r, open) + "</div></div>";
    }).join("") + "</div>";
    html += '<div class="px-4 py-3 border-t border-border-hairline flex items-center justify-between text-xs font-eyebrow-mono text-text-tertiary bg-surface-container-lowest/30">' +
      "<span>" + t("page", { a: f.page + 1, b: pages }) + "</span>" +
      '<div class="flex items-center gap-2">' +
      '<button class="px-2 py-1 bg-surface border border-border-hairline rounded hover:text-on-surface disabled:opacity-40" data-act="r6-page" data-v="-1" type="button"' + (f.page === 0 ? " disabled" : "") + ">" + t("prev") + "</button>" +
      '<button class="px-2 py-1 bg-surface border border-border-hairline rounded hover:text-on-surface disabled:opacity-40" data-act="r6-page" data-v="1" type="button"' + (f.page >= pages - 1 ? " disabled" : "") + ">" + t("next_p") + "</button>" +
      "</div></div>";
    return html;
  }
  function renderTable() {
    var res = result(); if (!res) return;
    var box = $("r6-box"); if (!box) return;
    var hadFocus = document.activeElement && document.activeElement.id === "r6-q";
    var pos = hadFocus ? document.activeElement.selectionStart : null;
    box.innerHTML = tableHtml(res, aspectIndex(res));
    if (hadFocus) { var q = $("r6-q"); q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
  }

  function aspectsHtml(res) {
    var tea = res.meta.taxonomy_source === "hand-written";
    return '<section class="mt-8 pt-4 border-t border-border-hairline"><details class="group select-none">' +
      '<summary class="flex items-center justify-between cursor-pointer list-none py-2 text-text-tertiary hover:text-on-surface transition-colors">' +
      '<span class="font-eyebrow-mono text-eyebrow-mono uppercase tracking-wider flex flex-wrap items-center gap-2"><span>' + t("r7_title", { n: res.aspects.length }) + "</span>" +
      '<span class="text-[10px] bg-surface-container px-2 py-0.5 rounded text-outline normal-case">' + esc(res.meta.category) + "</span></span>" +
      icon("expand_more", "text-[16px] transition-transform duration-200 group-open:rotate-180") + "</summary>" +
      '<div class="pt-4 pb-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">' + res.aspects.map(function (a, i) {
        return '<div class="p-3 bg-surface-card border border-border-hairline rounded-lg">' +
          '<span class="font-eyebrow-mono text-[10px] text-text-tertiary uppercase block">' + (i < 9 ? "0" : "") + (i + 1) + " · " + esc(ownerLabel(a.owner)) + "</span>" +
          '<span class="font-body-sm text-body-sm text-on-surface mt-1 block">' + esc(aspectLabel(a)) + "</span>" +
          '<span class="font-eyebrow-mono text-[10px] text-outline mt-0.5 block leading-relaxed select-text">' + esc(a.description || "") + "</span></div>";
      }).join("") + "</div>" +
      '<p class="pb-2 font-eyebrow-mono text-[11px] text-text-tertiary">' + (tea ? t("r7_tea") : t("r7_note")) + "</p></details></section>";
  }

  // ------------------------------------------------------------------ copy + download
  function briefText(res) {
    var idx = aspectIndex(res), items = fixItems(res, idx), b = res.brief || {}, out = [];
    out.push(t("res_a", { c: res.meta.category, n: fmt(res.meta.n_labeled) }) + t("res_b"));
    var safe = safetyRows(res);
    if (safe.length) {
      out.push("", t("safety_title") + " (" + t("safety_n", { n: safe.length }) + "):");
      safe.forEach(function (x) { out.push("- #" + x.r.i + " " + quotePlain(x.r.t)); });
    }
    if (b.summary) out.push("", b.summary);
    if (items.length) {
      out.push("", t("fix_title") + ":");
      items.forEach(function (it, i) {
        var x = it.key ? idx[it.key] : null;
        var line = (i + 1) + ". " + it.issue + (it.owner ? " (" + it.owner + ")" : "");
        if (x) line += " · " + t("complaints", { n: x.neg, p: pct(x.neg, res.reviews.length) });
        out.push(line);
        // the count and the quote come from the labeled data, not from the model's evidence sentence
        if (x && x.quotes.length) out.push("   " + quotePlain(cardQuote(it, x)));
        else if (it.evidence) out.push("   " + it.evidence);
        if (it.action) out.push("   " + t("next") + " " + it.action);
      });
    }
    if ((b.keep_doing || []).length) {
      out.push("", t("keep") + ":");
      b.keep_doing.forEach(function (k) { out.push("- " + k); });
    }
    return out.join("\n");
  }
  function copyText(text) {
    var done = function () {
      var btn = $("btn-copy"); if (!btn) return;
      var old = btn.innerHTML;
      btn.innerHTML = icon("check", "text-[15px] text-tertiary-fixed-dim") + '<span class="text-tertiary-fixed-dim">' + t("copied") + "</span>";
      setTimeout(function () { if ($("btn-copy")) $("btn-copy").innerHTML = old; }, 2000);
    };
    var fallback = function () {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      document.body.removeChild(ta); done();
    };
    try {
      var nav = (window.parent && window.parent.navigator && window.parent.navigator.clipboard) || navigator.clipboard;
      if (nav) { nav.writeText(text).then(done, fallback); return; }
    } catch (e) { /* cross-origin parent */ }
    fallback();
  }
  function csvCell(v) {
    var s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadCsv(res) {
    var idx = aspectIndex(res), by = {};
    res.mentions.forEach(function (m) { (by[m.i] = by[m.i] || []).push(m); });
    var head = ["review_id", "text", "rating", "overall_sentiment", "negative_aspects", "positive_aspects", "neutral_aspects", "evidence", "root_cause", "repurchase", "hidden_issue", "food_safety_terms"];
    var lines = [head.join(",")];
    res.reviews.forEach(function (r) {
      var ms = by[r.i] || [];
      var list = function (s) { return ms.filter(function (m) { return m.s === s && idx[m.a]; }).map(function (m) { return aspectLabel(idx[m.a].a); }).join("; "); };
      lines.push([r.i, r.t, r.r == null ? "" : r.r, r.s, list("negative"), list("positive"), list("neutral"),
        ms.map(function (m) { return m.e; }).filter(Boolean).join(" | "), r.rc || "", r.rp || "", r.h ? "yes" : "no",
        safetyHits(r.t).map(function (h) { return h.word; }).join("; ")].map(csvCell).join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var d = new Date(), stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    var name = "review-insight_" + String(res.meta.category).replace(/[\\/:*?"<>|\s]+/g, "-") + "_" + stamp + ".csv";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ------------------------------------------------------------------ file reading (in the browser, so the file is sent once)
  function colName(c) { return String(c).toLowerCase().replace(/\s+/g, " ").trim(); }
  function colValues(rows, i) {
    var out = [];
    for (var k = 0; k < rows.length && out.length < 300; k++) { var v = rows[k][i]; if (v != null && String(v).trim() !== "") out.push(v); }
    return out;
  }
  function isTextLike(rows, i) {
    var vals = colValues(rows, i);
    if (!vals.length) return false;
    var numeric = vals.filter(function (v) { return isFinite(parseFloat(v)) && String(v).trim().length <= 20 && /^[\d.\-]+$/.test(String(v).trim()); }).length;
    var avg = vals.reduce(function (t, v) { return t + String(v).length; }, 0) / vals.length;
    return numeric / vals.length < 0.5 && avg >= 4;
  }
  function isRatingLike(rows, i) {
    var vals = colValues(rows, i);
    if (!vals.length) return false;
    var ok = vals.filter(function (v) { var x = parseFloat(v); return isFinite(x) && x >= 1 && x <= 5; }).length;
    return ok / vals.length >= 0.8;
  }
  function isDateLike(rows, i) {
    var vals = colValues(rows, i);
    if (!vals.length) return false;
    var ok = vals.filter(function (v) { return !!normDate(v); }).length;
    return ok / vals.length >= 0.8;
  }
  // "2026年10月07日 15:02:33", "2026/10/7", "2026-10-07 15:02" -> "2026-10-07" (pandas can't read the first form)
  function normDate(v) {
    if (v == null) return null;
    if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10);
    var m = String(v).match(/(\d{4})\s*[年\/\-.]\s*(\d{1,2})\s*[月\/\-.]\s*(\d{1,2})/);
    if (!m) return null;
    return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  }
  function pickByName(cols, names, exclude, accept, taken) {
    for (var n = 0; n < names.length; n++) {
      for (var i = 0; i < cols.length; i++) {
        var c = colName(cols[i]);
        if (taken.indexOf(i) >= 0) continue;
        if (exclude.some(function (x) { return c.indexOf(x) >= 0; })) continue;
        if (c.indexOf(names[n]) >= 0 && accept(i)) return i;
      }
    }
    return -1;
  }
  function detectColumns(cols, rows) {
    var text = pickByName(cols, TEXT_NAMES, NOT_TEXT, function (i) { return isTextLike(rows, i); }, []);
    if (text < 0) { // no telling name: the longest text column that isn't a reply or follow-up
      var bestLen = -1;
      cols.forEach(function (c, i) {
        var n = colName(c);
        if (NOT_TEXT.slice(0, 4).some(function (x) { return n.indexOf(x) >= 0; }) || !isTextLike(rows, i)) return;
        var vals = colValues(rows, i), avg = vals.reduce(function (t, v) { return t + String(v).length; }, 0) / vals.length;
        if (avg > bestLen) { bestLen = avg; text = i; }
      });
      if (text < 0) text = 0;
    }
    var rating = pickByName(cols, RATING_NAMES, [], function (i) { return isRatingLike(rows, i); }, [text]);
    var date = pickByName(cols, DATE_NAMES, NOT_DATE, function (i) { return isDateLike(rows, i); }, [text, rating]);
    var follow = pickByName(cols, FOLLOW_NAMES, NOT_FOLLOW, function () { return true; }, [text, rating, date]);
    return { textCol: text, ratingCol: rating, dateCol: date, followCol: follow };
  }
  // The text sent to the model: the review, plus the follow-up review when the export has one.
  function reviewText(fl, r) {
    var main = r[fl.textCol] == null ? "" : String(r[fl.textCol]).trim();
    var fu = fl.followCol >= 0 && r[fl.followCol] != null ? String(r[fl.followCol]).trim() : "";
    if (!fu) return main;
    var label = /[\u4e00-\u9fff]/.test(main + fu) ? "追评：" : "Follow-up: ";
    return main ? main + " " + label + fu : fu;
  }
  function decodeText(buf) {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, ""); }
    catch (e) { return new TextDecoder("gb18030").decode(buf); } // Chinese seller back-ends often export GBK
  }
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s);
    });
  }
  function readFile(file) {
    var f = S.form;
    f.fileLoading = true; f.fileError = ""; f.file = null; f.showMap = false;
    renderTool();
    var isX = /\.xlsx?$/i.test(file.name);
    file.arrayBuffer().then(function (buf) {
      if (isX) {
        var lib = window.XLSX ? Promise.resolve() : loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
        return lib.then(function () {
          var wb = window.XLSX.read(buf, { type: "array", cellDates: true });
          var sh = wb.Sheets[wb.SheetNames[0]];
          return window.XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: null, dateNF: "yyyy-mm-dd" });
        });
      }
      var txt = decodeText(buf);
      var parsed = window.Papa.parse(txt, { skipEmptyLines: "greedy" });
      return parsed.data;
    }).then(function (table) {
      if (!table || table.length < 2) throw new Error("empty");
      var cols = table[0].map(function (c, i) { return c == null || c === "" ? "column " + (i + 1) : String(c); });
      var rows = table.slice(1).map(function (r) {
        return cols.map(function (_, i) { var v = r[i]; return v instanceof Date ? v.toISOString().slice(0, 10) : v; });
      });
      f.file = Object.assign({ name: file.name, size: file.size, columns: cols, rows: rows }, detectColumns(cols, rows));
      f.fileLoading = false;
      renderTool();
    }).catch(function () {
      f.fileLoading = false; f.file = null; f.fileError = t("err_read");
      renderTool();
    });
  }

  function analyze() {
    if (missing().length || running()) return;
    var f = S.form, texts, ratings = null, dates = null, fileName = "";
    if (f.source === "paste") {
      texts = pasteLines();
    } else {
      var fl = f.file;
      texts = fl.rows.map(function (r) { return reviewText(fl, r); });
      if (fl.ratingCol >= 0) ratings = fl.rows.map(function (r) { var v = parseFloat(r[fl.ratingCol]); return isFinite(v) ? v : null; });
      if (fl.dateCol >= 0) dates = fl.rows.map(function (r) { return normDate(r[fl.dateCol]); });
      fileName = fl.name;
    }
    var c = counts();
    send("analyze", {
      lang: S.lang, category: f.category.trim(), platform: PLATFORMS[S.lang][f.platform], provider: f.provider,
      model: modelOf().trim(), key: keyOf().trim(), base_url: f.base.trim(), n_use: nUse(c.valid),
      texts: texts, ratings: ratings, dates: dates, file_name: fileName,
    }, true);
  }

  // ------------------------------------------------------------------ events
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el) {
      if (S.ui.menu && !e.target.closest("#nav")) { S.ui.menu = false; renderNav(); }
      return;
    }
    var act = el.getAttribute("data-act"), v = el.getAttribute("data-v");
    var res = result();
    switch (act) {
      case "lang":
        S.lang = S.lang === "en" ? "zh" : "en";
        document.documentElement.lang = S.lang === "zh" ? "zh-CN" : "en";
        renderAll(true);
        send("lang", { lang: S.lang });
        break;
      case "menu": S.ui.menu = !S.ui.menu; renderNav(); break;
      case "top": e.preventDefault(); scroller().scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); break;
      case "to-tool":
        e.preventDefault(); S.ui.menu = false; renderNav();
        if (result() && !S.ui.editTool) { S.ui.editTool = true; renderTool(); }
        scrollToEl($("tool-section"), 72);
        break;
      case "edit-tool": S.ui.editTool = true; renderTool(); scrollToEl($("tool-section"), 72); break;
      case "source": S.form.source = v; renderTool(); break;
      case "remove-file": S.form.file = null; S.form.fileError = ""; renderTool(); break;
      case "toggle-map": S.form.showMap = !S.form.showMap; renderTool(); break;
      case "key-eye":
        S.form.keyVisible = !S.form.keyVisible;
        var k = $("f-key"); if (k) k.type = S.form.keyVisible ? "text" : "password";
        el.innerHTML = icon(S.form.keyVisible ? "visibility_off" : "visibility", "text-[18px]");
        break;
      case "key-clear": S.form.keys[S.form.provider] = ""; renderTool(); break;
      case "scale": S.form.scale = v; refreshToolParts(); break;
      case "analyze": analyze(); break;
      case "stop": S.ui.stopping = true; renderProgress(); send("stop"); break;
      case "new":
        S.ui.editTool = true;
        send("reset");
        setTimeout(function () { scrollToEl($("tool-section"), 72); }, 50);
        break;
      case "copy": if (res) copyText(briefText(res)); break;
      case "download": if (res) downloadCsv(res); break;
      case "fix-quotes": var i = +el.getAttribute("data-i"); S.ui.fixOpen[i] = !S.ui.fixOpen[i]; renderResults(); break;
      case "hid-all": S.ui.hidAll = !S.ui.hidAll; renderResults(); break;
      case "safety-all": S.ui.safetyAll = !S.ui.safetyAll; renderResults(); break;
      case "hid-row": var hi = el.getAttribute("data-i"); S.ui.hidOpen[hi] = !S.ui.hidOpen[hi]; renderResults(); break;
      case "aspect":
        S.ui.r6.aspect = el.getAttribute("data-k"); S.ui.r6.sent = "all"; S.ui.r6.page = 0;
        renderTable(); scrollToEl($("r6"), 88);
        break;
      case "view-pos": S.ui.r6.sent = "positive"; S.ui.r6.aspect = ""; S.ui.r6.page = 0; renderTable(); scrollToEl($("r6"), 88); break;
      case "r6-sent": S.ui.r6.sent = v; S.ui.r6.page = 0; renderTable(); break;
      case "r6-page": S.ui.r6.page += +v; renderTable(); break;
      case "r6-clear": S.ui.r6 = { q: "", sent: "all", aspect: "", page: 0, open: {} }; renderTable(); break;
      case "r6-row": var ri = el.getAttribute("data-i"); S.ui.r6.open[ri] = !S.ui.r6.open[ri]; renderTable(); break;
    }
  });
  document.addEventListener("keydown", function (e) {
    var el = e.target.closest && e.target.closest("[data-act='scale']");
    if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); el.click(); }
  });

  document.addEventListener("input", function (e) {
    var k = e.target.getAttribute && e.target.getAttribute("data-in");
    if (!k) return;
    var v = e.target.value, f = S.form;
    if (k === "category") { f.category = v; refreshToolParts(); }
    else if (k === "paste") { f.paste = v; refreshToolParts(); }
    else if (k === "model") { f.models[f.provider] = v; refreshToolParts(); }
    else if (k === "key") {
      var had = !!keyOf(); f.keys[f.provider] = v;
      if (had !== !!v) { var pos = e.target.selectionStart; renderTool(); var ki = $("f-key"); if (ki) { ki.focus(); try { ki.setSelectionRange(pos, pos); } catch (er) { /* ignore */ } } }
      else refreshToolParts();
    }
    else if (k === "base") { f.base = v; refreshToolParts(); }
    else if (k === "r6-q") { S.ui.r6.q = v; S.ui.r6.page = 0; renderTable(); }
  });
  document.addEventListener("change", function (e) {
    var k = e.target.getAttribute && e.target.getAttribute("data-in");
    if (e.target.id === "file-input" && e.target.files && e.target.files[0]) { readFile(e.target.files[0]); return; }
    if (!k) return;
    var v = e.target.value, f = S.form;
    if (k === "platform") f.platform = +v;
    else if (k === "provider") { f.provider = v; renderTool(); }
    else if (k === "textCol" || k === "ratingCol" || k === "dateCol" || k === "followCol") { f.file[k] = +v; renderTool(); }
    else if (k === "r6-aspect") { S.ui.r6.aspect = v; S.ui.r6.page = 0; renderTable(); }
  });
  // drag and drop onto the drop zone
  ["dragenter", "dragover"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      var z = e.target.closest && e.target.closest("#dropzone");
      if (!z) return;
      e.preventDefault();
      var box = $("dropzone-box"); if (box) box.classList.add("border-border-focus", "bg-surface-interactive/40");
    });
  });
  document.addEventListener("dragleave", function (e) {
    var z = e.target.closest && e.target.closest("#dropzone");
    var box = $("dropzone-box"); if (z && box) box.classList.remove("border-border-focus", "bg-surface-interactive/40");
  });
  document.addEventListener("drop", function (e) {
    var z = e.target.closest && e.target.closest("#dropzone");
    if (!z) return;
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  });

  // ------------------------------------------------------------------ motion: reveal on scroll, count-up, bars
  var io = null;
  function observeReveal() {
    var els = document.querySelectorAll(".reveal:not(.is-in)");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      runCounters(document); growBars(document);
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add("is-in");
          runCounters(en.target); growBars(en.target);
          io.unobserve(en.target);
        });
      }, { root: scroller(), threshold: 0.12 });
    }
    els.forEach(function (el) { io.observe(el); });
    // sections already on screen
    requestAnimationFrame(function () { growBars(document.getElementById("results")); });
  }
  function runCounters(root) {
    root.querySelectorAll("[data-count]").forEach(function (el) {
      var target = +el.getAttribute("data-count");
      el.removeAttribute("data-count");
      if (reduceMotion) { el.textContent = fmt(target); return; }
      var t0 = performance.now();
      var step = function (now) {
        var p = Math.min(1, (now - t0) / 800), e2 = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(target * e2));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function growBars(root) {
    if (!root) return;
    root.querySelectorAll(".ri-bar[data-w]").forEach(function (b) {
      var r = b.getBoundingClientRect();
      if (r.top < frameHeight() && r.bottom > 0) { b.style.width = b.getAttribute("data-w") + "%"; b.removeAttribute("data-w"); }
    });
  }

  // ------------------------------------------------------------------ boot
  function renderAll(keepScroll) {
    var y = scroller().scrollTop;
    renderNav(); renderLanding(); renderTool(); renderResults(); renderFooter();
    if (keepScroll) scroller().scrollTop = y;
    observeReveal();
  }
  // mobile: Analyze button sticks to the bottom inside the tool (PRD section 9)
  var sticky = document.createElement("style");
  sticky.textContent = "@media (max-width: 639px){.ri-sticky-cta{position:sticky;bottom:0;z-index:20;background:#0A0A0A;border-top:1px solid rgba(255,255,255,0.08);padding:12px 0;margin:0 -16px;padding-left:16px;padding-right:16px;}}";
  document.head.appendChild(sticky);

  scroller().addEventListener("scroll", function () { growBars(document.getElementById("results")); }, { passive: true });
  try { window.parent.addEventListener("resize", syncHeight); } catch (e) { window.addEventListener("resize", syncHeight); }
  // Streamlit can miss a ready message sent before the iframe's load event, so repeat it until the first render.
  var gotRender = false;
  window.addEventListener("message", function (e) { if (e.data && e.data.type === "streamlit:render") gotRender = true; });
  var ready = function () {
    if (gotRender) return;
    post("streamlit:componentReady", { apiVersion: 1 });
    syncHeight();
    setTimeout(ready, 400);
  };
  ready();
  // Render once even before Streamlit answers, so the page is never blank.
  setTimeout(function () { if (!S.rendered) { S.rendered = true; S.args = S.args || {}; renderAll(); } }, 1500);
})();
