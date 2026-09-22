"""Local inference — turn a Snapshot into a structured "where you left off" Summary.

Uses the Ollama Python client against the LOCAL server only. Output is forced
to valid JSON via Ollama's ``format`` field (we pass the Summary JSON schema),
so we never parse freeform text.

Design rules honored here:
- On-demand only. Nothing runs in the background; ``summarize`` is called from
  GET /restore when the user returns.
- Small prompts. The snapshot is already structured — we render a compact text
  view of it, never dumping raw file contents.
- Graceful degradation. If Ollama is down or the model is missing, we return a
  deterministic fallback Summary built directly from the snapshot, so /restore
  always returns something useful.
"""

from __future__ import annotations

import json
import re
from typing import Optional

from datetime import timezone
from typing import List

from .config import config
from .models import ActivityEvent, ContextRestoration, DailyReport, Snapshot, Summary

try:  # pragma: no cover - import guard
    from ollama import Client as _OllamaClient

    _HAS_OLLAMA = True
except Exception:  # pragma: no cover
    _OllamaClient = None  # type: ignore
    _HAS_OLLAMA = False


SYSTEM_PROMPT = (
    "You are a context-restoration assistant. Given a structured snapshot of a "
    "developer's interrupted work session, produce a concise, specific briefing "
    "that lets them resume instantly. Be concrete: name the file, line, error, "
    "and the single most likely next step. Output only the JSON matching the schema."
)

_TEMPERATURE = 0.2
_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


class InferenceUnavailable(RuntimeError):
    """Raised internally when the local model cannot be reached; callers get a
    fallback summary instead of an error."""


def _client():
    if not _HAS_OLLAMA:
        raise InferenceUnavailable("ollama python client not installed")
    return _OllamaClient(host=config.ollama_host)


# --------------------------------------------------------------------------
# Prompt construction — compact, structured, no raw file dumps
# --------------------------------------------------------------------------
def render_snapshot(snap: Snapshot) -> str:
    lines: list[str] = []
    ws = snap.workspace
    branch = ws.git.branch if ws.git else ""
    header = f"WORKSPACE: {ws.name or '(unknown)'}"
    if branch:
        header += f" (branch {branch})"
    lines.append(header)

    if ws.git:
        g = ws.git
        if g.dirty_files:
            lines.append(f"GIT dirty: {', '.join(g.dirty_files)}")
        if g.diff_summary:
            lines.append(f"GIT diff: {g.diff_summary}")
        if g.recent_commits:
            lines.append("GIT recent commits: " + "; ".join(g.recent_commits))

    e = snap.editor
    if e.active_file:
        loc = f"{e.active_file}:{e.cursor.line}:{e.cursor.col}"
        ed = f"EDITOR active: {loc}"
        if e.selection:
            ed += f'  selection="{e.selection.strip()[:120]}"'
        lines.append(ed)
    if e.open_files:
        lines.append("EDITOR open: " + ", ".join(e.open_files))
    if e.recently_edited:
        lines.append("EDITOR recently edited: " + ", ".join(e.recently_edited))

    if snap.terminal.recent_commands:
        lines.append("TERMINAL:")
        for c in snap.terminal.recent_commands[-5:]:
            code = "" if c.exit_code is None else f" (exit {c.exit_code})"
            lines.append(f"  $ {c.cmd}{code}")
            tail = (c.output_tail or "").strip()
            if tail:
                lines.append(f"      {tail[:200]}")

    if snap.diagnostics:
        lines.append("DIAGNOSTICS:")
        for d in snap.diagnostics[:8]:
            lines.append(f"  {d.file}:{d.line} {d.severity.value}: {d.message}")

    a = snap.ambient
    amb: list[str] = []
    if a.active_app:
        amb.append(f"app={a.active_app}")
    if a.clipboard_recent:
        amb.append("clipboard=" + " | ".join(a.clipboard_recent[:3]))
    if a.browser_tabs:
        amb.append("tabs=" + ", ".join(a.browser_tabs[:5]))
    if amb:
        lines.append("AMBIENT: " + "; ".join(amb))

    return "\n".join(lines)


def build_prompt(snap: Snapshot) -> str:
    return (
        "Here is a structured snapshot of my interrupted work session.\n"
        "Produce the resume briefing as JSON.\n\n"
        f"{render_snapshot(snap)}"
    )


# --------------------------------------------------------------------------
# Summarize
# --------------------------------------------------------------------------
def summarize(snap: Snapshot, model: Optional[str] = None) -> Summary:
    """Return a structured Summary for the snapshot.

    Always returns a Summary — falls back to a deterministic one if the local
    model is unavailable or returns something unparseable.
    """
    model_name = model or config.model
    try:
        return _summarize_with_model(snap, model_name)
    except Exception as err:  # includes InferenceUnavailable, connection errors
        print(f"[FlowState] inference fallback ({type(err).__name__}: {err})")
        return fallback_summary(snap)


def _summarize_with_model(snap: Snapshot, model_name: str) -> Summary:
    client = _client()
    schema = Summary.model_json_schema()

    resp = client.chat(
        model=model_name,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_prompt(snap)},
        ],
        format=schema,  # grammar-constrained structured output
        options={"temperature": _TEMPERATURE},
        keep_alive=config.ollama_keep_alive,
    )

    content = _extract_content(resp)
    content = _THINK_RE.sub("", content).strip()  # strip stray reasoning tags
    data = json.loads(content)
    summary = Summary.model_validate(data)
    return _backfill(summary, snap)


def _backfill(summary: Summary, snap: Snapshot) -> Summary:
    """Guarantee the fields that drive rehydration are present.

    Small models sometimes leave ``files_to_reopen`` empty. That field is not
    prose — it comes straight from the snapshot — so we fill it deterministically
    when the model omits it, rather than trusting the model to echo file paths.
    """
    if not summary.files_to_reopen:
        files: list[str] = []
        e = snap.editor
        if e.active_file:
            files.append(f"{e.active_file}:{e.cursor.line}")
        files += [f for f in e.open_files if f != e.active_file][:4]
        summary.files_to_reopen = files
    return summary


def _extract_content(resp) -> str:
    # ollama>=0.4 returns an object with .message.content; older returns a dict.
    msg = getattr(resp, "message", None)
    if msg is not None and getattr(msg, "content", None) is not None:
        return msg.content
    if isinstance(resp, dict):
        return resp.get("message", {}).get("content", "")
    return str(resp)


# --------------------------------------------------------------------------
# Deterministic fallback (no model needed)
# --------------------------------------------------------------------------
def fallback_summary(snap: Snapshot) -> Summary:
    """Build a useful Summary straight from the structured snapshot.

    This runs when the local model is unreachable. It is not as fluent as the
    model, but it is always specific because the snapshot already is.
    """
    e = snap.editor
    active = e.active_file or "(no active file)"
    loc = f"{active}:{e.cursor.line}" if e.active_file else active

    # Find the most relevant signal for "what you were doing".
    err = next((d for d in snap.diagnostics if d.severity.value == "error"), None)
    failing_cmd = next(
        (c for c in snap.terminal.recent_commands if c.exit_code not in (0, None)),
        None,
    )

    parts = [f"Editing {loc}"]
    branch = snap.workspace.git.branch if snap.workspace.git else ""
    if branch:
        parts.append(f"on branch {branch}")
    if failing_cmd:
        parts.append(f"— `{failing_cmd.cmd}` failed")
    what = " ".join(parts) + "."

    if err:
        next_step = f"Resolve {err.severity.value} at {err.file}:{err.line} — {err.message}"
    elif failing_cmd and failing_cmd.output_tail:
        next_step = f"Investigate: {failing_cmd.output_tail.strip()[:160]}"
    else:
        next_step = f"Continue where the cursor is, {loc}."

    open_threads: list[str] = []
    if snap.ambient.browser_tabs:
        open_threads += [f"tab: {t}" for t in snap.ambient.browser_tabs[:3]]
    if snap.workspace.git and snap.workspace.git.dirty_files:
        open_threads.append(
            "uncommitted: " + ", ".join(snap.workspace.git.dirty_files[:5])
        )

    files = []
    if e.active_file:
        files.append(f"{e.active_file}:{e.cursor.line}")
    files += [f for f in e.open_files if f != e.active_file][:4]

    headline = f"Resuming work on {active}"
    if err:
        headline = f"Fixing {err.message[:50]} in {err.file}"

    return Summary(
        headline=headline,
        what_you_were_doing=what,
        next_step=next_step,
        open_threads=open_threads,
        files_to_reopen=files,
    )


# --------------------------------------------------------------------------
# Search digests — the short text indexed by the cold store (no LLM needed)
# --------------------------------------------------------------------------
def digest_text(snap: Snapshot) -> str:
    """A compact, human-readable line describing a snapshot, for semantic search.

    Built deterministically from the snapshot (via the fallback summary) so it is
    available at capture time without invoking the model. /restore later upserts
    a richer, model-written digest via ``summary_digest``.
    """
    s = fallback_summary(snap)
    return summary_digest(s)


def summary_digest(summary: Summary) -> str:
    """One searchable paragraph from a Summary (model- or fallback-generated)."""
    parts = [summary.headline, summary.what_you_were_doing]
    if summary.next_step:
        parts.append(f"Next: {summary.next_step}")
    if summary.open_threads:
        parts.append("Threads: " + "; ".join(summary.open_threads[:4]))
    return " ".join(p.strip() for p in parts if p and p.strip())


# ==========================================================================
# Phase 10 — cross-application restoration + end-of-day manager report
# ==========================================================================
RESTORE_CONTEXT_SYSTEM = (
    "You are a context-restoration assistant. You are given a chronological "
    "timeline of a developer's activity across multiple applications in the "
    "minutes before an interruption (a meeting, a call, or stepping away). "
    "Connect the rapid context switches into ONE unified intent narrative — not "
    "isolated events. Explain what they were doing, across which tools, and the "
    "immediate next step. Be concrete and brief. Output only JSON matching the schema."
)

DAILY_REPORT_SYSTEM = (
    "You are writing a concise, plain-English end-of-day progress report for a "
    "manager. You are given a developer's start-of-day baseline, a timeline of "
    "their activity across applications, and their end-of-day state. Summarize "
    "what was accomplished — objectives tackled, files/components changed (in "
    "plain English), cross-tool tasks performed, and end-of-day status/blockers. "
    "Do not invent details not supported by the input. Output only JSON matching the schema."
)


def _fmt_ts(dt) -> str:
    try:
        return dt.astimezone(timezone.utc).strftime("%H:%M:%S")
    except Exception:
        return ""


def render_activity_timeline(snaps: List[Snapshot]) -> str:
    """A compact chronological view of cross-application activity for the model."""
    lines: List[str] = []
    for s in snaps:
        t = _fmt_ts(s.timestamp)
        a = s.ambient
        detail = ""
        if s.editor.active_file:
            detail = f'FILE "{s.editor.active_file}:{s.editor.cursor.line}"'
        app = a.active_app or (s.workspace.name or "activity")
        seg = f"[{t}] APP: {app}"
        if a.foreground_seconds:
            seg += f" | DUR: {int(a.foreground_seconds)}s"
        if detail:
            seg += f" | {detail}"
        if a.clipboard_recent:
            seg += f' | CLIPBOARD: "{a.clipboard_recent[0][:80]}"'
        lines.append(seg)
    return "\n".join(lines)


def to_activity_events(snaps: List[Snapshot]) -> List[ActivityEvent]:
    """The structured timeline returned to the dashboard alongside the narrative."""
    events: List[ActivityEvent] = []
    for s in snaps:
        clip = s.ambient.clipboard_recent[0] if s.ambient.clipboard_recent else ""
        detail = ""
        if s.editor.active_file:
            detail = f"{s.editor.active_file}:{s.editor.cursor.line}"
        events.append(
            ActivityEvent(
                timestamp=s.timestamp,
                app=s.ambient.active_app or s.workspace.name,
                clipboard=clip,
                detail=detail,
                foreground_seconds=s.ambient.foreground_seconds,
            )
        )
    return events


def restore_context(snaps: List[Snapshot], model: Optional[str] = None) -> ContextRestoration:
    """Synthesize a cross-application restoration narrative from the buffer.

    Always returns a ContextRestoration — falls back to a deterministic summary
    built from the timeline if the local model is unavailable.
    """
    if not snaps:
        return ContextRestoration(
            headline="No recent activity to restore.",
            narrative=["Nothing was captured in the lookback window."],
        )
    model_name = model or config.model
    try:
        return _restore_context_with_model(snaps, model_name)
    except Exception as err:
        print(f"[FlowState] restore_context fallback ({type(err).__name__}: {err})")
        return _fallback_restoration(snaps)


def _restore_context_with_model(snaps: List[Snapshot], model_name: str) -> ContextRestoration:
    client = _client()
    schema = ContextRestoration.model_json_schema()
    prompt = (
        "Here is my cross-application activity timeline just before I was "
        "interrupted. Reconstruct what I was doing as JSON.\n\n"
        + render_activity_timeline(snaps)
    )
    resp = client.chat(
        model=model_name,
        messages=[
            {"role": "system", "content": RESTORE_CONTEXT_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        format=schema,
        options={"temperature": _TEMPERATURE},
        keep_alive=config.ollama_keep_alive,
    )
    content = _THINK_RE.sub("", _extract_content(resp)).strip()
    return ContextRestoration.model_validate(json.loads(content))


def _distinct_apps(snaps: List[Snapshot]) -> List[str]:
    apps: List[str] = []
    for s in snaps:
        app = s.ambient.active_app or s.workspace.name
        if app and (not apps or apps[-1] != app) and app not in apps:
            apps.append(app)
    return apps


def _fallback_restoration(snaps: List[Snapshot]) -> ContextRestoration:
    apps = _distinct_apps(snaps)
    files = [s.editor.active_file for s in snaps if s.editor.active_file]
    clips = [s.ambient.clipboard_recent[0] for s in snaps if s.ambient.clipboard_recent]

    narrative: List[str] = []
    if apps:
        narrative.append("Worked across: " + " -> ".join(apps[:6]) + ".")
    if files:
        uniq = list(dict.fromkeys(files))
        narrative.append("Touched files: " + ", ".join(uniq[:5]) + ".")
    if clips:
        narrative.append(f'Recent clipboard: "{clips[-1][:100]}".')
    if not narrative:
        narrative = ["Activity was captured but no distinguishing detail was recorded."]

    last_app = apps[-1] if apps else "your last task"
    return ContextRestoration(
        headline=f"You were working in {apps[0]}" if apps else "Where you left off",
        narrative=narrative,
        tools_used=apps[:6],
        next_step=f"Resume in {last_app}.",
    )


def daily_report(
    start: Optional[Snapshot],
    activity: List[Snapshot],
    end: Optional[Snapshot],
    model: Optional[str] = None,
) -> DailyReport:
    """Generate the manager-facing end-of-day report.

    Robust to model quality: a deterministic base report (always populated from
    captured facts) is computed first, then the local model's output is merged in
    where it genuinely adds value. Factual fields (files changed, git blockers)
    stay deterministic; the model contributes prose objectives / cross-tool
    narrative when it produces them. If the model is unavailable, the base report
    stands on its own.
    """
    model_name = model or config.model
    base = _fallback_report(start, activity, end)
    try:
        llm = _daily_report_with_model(start, activity, end, model_name)
    except Exception as err:
        print(f"[FlowState] daily_report fallback ({type(err).__name__}: {err})")
        return base
    return DailyReport(
        # Prose fields: prefer the model when it produced something, else the base.
        primary_objectives=llm.primary_objectives or base.primary_objectives,
        cross_tool_tasks=llm.cross_tool_tasks or base.cross_tool_tasks,
        # Factual fields: keep deterministic (accurate) unless the base is empty.
        files_components_altered=base.files_components_altered or llm.files_components_altered,
        status_and_blockers=base.status_and_blockers or llm.status_and_blockers,
    )


def _render_state(label: str, snap: Optional[Snapshot]) -> str:
    if snap is None:
        return f"{label}: (not captured)"
    parts = [f"{label}:"]
    ws = snap.workspace
    if ws.name:
        parts.append(f"  workspace={ws.name}")
    if ws.git:
        if ws.git.branch:
            parts.append(f"  branch={ws.git.branch}")
        if ws.git.dirty_files:
            parts.append("  uncommitted=" + ", ".join(ws.git.dirty_files[:8]))
    if snap.editor.active_file:
        parts.append(
            f"  active_file={snap.editor.active_file} ({snap.editor.file_role or 'source'})"
        )
    return "\n".join(parts)


def _daily_report_with_model(start, activity, end, model_name) -> DailyReport:
    client = _client()
    schema = DailyReport.model_json_schema()
    prompt = (
        "Summarize my workday as a manager report in JSON.\n\n"
        + _render_state("START OF DAY", start)
        + "\n\nACTIVITY TIMELINE:\n"
        + (render_activity_timeline(activity) or "  (no continuous activity recorded)")
        + "\n\n"
        + _render_state("END OF DAY", end)
    )
    resp = client.chat(
        model=model_name,
        messages=[
            {"role": "system", "content": DAILY_REPORT_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        format=schema,
        options={"temperature": _TEMPERATURE},
        keep_alive=config.ollama_keep_alive,
    )
    content = _THINK_RE.sub("", _extract_content(resp)).strip()
    return DailyReport.model_validate(json.loads(content))


def _fallback_report(start, activity, end) -> DailyReport:
    apps = _distinct_apps(activity)
    files = list(
        dict.fromkeys(
            [s.editor.active_file for s in activity if s.editor.active_file]
            + ([end.editor.active_file] if end and end.editor.active_file else [])
        )
    )
    end_dirty = end.workspace.git.dirty_files if (end and end.workspace.git) else []

    objectives = []
    if end and end.workspace.name:
        objectives.append(f"Progressed work in {end.workspace.name}.")
    if files:
        objectives.append("Focused on: " + ", ".join(files[:5]) + ".")

    cross_tool = []
    non_code = [a for a in apps if a and "code" not in a.lower()]
    if non_code:
        cross_tool.append("Used other tools: " + ", ".join(non_code[:5]) + ".")

    blockers = []
    if end_dirty:
        blockers.append("Uncommitted at end of day: " + ", ".join(end_dirty[:8]) + ".")

    return DailyReport(
        primary_objectives=objectives or ["Continued development work."],
        files_components_altered=files[:10],
        cross_tool_tasks=cross_tool,
        status_and_blockers=blockers or ["No blockers recorded."],
    )


def report_to_markdown(report: DailyReport, date: str = "", workspace: str = "") -> str:
    """Render the structured report as a 1-page Markdown document for the viewer."""
    def _section(title: str, items: List[str]) -> str:
        if not items:
            return f"## {title}\n\n_None recorded._\n"
        body = "\n".join(f"- {i}" for i in items)
        return f"## {title}\n\n{body}\n"

    head = "# End-of-Day Progress Report\n"
    meta = []
    if date:
        meta.append(f"**Date:** {date}")
    if workspace:
        meta.append(f"**Workspace:** {workspace}")
    meta_line = ("  \n".join(meta) + "\n") if meta else ""
    return "\n".join(
        [
            head,
            meta_line,
            _section("Primary Objectives Tackled", report.primary_objectives),
            _section("Files & Components Altered", report.files_components_altered),
            _section("Cross-Tool Tasks Performed", report.cross_tool_tasks),
            _section("End-of-Day Status & Blockers", report.status_and_blockers),
        ]
    )


def health() -> dict:
    """Cheap check for whether local inference is available (used by /health)."""
    info: dict = {"ollama_installed": _HAS_OLLAMA, "model": config.model}
    if not _HAS_OLLAMA:
        info["available"] = False
        return info
    try:
        client = _client()
        resp = client.list()
        raw = resp.get("models", []) if isinstance(resp, dict) else getattr(resp, "models", [])
        names = []
        for m in raw:
            name = m.get("model") if isinstance(m, dict) else getattr(m, "model", "")
            if name:
                names.append(name)
        info["available"] = True
        info["model_present"] = any(config.model in n for n in names)
    except Exception as err:
        info["available"] = False
        info["error"] = str(err)
    return info
