"""FlowState daemon — FastAPI app.

Phase 1 scope: localhost binding, config, Pydantic models, SQLite schema, and
stub /snapshot + /restore (echo, no AI yet). Later phases wire in inference,
rehydration, triggers, ambient capture, and semantic search.

Run:  python -m daemon.main
or:   uvicorn daemon.main:app --host 127.0.0.1 --port 8420
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .capture import assemble
from .config import config
from . import (
    crypto,
    inference,
    maintenance,
    observer,
    pdf,
    profiler,
    recording,
    report,
    resource,
    sanitize,
)
from .models import (
    DailyReport,
    DailyReportResponse,
    DeepCaptureResponse,
    EventType,
    HistoryItem,
    ObserverStatus,
    RecordingState,
    RehydrateAck,
    RehydrateRequest,
    RestoreContextResponse,
    RestoreResponse,
    SearchHit,
    Snapshot,
    SnapshotAck,
)
from .realtime import manager
from .storage import ColdStore, HotStore
from .triggers import TriggerPolicy, get_policy


# A single hot store (SQLite, restore path) and cold store (vectors, search).
store = HotStore()
search_index = ColdStore()


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    config.ensure_dirs()
    await store.init()
    # Background TTL sweeper: enforces ephemerality across hot + cold stores.
    # Sleep-driven, so it adds no idle CPU cost.
    purge_task = asyncio.create_task(maintenance.run_purge_loop(store, search_index))
    # Continuous observer (Phase 10): OS-wide cross-application sampling +
    # interruption detection. Also sleep-driven; respects the recording switch
    # and the CPU governor.
    observer_task = asyncio.create_task(observer.run_loop(store, search_index))
    try:
        yield
    finally:
        for task in (purge_task, observer_task):
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


app = FastAPI(
    title="FlowState daemon",
    version="0.1.0",
    description="Local, offline context-restoration orchestrator. 127.0.0.1 only.",
    lifespan=lifespan,
)

# The dashboard is served from a local Next.js server. Allow only localhost
# origins — this daemon never talks to the public internet.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------
@app.get("/config", response_model=TriggerPolicy)
async def get_config() -> TriggerPolicy:
    """Trigger policy for the extension to enforce (single source of truth)."""
    return get_policy()


@app.get("/recording", response_model=RecordingState)
async def get_recording() -> RecordingState:
    """Whether capture is currently recording (vs. paused by the user)."""
    return RecordingState(enabled=recording.is_enabled())


@app.post("/recording", response_model=RecordingState)
async def set_recording(
    enabled: bool = Query(..., description="true to record, false to pause"),
) -> RecordingState:
    """Turn snapshot recording on or off (the desktop widget's toggle)."""
    new = recording.set_enabled(enabled)
    await manager.to_dashboard({"type": "recording", "enabled": new})
    return RecordingState(enabled=new)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "version": app.version,
        "model": config.model,
        "snapshots": await store.count(),
        "offline": True,
        "recording": recording.is_enabled(),
        "ttl_seconds": config.ttl_seconds,
        "inference": inference.health(),
        "search": search_index.health(),
        "security": crypto.status(),
        "sanitize": sanitize.status(),
        "resource": resource.status(),
        "observer": {"enabled": observer.is_enabled(), "interval": config.observer_interval_seconds},
        "cloud_report": report.status(),
    }


# --------------------------------------------------------------------------
# POST /snapshot — store a snapshot
# --------------------------------------------------------------------------
@app.post("/snapshot", response_model=SnapshotAck)
async def post_snapshot(snapshot: Snapshot) -> SnapshotAck:
    """Receive an editor-tier snapshot, enrich it, and store it.

    The assembler fills in Tier 2 (git) from the workspace root and, from
    Phase 5, Tier 3 (ambient). Phase 3 adds an async one-line summary and
    Phase 6 a ChromaDB embed for history search.
    """
    # Recording kill switch: when paused, drop the snapshot (nothing is stored,
    # indexed, or pushed) and tell the caller it was paused, not failed.
    if not recording.is_enabled():
        return SnapshotAck(id=snapshot.id, stored=False, paused=True)

    merged = assemble(snapshot)
    # Mask PII / secrets before anything is stored or embedded (Phase 10).
    merged = sanitize.sanitize_snapshot(merged)
    await store.store(merged)

    # Index a compact digest for semantic history search (Phase 6). This uses a
    # small ONNX embedder, NOT the LLM — cheap, and off the event loop. The
    # restore path never reads this index. Failure here must not fail capture.
    digest = inference.digest_text(merged)
    await asyncio.to_thread(
        search_index.add,
        merged.id,
        merged.workspace.name,
        merged.timestamp.timestamp(),
        digest,
    )

    # Live push to the dashboard so the timeline updates without polling.
    # NOTE: no inference here — summaries are on-demand (GET /restore) only.
    await manager.to_dashboard(
        {
            "type": "snapshot_captured",
            "item": {
                "id": merged.id,
                "timestamp": merged.timestamp.isoformat(),
                "trigger": merged.trigger.value,
                "workspace_name": merged.workspace.name,
                "active_file": merged.editor.active_file,
            },
        }
    )
    return SnapshotAck(id=merged.id, stored=True)


# --------------------------------------------------------------------------
# GET /restore — load latest snapshot (indexed SQL lookup, NO vectors)
# --------------------------------------------------------------------------
@app.get("/restore", response_model=RestoreResponse)
async def get_restore(
    workspace: Optional[str] = Query(default=None, description="Workspace name"),
) -> RestoreResponse:
    """Return the most recent snapshot for a workspace, with an AI briefing.

    The snapshot load is a single indexed SQL lookup — NO vector search. The
    Summary is generated on-demand by the local model (off the event loop).
    """
    if workspace:
        snap = await store.latest_for_workspace(workspace)
    else:
        snap = await store.latest_any()

    if snap is None:
        raise HTTPException(status_code=404, detail="No snapshot found")

    # Ollama client is synchronous; run it in a thread so the loop stays free.
    summary = await asyncio.to_thread(inference.summarize, snap)

    # Upsert the richer, model-written digest into the search index so history
    # search reflects the briefing the user actually saw. Still no vectors on
    # the restore path itself — this only *writes* the index, never reads it.
    await asyncio.to_thread(
        search_index.add,
        snap.id,
        snap.workspace.name,
        snap.timestamp.timestamp(),
        inference.summary_digest(summary),
    )

    # Push the fresh briefing to any connected dashboards.
    await manager.to_dashboard(
        {
            "type": "summary",
            "workspace": snap.workspace.name,
            "summary": summary.model_dump(),
        }
    )
    return RestoreResponse(snapshot=snap, summary=summary)


# --------------------------------------------------------------------------
# GET /history — recent snapshots for the timeline
# --------------------------------------------------------------------------
@app.get("/history", response_model=list[HistoryItem])
async def get_history(
    workspace: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    include_passive: bool = Query(
        default=False, description="Include continuous observer samples"
    ),
) -> list[HistoryItem]:
    return await store.history(
        workspace=workspace, limit=limit, include_passive=include_passive
    )


# --------------------------------------------------------------------------
# GET /search — semantic history search (the ONLY vector path)
# --------------------------------------------------------------------------
@app.get("/search", response_model=list[SearchHit])
async def get_search(
    q: str = Query(..., min_length=1, description="Natural-language query"),
    k: int = Query(default=8, ge=1, le=50),
    workspace: Optional[str] = Query(default=None),
) -> list[SearchHit]:
    """Find past sessions by meaning ("when did I last touch auth?").

    This is deliberately isolated from restore: it reads the ChromaDB vector
    index, never the SQLite restore path. Embedding runs on the CPU off the
    event loop. If the index is unavailable, returns an empty list.
    """
    return await asyncio.to_thread(search_index.search, q, k, workspace)


# ==========================================================================
# Phase 10 — deep profiling, cross-app restoration, daily report, observer
# ==========================================================================
def _today() -> str:
    from datetime import date

    return date.today().isoformat()


@app.post("/start-day", response_model=DeepCaptureResponse)
async def post_start_day(
    workspace: Optional[str] = Query(default=None, description="Workspace name"),
    workspace_root: Optional[str] = Query(default=None, description="Workspace path"),
) -> DeepCaptureResponse:
    """Deep Start-of-Day capture: git status, open files, active-file excerpt."""
    snap = await profiler.capture_deep(
        store, EventType.start_of_day, workspace, workspace_root
    )
    if snap is None:
        return DeepCaptureResponse(
            status="empty",
            event_type=EventType.start_of_day,
            message="No workspace to profile yet — capture an editor snapshot first.",
        )
    await manager.to_dashboard(
        {"type": "day_marker", "event": "start_of_day", "workspace": snap.workspace.name}
    )
    return DeepCaptureResponse(event_type=EventType.start_of_day, snapshot=snap)


async def _build_daily_report(
    workspace: Optional[str], captured_end: Optional[Snapshot]
) -> DailyReportResponse:
    """Aggregate the day and synthesize the manager report (CPU-gated)."""
    start = await store.latest_by_event(EventType.start_of_day, workspace)
    end = captured_end or await store.latest_by_event(EventType.end_of_day, workspace)

    # Aggregate activity across ALL apps (passive samples live under (ambient)),
    # bounded to the working day between start and end.
    from datetime import datetime, timezone

    start_ts = start.timestamp.timestamp() if start else (
        datetime.now(timezone.utc).timestamp() - 24 * 3600
    )
    end_ts = end.timestamp.timestamp() if end else datetime.now(timezone.utc).timestamp()
    activity = await store.snapshots_between(
        start_ts, end_ts, event_types=("passive_snapshot", "snapshot")
    )

    ws_name = workspace or (end.workspace.name if end else "") or (start.workspace.name if start else "")

    # Governor: never fight the IDE. Defer synthesis if the host is busy.
    if await asyncio.to_thread(resource.should_defer):
        payload = resource.deferred_payload()
        return DailyReportResponse(
            status="deferred",
            message=payload["message"],
            date=_today(),
            workspace=ws_name,
            snapshots_analyzed=len(activity),
            cpu_percent=payload["cpu_percent"],
        )

    rpt = await asyncio.to_thread(inference.daily_report, start, activity, end)
    markdown = inference.report_to_markdown(rpt, date=_today(), workspace=ws_name)

    # Privacy-first cloud push: summary string ONLY (opt-in; no-op if disabled).
    cloud = await asyncio.to_thread(report.push_report, rpt, markdown, _today(), ws_name)

    await manager.to_dashboard(
        {"type": "daily_report", "workspace": ws_name, "markdown": markdown}
    )
    return DailyReportResponse(
        status="ok",
        date=_today(),
        workspace=ws_name,
        snapshots_analyzed=len(activity),
        report=rpt,
        report_markdown=markdown,
        cloud=cloud,
        cpu_percent=round(resource.current(), 1),
    )


@app.post("/end-day", response_model=DailyReportResponse)
async def post_end_day(
    workspace: Optional[str] = Query(default=None),
    workspace_root: Optional[str] = Query(default=None),
) -> DailyReportResponse:
    """Deep End-of-Day capture, then generate + sync the manager report."""
    end = await profiler.capture_deep(
        store, EventType.end_of_day, workspace, workspace_root
    )
    await manager.to_dashboard(
        {"type": "day_marker", "event": "end_of_day", "workspace": end.workspace.name if end else ""}
    )
    return await _build_daily_report(workspace, end)


@app.get("/report/daily", response_model=DailyReportResponse)
async def get_daily_report(
    workspace: Optional[str] = Query(default=None),
) -> DailyReportResponse:
    """Regenerate the end-of-day report from existing captures (no new capture)."""
    return await _build_daily_report(workspace, None)


@app.post("/report/pdf")
async def post_report_pdf(
    report_body: DailyReport,
    date: str = Query(default=""),
    workspace: str = Query(default=""),
) -> Response:
    """Render an already-generated daily report to a downloadable PDF (instant)."""
    the_date = date or _today()
    data = await asyncio.to_thread(
        pdf.render_daily_pdf, report_body, the_date, workspace, config.report_user
    )
    filename = f"flowstate-report-{the_date}.pdf"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _this_month() -> str:
    from datetime import date as _date

    return _date.today().strftime("%Y-%m")


@app.get("/report/monthly")
async def get_monthly(month: Optional[str] = Query(default=None)) -> dict:
    """Aggregate the month's stored daily reports (from the durable cloud store)."""
    return await asyncio.to_thread(report.fetch_monthly, month or _this_month())


@app.get("/report/monthly.pdf")
async def get_monthly_pdf(month: Optional[str] = Query(default=None)) -> Response:
    """The monthly report as a downloadable PDF."""
    m = month or _this_month()
    data = await asyncio.to_thread(report.fetch_monthly, m)
    if not data.get("available"):
        raise HTTPException(
            status_code=400,
            detail=data.get("reason") or data.get("error") or "monthly report unavailable",
        )
    data["month"] = m
    pdf_bytes = await asyncio.to_thread(pdf.render_monthly_pdf, data)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="flowstate-monthly-{m}.pdf"'},
    )


@app.post("/restore-context", response_model=RestoreContextResponse)
async def post_restore_context(
    workspace: Optional[str] = Query(default=None),
) -> RestoreContextResponse:
    """Reconstruct what you were doing across apps before the last interruption.

    Reads the flagged pre-interruption buffer (falling back to the recent lookback
    window), then synthesizes a unified cross-application narrative with the local
    model. CPU-gated: defers if the host is busy.
    """
    snaps = await store.buffered_snapshots()
    if not snaps:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc).timestamp()
        snaps = await store.snapshots_between(
            now - config.interruption_buffer_seconds,
            now,
            event_types=("passive_snapshot", "snapshot"),
        )

    interruption_at, _cause = observer.last_interruption()

    if not snaps:
        return RestoreContextResponse(
            status="empty",
            message="No recent cross-application activity to restore.",
            interruption_at=interruption_at,
            cpu_percent=round(resource.current(), 1),
        )

    if await asyncio.to_thread(resource.should_defer):
        payload = resource.deferred_payload()
        return RestoreContextResponse(
            status="deferred",
            message=payload["message"],
            interruption_at=interruption_at,
            events=inference.to_activity_events(snaps),
            cpu_percent=payload["cpu_percent"],
        )

    restoration = await asyncio.to_thread(inference.restore_context, snaps)
    await manager.to_dashboard(
        {
            "type": "context_restored",
            "restoration": restoration.model_dump(),
        }
    )
    return RestoreContextResponse(
        status="ok",
        interruption_at=interruption_at,
        restoration=restoration,
        events=inference.to_activity_events(snaps),
        cpu_percent=round(resource.current(), 1),
    )


@app.get("/observer/status", response_model=ObserverStatus)
async def get_observer_status() -> ObserverStatus:
    """Live monitoring status for the dashboard card (CPU, active window, idle)."""
    return await observer.status(store)


@app.post("/observer", response_model=ObserverStatus)
async def set_observer(
    enabled: bool = Query(..., description="true to run the observer, false to pause"),
) -> ObserverStatus:
    """Enable or pause the continuous observer at runtime."""
    observer.set_enabled(enabled)
    await manager.to_dashboard({"type": "observer", "enabled": enabled})
    return await observer.status(store)


# --------------------------------------------------------------------------
# POST /maintenance/purge — run the TTL sweep now (also runs in the background)
# --------------------------------------------------------------------------
@app.post("/maintenance/purge")
async def post_purge(
    ttl_seconds: Optional[int] = Query(
        default=None, ge=0, description="Override TTL for this sweep only"
    ),
) -> dict:
    """Delete expired snapshots from both stores immediately. Returns the count."""
    removed = await maintenance.purge_once(store, search_index, ttl_seconds)
    return {"removed": removed, "remaining": await store.count()}


# --------------------------------------------------------------------------
# POST /rehydrate — instruct the VS Code extension to reopen files
# --------------------------------------------------------------------------
@app.post("/rehydrate", response_model=RehydrateAck)
async def post_rehydrate(req: RehydrateRequest) -> RehydrateAck:
    """Fan the target list out to connected extension clients.

    Targets are workspace-relative "file" or "file:line". The extension opens
    each and places the cursor. Returns whether any extension received it.
    """
    sent = await manager.to_extension(
        {"type": "rehydrate", "targets": req.targets, "workspace": req.workspace}
    )
    return RehydrateAck(
        dispatched=sent > 0,
        extension_connected=manager.extension_connected,
        targets=req.targets,
    )


# --------------------------------------------------------------------------
# WebSockets — dashboard live push and extension command channel
# --------------------------------------------------------------------------
@app.websocket("/ws")
async def ws_dashboard(ws: WebSocket) -> None:
    await manager.connect_dashboard(ws)
    try:
        await ws.send_json({"type": "hello", "role": "dashboard"})
        while True:
            # We don't expect inbound messages; this keeps the socket open.
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.drop_dashboard(ws)
    except Exception:
        manager.drop_dashboard(ws)


@app.websocket("/ext/ws")
async def ws_extension(ws: WebSocket) -> None:
    await manager.connect_extension(ws)
    try:
        await ws.send_json({"type": "hello", "role": "extension"})
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.drop_extension(ws)
    except Exception:
        manager.drop_extension(ws)


def run() -> None:
    import uvicorn

    uvicorn.run(
        app,
        host=config.host,   # 127.0.0.1 — never 0.0.0.0
        port=config.port,
        log_level="info",
    )


if __name__ == "__main__":
    run()
