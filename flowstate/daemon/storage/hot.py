"""Hot store: SQLite persistence for snapshots.

This is the *ephemeral, structured* store that powers the fast restore path.
The restore path is a single indexed lookup here — NO vector search, ever.

Snapshots are stored as one row each. The full snapshot JSON lives in a blob
column; the columns we query on (workspace name, timestamp) are indexed so
"latest snapshot for workspace X" is an O(log n) lookup.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import List, Optional

import aiosqlite

from ..config import config
from .. import crypto
from ..models import HistoryItem, Snapshot, Trigger

_SCHEMA = """
CREATE TABLE IF NOT EXISTS snapshots (
    id             TEXT PRIMARY KEY,
    workspace_name TEXT NOT NULL,
    workspace_root TEXT NOT NULL DEFAULT '',
    trigger        TEXT NOT NULL,
    ts             REAL NOT NULL,          -- unix epoch seconds (UTC)
    created_at     REAL NOT NULL,          -- when the row was written
    headline       TEXT NOT NULL DEFAULT '',
    data           TEXT NOT NULL           -- full Snapshot JSON
);

-- Indexed lookup for the restore path: latest per workspace, newest first.
CREATE INDEX IF NOT EXISTS idx_snapshots_ws_ts
    ON snapshots (workspace_name, ts DESC);

-- Index for TTL purge.
CREATE INDEX IF NOT EXISTS idx_snapshots_created
    ON snapshots (created_at);
"""


def _to_epoch(dt: datetime) -> float:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _load(blob: str) -> Snapshot:
    """Decrypt (if needed) and validate a stored snapshot blob."""
    return Snapshot.model_validate_json(crypto.decrypt(blob))


class HotStore:
    """Async SQLite wrapper. One instance owned by the app lifespan."""

    def __init__(self, db_path: Optional[str] = None) -> None:
        config.ensure_dirs()
        self._db_path = db_path or str(config.db_path)

    async def init(self) -> None:
        async with aiosqlite.connect(self._db_path) as db:
            await db.executescript(_SCHEMA)
            await db.commit()

    async def store(self, snap: Snapshot, headline: str = "") -> None:
        # The full snapshot blob is the sensitive part; encrypt it if a key is
        # configured (no-op otherwise). Index columns stay plaintext for lookups.
        row = (
            snap.id,
            snap.workspace.name,
            snap.workspace.root,
            snap.trigger.value,
            _to_epoch(snap.timestamp),
            time.time(),
            headline,
            crypto.encrypt(snap.model_dump_json()),
        )
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                """
                INSERT INTO snapshots
                    (id, workspace_name, workspace_root, trigger, ts, created_at, headline, data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    workspace_name=excluded.workspace_name,
                    workspace_root=excluded.workspace_root,
                    trigger=excluded.trigger,
                    ts=excluded.ts,
                    headline=excluded.headline,
                    data=excluded.data
                """,
                row,
            )
            await db.commit()

    async def set_headline(self, snapshot_id: str, headline: str) -> None:
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "UPDATE snapshots SET headline=? WHERE id=?",
                (headline, snapshot_id),
            )
            await db.commit()

    async def latest_for_workspace(self, workspace: str) -> Optional[Snapshot]:
        """The restore path: single indexed lookup, no vectors."""
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(
                """
                SELECT data FROM snapshots
                WHERE workspace_name = ?
                ORDER BY ts DESC
                LIMIT 1
                """,
                (workspace,),
            ) as cur:
                row = await cur.fetchone()
        if row is None:
            return None
        return _load(row[0])

    async def latest_any(self) -> Optional[Snapshot]:
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(
                "SELECT data FROM snapshots ORDER BY ts DESC LIMIT 1"
            ) as cur:
                row = await cur.fetchone()
        if row is None:
            return None
        return _load(row[0])

    async def get(self, snapshot_id: str) -> Optional[Snapshot]:
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(
                "SELECT data FROM snapshots WHERE id = ?", (snapshot_id,)
            ) as cur:
                row = await cur.fetchone()
        if row is None:
            return None
        return _load(row[0])

    async def history(self, workspace: Optional[str] = None, limit: int = 50) -> List[HistoryItem]:
        query = (
            "SELECT id, ts, trigger, workspace_name, headline FROM snapshots"
        )
        params: tuple = ()
        if workspace:
            query += " WHERE workspace_name = ?"
            params = (workspace,)
        query += " ORDER BY ts DESC LIMIT ?"
        params = params + (limit,)

        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(query, params) as cur:
                rows = await cur.fetchall()

        items: List[HistoryItem] = []
        for r in rows:
            items.append(
                HistoryItem(
                    id=r[0],
                    timestamp=datetime.fromtimestamp(r[1], tz=timezone.utc),
                    trigger=Trigger(r[2]),
                    workspace_name=r[3],
                    headline=r[4] or "",
                )
            )
        return items

    async def purge_expired(self, ttl_seconds: Optional[int] = None) -> List[str]:
        """Delete snapshots older than the TTL. Returns the ids removed.

        Returning the ids (not just a count) lets the caller drop the very same
        snapshots from the cold vector index, keeping the two stores in lockstep.
        """
        ttl = ttl_seconds if ttl_seconds is not None else config.ttl_seconds
        cutoff = time.time() - ttl
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(
                "SELECT id FROM snapshots WHERE created_at < ?", (cutoff,)
            ) as cur:
                ids = [r[0] for r in await cur.fetchall()]
            if ids:
                await db.execute(
                    "DELETE FROM snapshots WHERE created_at < ?", (cutoff,)
                )
                await db.commit()
        return ids

    async def count(self) -> int:
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute("SELECT COUNT(*) FROM snapshots") as cur:
                row = await cur.fetchone()
        return int(row[0]) if row else 0
