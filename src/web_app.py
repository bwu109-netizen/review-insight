"""Glue between the Stitch-style front end (ui/) and the analysis pipeline.

The page is one Streamlit custom component. It sends events (analyze / stop / reset / lang / ack);
the analysis runs in a background thread and a fragment re-renders the component every second
with progress, then with the results."""
from __future__ import annotations

import math
import os
import threading
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

import custom
from generate_taxonomy import SYSTEM as TAXONOMY_SYSTEM
from llm_client import PROVIDERS, LLMError, make_client

UI_DIR = Path(__file__).resolve().parent.parent / "ui"
_component = components.declare_component("review_insight", path=str(UI_DIR))

PAGE_CSS = """<style>
header[data-testid="stHeader"], [data-testid="stToolbar"], [data-testid="stDecoration"], footer {display:none !important;}
html, body, .stApp, [data-testid="stAppViewContainer"] {background:#0e0e0e !important; overflow:hidden !important;}
[data-testid="stMainBlockContainer"], .block-container {padding:0 !important; max-width:100% !important;}
iframe[data-testid="stCustomComponentV1"] {position:fixed; inset:0; width:100vw !important; height:100vh !important; height:100dvh !important; border:0; z-index:5;}
[data-stale="true"] {opacity:1 !important; transition:none !important;}
</style>"""


def server_gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "")
    try:
        key = key or st.secrets.get("GEMINI_API_KEY", "")
    except Exception:  # noqa: BLE001  (no secrets file locally)
        pass
    return key


class _Watched:
    """Wraps the LLM client: reports the stage and lets the user stop the run."""

    def __init__(self, client, job):
        self._c, self._job = client, job
        self.name, self.model = client.name, getattr(client, "model", "")

    def complete_json(self, system, user):
        if self._job["stop"]:
            raise LLMError("stopped by user")
        if system == TAXONOMY_SYSTEM:
            out = self._c.complete_json(system, user)
            self._job["n_aspects"] = len(out.get("aspects", []))
            return out
        if self._job["stage"] < 3:
            self._job["stage"] = 3
            self._job["t3"] = time.time()
        return self._c.complete_json(system, user)


def _classify(msg: str) -> tuple[str, str]:
    low = msg.lower()
    for code in ("401", "403"):
        if f"http {code}" in low:
            return "key", code
    if "api key not valid" in low or "api_key_invalid" in low or "key is empty" in low:
        return "key", ""
    if "http 404" in low or "model name is empty" in low:
        return "model", "404" if "404" in low else ""
    if "base url is empty" in low:
        return "base", ""
    return "general", ""


def _nan(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else v


def _payload(job, tax, R, A, brief, brief_err, run_err, sample, category, model):
    reason = None
    if run_err:
        reason = "stop" if job["stop"] else "quota" if ("429" in run_err or "quota" in run_err.lower()
                                                         or "rate limit" in run_err.lower()) else "other"
    return {
        "id": job["id"],
        "meta": {"category": category, "n_total": sample.attrs.get("n_total", len(sample)), "n_sample": len(sample),
                 "n_labeled": len(R), "sampled": bool(sample.attrs.get("sampled")),
                 "stratified": bool(sample.attrs.get("stratified")), "run_err": run_err, "reason_kind": reason,
                 "brief_err": brief_err, "model": model, "taxonomy_source": tax.get("source", "hand-written"),
                 "date": datetime.now().strftime("%Y-%m-%d")},
        "aspects": [{k: a.get(k, "") for k in ("key", "label_en", "label_zh", "owner", "description")}
                    for a in tax["aspects"]],
        "reviews": [{"i": int(r.review_id), "t": str(r.text), "r": _nan(r.rating), "s": r.overall_sentiment,
                     "rc": _nan(r.root_cause), "rp": _nan(r.repurchase), "h": bool(r.hidden_issue)}
                    for r in R.itertuples()],
        "mentions": [{"i": int(m.review_id), "a": m.aspect, "s": m.sentiment, "e": _nan(m.evidence)}
                     for m in A.itertuples()],
        "brief": brief,
    }


def _run(job, client, sample, category, lang, model):
    _, _, batch = custom.speed_for(client)
    job["batches"] = -(-len(sample) // batch)

    def progress(done, total):
        job.update(done=done, total=total, batch=-(-done // batch))
        el = time.time() - (job["t3"] or job["t0"])
        job["eta"] = el / done * (total - done) if done else None

    try:
        tax, R, A, _, run_err = custom.run_custom(_Watched(client, job), sample, category, progress=progress)
    except (LLMError, RuntimeError) as e:
        kind, code = _classify(str(e))
        if job["stop"]:
            kind = "general"
        job.update(status="error", error=str(e), error_kind=kind, error_code=code)
        return
    brief, brief_err = None, None
    if not run_err or job["stop"]:
        job["stage"] = 4
        try:
            brief = custom.make_brief(client, R, A, tax, lang)
        except Exception as e:  # noqa: BLE001  (labels are still useful without a brief)
            brief_err = str(e)
    job["result"] = _payload(job, tax, R, A, brief, brief_err, run_err, sample, category, model)
    job["status"] = "done"


def _start(ev):
    st.session_state.result = None
    provider = ev.get("provider", "gemini")
    key = ev.get("key") or (server_gemini_key() if provider == "gemini" else "")
    jid = st.session_state.get("job", {}).get("id", 0) + 1
    job = dict(id=jid, status="running", stage=2, done=0, total=0, batch=0, batches=0, eta=None, n_rows=0,
               n_aspects=None, error=None, error_kind=None, error_code="", stop=False, t0=time.time(), t3=None, result=None)
    st.session_state.job = job
    texts = ev.get("texts") or []
    ratings, dates = ev.get("ratings"), ev.get("dates")
    strata = None
    parts = []
    if ratings:
        parts.append(pd.to_numeric(pd.Series(ratings), errors="coerce").round().astype("string").fillna("?"))
    if dates:
        parts.append(pd.to_datetime(pd.Series(dates), errors="coerce").dt.strftime("%Y-%m").fillna("?"))
    if parts:
        strata = (parts[0] if len(parts) == 1 else parts[0] + "|" + parts[1]).tolist()
    kind = custom.provider_kind(provider)
    n_use = min(int(ev.get("n_use") or custom.SAMPLE_SIZE), custom.limit_for(kind))
    try:
        sample = custom.to_sample(texts, ev.get("category", ""), ev.get("platform", ""), max_n=n_use,
                                  ratings=ratings, strata=strata)
        if sample.empty:
            raise RuntimeError("No usable reviews found. Check the review text column.")
        client = make_client(provider, key, ev.get("model", ""), ev.get("base_url", ""))
    except (LLMError, RuntimeError) as e:
        kind_, code = _classify(str(e))
        job.update(status="error", error=str(e), error_kind=kind_, error_code=code)
        return
    job.update(total=len(sample), n_rows=sample.attrs.get("n_total", len(sample)))
    threading.Thread(target=_run, daemon=True,
                     args=(job, client, sample, ev.get("category", ""), ev.get("lang", "en"),
                           getattr(client, "model", ""))).start()


def _handle(ev) -> bool:
    """Returns True if the app should rerun to send new args."""
    if not isinstance(ev, dict) or ev.get("id", 0) <= st.session_state.handled:
        return False
    st.session_state.handled = ev["id"]
    typ = ev.get("type")
    if typ == "analyze":
        _start(ev)
    elif typ == "stop" and st.session_state.get("job"):
        st.session_state.job["stop"] = True
    elif typ == "reset":
        st.session_state.result = None
        st.session_state.job = {"id": st.session_state.get("job", {}).get("id", 0), "status": "idle"}
    elif typ == "lang":
        st.session_state.lang = ev.get("lang", "en")
    return typ != "ack"


def main():
    st.markdown(PAGE_CSS, unsafe_allow_html=True)
    ss = st.session_state
    ss.setdefault("handled", 0)
    ss.setdefault("job", {"id": 0, "status": "idle"})
    ss.setdefault("result", None)
    ss.setdefault("lang", "en")
    running = ss.job.get("status") == "running"
    cfg = {"providers": {k: {"model": v.get("model", ""), "key_url": v.get("key_url", "")} for k, v in PROVIDERS.items()},
           "speed": {"gemini": list(custom.SPEED["gemini"]), "default": list(custom.SPEED["default"])},
           "sample": custom.SAMPLE_SIZE, "limits": custom.LIMITS, "server_gemini_key": bool(server_gemini_key())}

    def ui_body():
        job = ss.job
        if job.get("status") == "done" and job.get("result") is not None:
            ss.result, job["result"] = job["result"], None
        public = {k: v for k, v in job.items() if k not in ("result", "t0", "t3")}
        ev = _component(cfg=cfg, job=public, result=ss.result, handled=ss.handled, lang=ss.lang,
                        key="review_insight", default=None)
        if _handle(ev) or (running and job.get("status") != "running"):
            st.rerun()

    st.fragment(run_every=1.0 if running else None)(ui_body)()
