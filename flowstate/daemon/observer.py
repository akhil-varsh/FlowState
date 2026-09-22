"""Continuous observer (Phase 10) — the OS-wide, cross-application data layer.

A sleep-driven background loop samples the active window + clipboard on an
interval so that context spanning multiple apps (VS Code -> Excel -> Word) can be
reconstructed after an interruption. This complements — it does not replace — the
event-driven, editor-tier capture the VS Code extension already provides.

Each sample is stored as a ``passive_snapshot`` (never a restore target). The same
loop runs interruption detection: when input goes idle, the foreground switches to
a meeting app, or the screen locks, it flags the passive snapshots in the
preceding buffer window so the restoration engine can narrate exactly what the
user was doing right before they were pulled away.

Discipline:
- **Respects the kill switch.** Nothing is captured while recording is paused.
- **Respects the CPU governor.** The loop refreshes the CPU sample every tick;
  embedding is skipped while the host is busy (the record is still stored).
- **Fails safe.** Any error in a tick is logged and swallowed; the loop lives on.
- **Costs ~nothing at idle.** It sleeps between samples — no busy polling.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Optional

from . import interruption, recording, resource
from .capture.ambient import collect_ambient
from .config import config
from .models import (
    AmbientState,
    EventType,
    ObserverStatus,
    Snapshot,
    Trigger,
    Workspace,
)
from .realtime import manager
from .sanitize import sanitize_list, sanitize_text

# Passive samples are bucketed under a synthetic workspace so they never collide
# with real projects on the restore path or the dev timeline.
AMBIENT_WORKSPACE = "(ambient)"


class _Runtime:
    """Mutable live state, read by the /observer/status endpoint."""

    def __init__(self) -> None:
        self.enabled: bool = config.observer_enabled
        self.recording: bool = True
        self.idle: float = 0.0
        self.locked: bool = False
        self.active_app: str = ""
        self.last_app_raw: str = ""
        self.last_app_since: float = time.time()
        self.interruption_active: bool = False
        self.interruption_at: Optional[datetime] = None
        self.interruption_cause: str = ""
        self.last_observation_at: Optional[datetime] = None


_rt = _Runtime()


def is_enabled() -> bool:
    return _rt.enabled


def set_enabled(enabled: bool) -> bool:
    _rt.enabled = bool(enabled)
    return _rt.enabled


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def last_interruption() -> tuple[Optional[datetime], str]:
    """The most recent interruption timestamp + cause (for /restore-context)."""
    return _rt.interruption_at, _rt.interruption_cause


def _passive_headline(amb: AmbientState) -> str:
    return (amb.active_app or "activity")[:80]


def _passive_digest(amb: AmbientState) -> str:
    """A short searchable line for the cold index (no LLM)."""
    parts = []
    if amb.active_app:
        parts.append(amb.active_app)
    if amb.clipboard_recent:
        parts.append("clipboard: " + " | ".join(amb.clipboard_recent[:2]))
    return " — ".join(parts)


async def _tick(store, cold) -> None:
    now = time.time()

    # Refresh the CPU sample every tick (feeds the status card + the governor).
    resource.measure(interval=None)

    _rt.recording = recording.is_enabled()
    if not (_rt.enabled and _rt.recording):
        return  # kill switch / observer disabled — sample nothing

    # Native interruption signals.
    idle = interruption.idle_seconds()
    locked = interruption.is_screen_locked()
    _rt.idle = idle
    _rt.locked = locked

    # Active window + clipboard (sync collector, off the event loop).
    amb = await asyncio.to_thread(collect_ambient)
    active_app_raw = amb.active_app or ""
    app_lower = active_app_raw.lower()
    meeting = any(tok in app_lower for tok in config.meeting_apps)

    # Foreground dwell time for the activity timeline.
    if active_app_raw != _rt.last_app_raw:
        _rt.last_app_raw = active_app_raw
        _rt.last_app_since = now
    fg_seconds = max(0.0, now - _rt.last_app_since)

    _rt.active_app = sanitize_text(active_app_raw)

    # Store a passive sample only while the user is actually active — an idle or
    # locked screen produces no activity worth recording, keeping the buffer clean.
    user_active = idle < config.interruption_idle_seconds and not locked
    if user_active and (active_app_raw or amb.clipboard_recent):
        amb.active_app = _rt.active_app
        amb.clipboard_recent = sanitize_list(amb.clipboard_recent)
        amb.browser_tabs = sanitize_list(amb.browser_tabs)
        amb.foreground_seconds = fg_seconds
        snap = Snapshot(
            trigger=Trigger.passive,
            event_type=EventType.passive_snapshot,
            workspace=Workspace(name=AMBIENT_WORKSPACE),
            ambient=amb,
        )
        await store.store(snap, headline=_passive_headline(amb))
        _rt.last_observation_at = snap.timestamp

        # Index for semantic search unless the host is busy (record still stored).
        if not resource.should_defer(sample=False):
            await asyncio.to_thread(
                cold.add, snap.id, AMBIENT_WORKSPACE, now, _passive_digest(amb)
            )

        await manager.to_dashboard(
            {
                "type": "observation",
                "app": _rt.active_app,
                "cpu": round(resource.current(), 1),
                "idle": round(idle, 0),
            }
        )

    # -- interruption state machine ---------------------------------------
    cause: Optional[str] = None
    if idle >= config.interruption_idle_seconds:
        cause = "idle"
    elif locked:
        cause = "screen_lock"
    elif meeting:
        cause = "meeting"

    if cause and not _rt.interruption_active:
        _rt.interruption_active = True
        _rt.interruption_at = _utcnow()
        _rt.interruption_cause = cause
        start = now - config.interruption_buffer_seconds
        flagged = await store.flag_interruption_buffer(start, now)
        await manager.to_dashboard(
            {
                "type": "interruption",
                "cause": cause,
                "at": _rt.interruption_at.isoformat(),
                "buffered": flagged,
            }
        )
        print(f"[FlowState] interruption ({cause}) — flagged {flagged} buffer snapshot(s)")
    elif cause is None and _rt.interruption_active:
        _rt.interruption_active = False
        await manager.to_dashboard({"type": "resumed", "at": _utcnow().isoformat()})


async def run_loop(store, cold) -> None:
    """Background observer. Samples every ``observer_interval_seconds``.

    Cancelled on shutdown via the app lifespan. Errors in a tick are swallowed so
    a single bad sample never takes the daemon down.
    """
    interval = max(5, config.observer_interval_seconds)
    while True:
        try:
            await _tick(store, cold)
        except asyncio.CancelledError:
            raise
        except Exception as err:  # pragma: no cover - defensive
            print(f"[FlowState] observer tick failed ({type(err).__name__}: {err})")
        try:
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            raise


def _local_midnight_ts() -> float:
    now = datetime.now()
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight.timestamp()


async def status(store) -> ObserverStatus:
    """Compose the live monitoring status for the dashboard card."""
    try:
        observations = await store.count_since(_local_midnight_ts(), EventType.passive_snapshot)
    except Exception:
        observations = 0
    return ObserverStatus(
        observer_enabled=_rt.enabled,
        recording=recording.is_enabled(),
        cpu_percent=round(resource.current(), 1),
        cpu_deferring=resource.current() >= float(config.cpu_defer_threshold),
        active_app=_rt.active_app,
        idle_seconds=round(_rt.idle, 0),
        screen_locked=_rt.locked,
        interruption_active=_rt.interruption_active,
        interruption_at=_rt.interruption_at,
        interruption_cause=_rt.interruption_cause,
        last_observation_at=_rt.last_observation_at,
        observations_today=observations,
    )
