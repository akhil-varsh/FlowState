"""Pydantic data models for FlowState.

These are the single source of truth for the snapshot and summary shapes. The
VS Code extension and the dashboard mirror these as TypeScript types (see
``extension/src/types.ts`` and ``dashboard/src/types.ts``) — keep the three in
sync in spirit.

Design intent: a snapshot is *compact* (~2-8 KB). It captures structured ground
truth from the tools that expose it, never raw file dumps or screen scrapes.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid.uuid4())


class Trigger(str, Enum):
    focus_loss = "focus_loss"
    idle = "idle"
    calendar = "calendar"
    manual = "manual"
    # Phase 10 — OS-wide observer and interruption causes.
    passive = "passive"        # continuous observer sample
    meeting = "meeting"        # foreground switched to a meeting app
    screen_lock = "screen_lock"  # workstation lock event


class EventType(str, Enum):
    """What a stored snapshot represents.

    ``snapshot`` is the editor-tier restore point (the default; the restore path
    reads only these). The others are Phase-10 additions for the day-long,
    cross-application record that powers the interruption buffer and the
    end-of-day manager report.
    """

    snapshot = "snapshot"
    passive_snapshot = "passive_snapshot"
    start_of_day = "start_of_day"
    end_of_day = "end_of_day"


class Severity(str, Enum):
    error = "error"
    warning = "warning"
    info = "info"


# --------------------------------------------------------------------------
# Snapshot sub-models
# --------------------------------------------------------------------------
class GitState(BaseModel):
    branch: str = ""
    dirty_files: List[str] = Field(default_factory=list)
    diff_summary: str = ""
    recent_commits: List[str] = Field(default_factory=list)


class Workspace(BaseModel):
    root: str = ""
    name: str = ""
    git: Optional[GitState] = None


class Cursor(BaseModel):
    line: int = 0
    col: int = 0


class EditorState(BaseModel):
    active_file: str = ""
    cursor: Cursor = Field(default_factory=Cursor)
    selection: str = ""
    open_files: List[str] = Field(default_factory=list)
    # e.g. "auth.py:130-145"
    recently_edited: List[str] = Field(default_factory=list)
    # Phase 10 deep profiling (Start/End of Day): a bounded, sanitized excerpt of
    # the active file read from disk, plus its inferred architectural role.
    active_file_excerpt: str = ""
    file_role: str = ""


class TerminalCommand(BaseModel):
    cmd: str
    exit_code: Optional[int] = None
    output_tail: str = ""


class TerminalState(BaseModel):
    recent_commands: List[TerminalCommand] = Field(default_factory=list)


class Diagnostic(BaseModel):
    file: str
    line: int = 0
    severity: Severity = Severity.error
    message: str = ""


class AmbientState(BaseModel):
    active_app: str = ""
    clipboard_recent: List[str] = Field(default_factory=list)
    # optional; titles/URLs only, never page content
    browser_tabs: List[str] = Field(default_factory=list)
    # Phase 10: how long this app has held the foreground (seconds), for the
    # cross-application activity timeline. 0 when unknown.
    foreground_seconds: float = 0.0


# --------------------------------------------------------------------------
# Top-level snapshot
# --------------------------------------------------------------------------
class Snapshot(BaseModel):
    id: str = Field(default_factory=_new_id)
    timestamp: datetime = Field(default_factory=_utcnow)
    trigger: Trigger = Trigger.manual
    workspace: Workspace = Field(default_factory=Workspace)
    editor: EditorState = Field(default_factory=EditorState)
    terminal: TerminalState = Field(default_factory=TerminalState)
    diagnostics: List[Diagnostic] = Field(default_factory=list)
    ambient: AmbientState = Field(default_factory=AmbientState)
    # Phase 10 classification. Defaults keep existing editor captures as
    # ``snapshot`` (the restore points). Passive observer samples, start/end-of-day
    # captures, and the interruption-buffer flag live here.
    event_type: EventType = EventType.snapshot
    is_interruption_buffer: bool = False


# --------------------------------------------------------------------------
# Summary (the model's structured output — enforced via JSON schema)
# --------------------------------------------------------------------------
class Summary(BaseModel):
    headline: str
    what_you_were_doing: str
    next_step: str
    open_threads: List[str] = Field(default_factory=list)
    # e.g. "auth.py:142"
    files_to_reopen: List[str] = Field(default_factory=list)


# --------------------------------------------------------------------------
# API response envelopes
# --------------------------------------------------------------------------
class RestoreResponse(BaseModel):
    """What GET /restore returns.

    In Phase 1 ``summary`` is None (echo only). From Phase 3 it holds the real
    model-generated briefing.
    """

    snapshot: Snapshot
    summary: Optional[Summary] = None


class HistoryItem(BaseModel):
    id: str
    timestamp: datetime
    trigger: Trigger
    workspace_name: str
    headline: str = ""


class SearchHit(BaseModel):
    id: str
    timestamp: datetime
    workspace_name: str
    summary_text: str
    score: float


class SnapshotAck(BaseModel):
    id: str
    stored: bool = True
    # True when the snapshot was dropped because recording is paused.
    paused: bool = False


class RecordingState(BaseModel):
    enabled: bool


class RehydrateRequest(BaseModel):
    """Ask the extension to reopen these targets. Each is "relpath" or
    "relpath:line" (1-based line)."""

    targets: List[str] = Field(default_factory=list)
    workspace: Optional[str] = None


class RehydrateAck(BaseModel):
    dispatched: bool
    extension_connected: bool
    targets: List[str] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Phase 10 — cross-application restoration, daily report, start/end of day
# --------------------------------------------------------------------------
class ContextRestoration(BaseModel):
    """The model's structured output for multi-application context restoration.

    Answers: what were you doing, across which tools, and the immediate next
    step — connecting rapid context switches into one intent narrative.
    """

    headline: str
    narrative: List[str] = Field(default_factory=list)  # 2-3 bullet points
    tools_used: List[str] = Field(default_factory=list)
    next_step: str = ""


class ActivityEvent(BaseModel):
    """One entry in the reconstructed pre-interruption activity timeline."""

    timestamp: datetime
    app: str = ""
    clipboard: str = ""
    detail: str = ""
    foreground_seconds: float = 0.0


class RestoreContextResponse(BaseModel):
    status: str = "ok"  # "ok" | "deferred" | "empty"
    message: str = ""
    interruption_at: Optional[datetime] = None
    restoration: Optional[ContextRestoration] = None
    events: List[ActivityEvent] = Field(default_factory=list)
    cpu_percent: float = 0.0


class DailyReport(BaseModel):
    """The manager-facing end-of-day report (the model's structured output)."""

    primary_objectives: List[str] = Field(default_factory=list)
    files_components_altered: List[str] = Field(default_factory=list)
    cross_tool_tasks: List[str] = Field(default_factory=list)
    status_and_blockers: List[str] = Field(default_factory=list)


class DailyReportResponse(BaseModel):
    status: str = "ok"  # "ok" | "deferred"
    message: str = ""
    date: str = ""
    workspace: str = ""
    snapshots_analyzed: int = 0
    report: Optional[DailyReport] = None
    report_markdown: str = ""
    cloud: dict = Field(default_factory=dict)
    cpu_percent: float = 0.0


class DeepCaptureResponse(BaseModel):
    """What POST /start-day and POST /end-day return."""

    status: str = "ok"
    event_type: EventType = EventType.start_of_day
    snapshot: Optional[Snapshot] = None
    message: str = ""


class ObserverStatus(BaseModel):
    """Live monitoring state for the dashboard status card."""

    observer_enabled: bool = True
    recording: bool = True
    cpu_percent: float = 0.0
    cpu_deferring: bool = False
    active_app: str = ""
    idle_seconds: float = 0.0
    screen_locked: bool = False
    interruption_active: bool = False
    interruption_at: Optional[datetime] = None
    interruption_cause: str = ""
    last_observation_at: Optional[datetime] = None
    observations_today: int = 0
