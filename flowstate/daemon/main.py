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

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .capture import assemble
from .config import config
from . import crypto, inference, maintenance, recording
from .models import (
    HistoryItem,
    RecordingState,
    RehydrateAck,
    RehydrateRequest,
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
    try:
        yield
    finally:
        purge_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await purge_task


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
) -> list[HistoryItem]:
    return await store.history(workspace=workspace, limit=limit)


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
