"""Regression tests for the Phase-10 subsystems (Zero-Trust Cognitive Restoration).

Covers the sanitizer, the CPU governor, the storage migration + event model +
interruption buffer, the cross-application restoration and daily-report fallbacks,
the deep profiler, and the observer status — all without a running Ollama (the
inference host is pointed at a dead port so the deterministic fallbacks run).

Runs two ways:
    pytest daemon/tests/test_phase10.py
    python -m daemon.tests.test_phase10          # no pytest needed

Everything is isolated to a temp data dir; nothing touches a real install.
"""

from __future__ import annotations

import asyncio
import os
import tempfile
import time

# Isolate + force deterministic offline behavior BEFORE importing the daemon.
os.environ.setdefault("FLOWSTATE_DATA_DIR", tempfile.mkdtemp(prefix="fs_test_"))
os.environ.setdefault("FLOWSTATE_OLLAMA_HOST", "http://127.0.0.1:1")  # refused -> fallback
os.environ.setdefault("FLOWSTATE_CLOUD_REPORT_ENABLED", "false")

from daemon import inference, observer, profiler, resource, sanitize  # noqa: E402
from daemon.models import (  # noqa: E402
    AmbientState,
    Cursor,
    EditorState,
    EventType,
    GitState,
    Snapshot,
    Trigger,
    Workspace,
)
from daemon.storage import HotStore  # noqa: E402


def _fresh_store() -> HotStore:
    path = os.path.join(tempfile.mkdtemp(prefix="fs_db_"), "t.db")
    return HotStore(db_path=path)


# --------------------------------------------------------------------------
# Sanitizer
# --------------------------------------------------------------------------
def test_sanitize_masks_secrets():
    raw = (
        "contact me@x.com, password=hunter2, key sk-ABCDEFGHIJ1234567890, "
        "bearer eyJhbGci.payloadpart.sig, card 4111 1111 1111 1111"
    )
    out = sanitize.sanitize_text(raw)
    for leak in ("me@x.com", "hunter2", "sk-ABCDEFGHIJ1234567890", "4111 1111 1111 1111"):
        assert leak not in out, f"leaked: {leak}"
    assert "REDACTED" in out
    # Idempotent.
    assert sanitize.sanitize_text(out) == out


def test_sanitize_snapshot_scrubs_fields():
    snap = Snapshot(
        editor=EditorState(selection="password=secretval"),
        ambient=AmbientState(clipboard_recent=["token=abc123 me@x.com"]),
    )
    snap = sanitize.sanitize_snapshot(snap)
    assert "secretval" not in snap.editor.selection
    assert "me@x.com" not in snap.ambient.clipboard_recent[0]


# --------------------------------------------------------------------------
# Resource governor
# --------------------------------------------------------------------------
def test_resource_governor():
    resource.measure(interval=0.05)
    assert isinstance(resource.current(), float)
    assert isinstance(resource.should_defer(), bool)
    payload = resource.deferred_payload()
    assert payload["status"] == "deferred" and "CPU" in payload["message"]


# --------------------------------------------------------------------------
# Storage: migration, event model, interruption buffer
# --------------------------------------------------------------------------
def test_storage_events_and_buffer():
    async def run():
        store = _fresh_store()
        await store.init()

        editor = Snapshot(
            trigger=Trigger.manual,
            event_type=EventType.snapshot,
            workspace=Workspace(name="proj", root=os.getcwd()),
            editor=EditorState(active_file="daemon/config.py", cursor=Cursor(line=5)),
        )
        await store.store(editor, headline="edit")

        now = time.time()
        for app in ("Code.exe — a", "EXCEL.EXE — b", "WINWORD.EXE — c"):
            await store.store(
                Snapshot(
                    trigger=Trigger.passive,
                    event_type=EventType.passive_snapshot,
                    workspace=Workspace(name="(ambient)"),
                    ambient=AmbientState(active_app=app, foreground_seconds=30),
                ),
                headline=app,
            )

        # Restore path ignores passive samples.
        latest = await store.latest_for_workspace("proj")
        assert latest is not None and latest.event_type == EventType.snapshot
        assert await store.latest_for_workspace("(ambient)") is None

        # Windowed read includes both editor + passive.
        win = await store.snapshots_between(
            now - 600, now + 5, event_types=("passive_snapshot", "snapshot")
        )
        assert len(win) >= 4

        # Interruption buffer flag round-trips.
        flagged = await store.flag_interruption_buffer(now - 600, now + 5)
        assert flagged >= 4
        buffered = await store.buffered_snapshots()
        assert len(buffered) >= 4

        # History hides passive by default, shows it on request.
        hist = await store.history()
        assert all(h.workspace_name != "(ambient)" for h in hist)
        assert len(await store.history(include_passive=True)) > len(hist)

        # count_since.
        assert await store.count_since(now - 600, EventType.passive_snapshot) >= 3

    asyncio.run(run())


# --------------------------------------------------------------------------
# Cross-application restoration (fallback) + daily report (fallback)
# --------------------------------------------------------------------------
def _activity():
    return [
        Snapshot(
            trigger=Trigger.passive,
            event_type=EventType.passive_snapshot,
            workspace=Workspace(name="(ambient)"),
            ambient=AmbientState(active_app=app, clipboard_recent=[clip] if clip else [], foreground_seconds=40),
        )
        for app, clip in [
            ("Code.exe — db_connector.py", "pool_size=10"),
            ("EXCEL.EXE — Config.xlsx", ""),
            ("WINWORD.EXE — Notes.docx", ""),
        ]
    ]


def test_restore_context_fallback():
    r = inference.restore_context(_activity())
    assert r.headline and r.narrative and r.tools_used
    # Empty input degrades cleanly, never raises.
    empty = inference.restore_context([])
    assert empty.headline


def test_daily_report_fallback_and_markdown():
    start = Snapshot(
        event_type=EventType.start_of_day,
        workspace=Workspace(name="proj", git=GitState(branch="main")),
    )
    end = Snapshot(
        event_type=EventType.end_of_day,
        workspace=Workspace(name="proj", git=GitState(branch="main", dirty_files=["x.py"])),
        editor=EditorState(active_file="x.py"),
    )
    rpt = inference.daily_report(start, _activity(), end)
    assert rpt.primary_objectives is not None
    md = inference.report_to_markdown(rpt, date="2026-09-11", workspace="proj")
    assert "End-of-Day Progress Report" in md
    assert "Primary Objectives" in md and "Blockers" in md


# --------------------------------------------------------------------------
# Deep profiler + observer status
# --------------------------------------------------------------------------
def test_profiler_and_observer_status():
    async def run():
        store = _fresh_store()
        await store.init()
        await store.store(
            Snapshot(
                event_type=EventType.snapshot,
                workspace=Workspace(name="proj", root=os.getcwd()),
                editor=EditorState(active_file="daemon/config.py", cursor=Cursor(line=1)),
            )
        )
        sod = await profiler.capture_deep(store, EventType.start_of_day, "proj", os.getcwd())
        assert sod is not None
        assert sod.event_type == EventType.start_of_day
        assert sod.editor.active_file_excerpt  # read a real file from disk
        assert sod.editor.file_role

        st = await observer.status(store)
        assert isinstance(st.observations_today, int)
        assert isinstance(st.cpu_percent, float)

    asyncio.run(run())


# --------------------------------------------------------------------------
# Standalone runner (no pytest required)
# --------------------------------------------------------------------------
def _main() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
        except Exception as err:  # noqa: BLE001
            failed += 1
            print(f"  FAIL  {t.__name__}: {type(err).__name__}: {err}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_main())
