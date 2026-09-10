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
