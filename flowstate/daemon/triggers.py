"""Trigger policy — the single source of truth for when snapshots fire.

FlowState captures automatically on interruption:
- ``focus_loss`` : the editor window loses focus for at least
  ``focus_debounce_seconds`` (a quick alt-tab does NOT fire).
- ``idle``       : no editor activity for ``idle_seconds`` while still focused.
- ``manual``     : the user hits the capture hotkey.

The detection itself happens in the VS Code extension, because that is where
the reliable focus/activity events live (``onDidChangeWindowState`` and the
editor event stream) — this keeps monitoring event-driven and near-zero CPU,
with no background polling. The *policy* (the thresholds) lives here in the
daemon and is served to the extension via ``GET /config`` so there is one
authoritative place to tune it. A ``min_capture_interval_seconds`` cooldown
prevents automatic snapshots from piling up.
"""

from __future__ import annotations

from pydantic import BaseModel

from .config import config


class TriggerPolicy(BaseModel):
    focus_debounce_seconds: int
    idle_seconds: int
    min_capture_interval_seconds: int


def get_policy() -> TriggerPolicy:
    return TriggerPolicy(
        focus_debounce_seconds=config.focus_debounce_seconds,
        idle_seconds=config.idle_seconds,
        min_capture_interval_seconds=config.min_capture_interval_seconds,
    )
