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
from ..models import EventType, HistoryItem, Snapshot, Trigger

_SCHEMA = """
CREATE TABLE IF NOT EXISTS snapshots (
    id             TEXT PRIMARY KEY,
    workspace_name TEXT NOT NULL,
    workspace_root TEXT NOT NULL DEFAULT '',
    trigger        TEXT NOT NULL,
    ts             REAL NOT NULL,          -- unix epoch seconds (UTC)
    created_at     REAL NOT NULL,          -- when the row was written
    headline       TEXT NOT NULL DEFAULT '',
    event_type     TEXT NOT NULL DEFAULT 'snapshot',
    is_interruption_buffer INTEGER NOT NULL DEFAULT 0,
    data           TEXT NOT NULL           -- full Snapshot JSON
);

-- Indexed lookup for the restore path: latest per workspace, newest first.
CREATE INDEX IF NOT EXISTS idx_snapshots_ws_ts
    ON snapshots (workspace_name, ts DESC);

-- Index for TTL purge.
CREATE INDEX IF NOT EXISTS idx_snapshots_created
    ON snapshots (created_at);
"""

# Created AFTER the column migration, since it references the Phase-10 column
# that older databases don't have until _migrate() adds it.
_EVENT_INDEX = (
    "CREATE INDEX IF NOT EXISTS idx_snapshots_event_ts ON snapshots (event_type, ts)"
)

# Restore points are only real editor captures + start/end-of-day deep captures.
# Passive observer samples are never restored from directly.
_RESTORE_EVENTS = ("snapshot", "start_of_day", "end_of_day")


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
            # Add Phase-10 columns to pre-existing databases BEFORE creating the
            # index that references them.
            await self._migrate(db)
            await db.execute(_EVENT_INDEX)
            await db.commit()

    async def _migrate(self, db: aiosqlite.Connection) -> None:
        """Add Phase-10 columns to databases created before they existed.

        Idempotent: checks the live schema and only ALTERs what is missing, so
        upgrading an existing install never loses snapshots.
        """
        async with db.execute("PRAGMA table_info(snapshots)") as cur:
            cols = {r[1] for r in await cur.fetchall()}
        if "event_type" not in cols:
            await db.execute(
                "ALTER TABLE snapshots ADD COLUMN event_type TEXT NOT NULL DEFAULT 'snapshot'"
            )
        if "is_interruption_buffer" not in cols:
            await db.execute(
                "ALTER TABLE snapshots ADD COLUMN is_interruption_buffer INTEGER NOT NULL DEFAULT 0"
            )

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
            snap.event_type.value,
            1 if snap.is_interruption_buffer else 0,
            crypto.encrypt(snap.model_dump_json()),
        )
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                """
                INSERT INTO snapshots
                    (id, workspace_name, workspace_root, trigger, ts, created_at,
                     headline, event_type, is_interruption_buffer, data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    workspace_name=excluded.workspace_name,
                    workspace_root=excluded.workspace_root,
                    trigger=excluded.trigger,
                    ts=excluded.ts,
                    headline=excluded.headline,
                    event_type=excluded.event_type,
                    is_interruption_buffer=excluded.is_interruption_buffer,
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
        """The restore path: single indexed lookup, no vectors.

        Restores only from real editor / deep captures — passive observer samples
        are never a restore target.
        """
        placeholders = ",".join("?" for _ in _RESTORE_EVENTS)
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(
                f"""
                SELECT data FROM snapshots
                WHERE workspace_name = ? AND event_type IN ({placeholders})
                ORDER BY ts DESC
                LIMIT 1
                """,
                (workspace, *_RESTORE_EVENTS),
            ) as cur:
                row = await cur.fetchone()
        if row is None:
            return None
        return _load(row[0])

    async def latest_any(self) -> Optional[Snapshot]:
        placeholders = ",".join("?" for _ in _RESTORE_EVENTS)
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(
                f"""
                SELECT data FROM snapshots
                WHERE event_type IN ({placeholders})
                ORDER BY ts DESC LIMIT 1
                """,
                _RESTORE_EVENTS,
            ) as cur:
                row = await cur.fetchone()
        if row is None:
            return None
        return _load(row[0])

    async def latest_by_event(
        self, event_type: EventType, workspace: Optional[str] = None
    ) -> Optional[Snapshot]:
        """Most recent snapshot of a specific event type (e.g. start_of_day)."""
        query = "SELECT data FROM snapshots WHERE event_type = ?"
        params: tuple = (event_type.value,)
        if workspace:
            query += " AND workspace_name = ?"
            params += (workspace,)
        query += " ORDER BY ts DESC LIMIT 1"
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(query, params) as cur:
                row = await cur.fetchone()
        return _load(row[0]) if row else None

    async def snapshots_between(
        self,
        start_ts: float,
        end_ts: float,
        workspace: Optional[str] = None,
        event_types: Optional[tuple[str, ...]] = None,
    ) -> List[Snapshot]:
        """All snapshots in [start_ts, end_ts], chronological (oldest first).

        Powers the cross-application restoration timeline and the end-of-day
        report aggregation.
        """
        query = "SELECT data FROM snapshots WHERE ts >= ? AND ts <= ?"
        params: list = [start_ts, end_ts]
        if workspace:
            query += " AND workspace_name = ?"
            params.append(workspace)
        if event_types:
            query += " AND event_type IN (%s)" % ",".join("?" for _ in event_types)
            params.extend(event_types)
        query += " ORDER BY ts ASC"
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(query, tuple(params)) as cur:
                rows = await cur.fetchall()
        return [_load(r[0]) for r in rows]

    async def buffered_snapshots(self, workspace: Optional[str] = None) -> List[Snapshot]:
        """Snapshots currently flagged as pre-interruption buffer, chronological."""
        query = "SELECT data FROM snapshots WHERE is_interruption_buffer = 1"
        params: tuple = ()
        if workspace:
            query += " AND workspace_name = ?"
            params = (workspace,)
        query += " ORDER BY ts ASC"
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(query, params) as cur:
                rows = await cur.fetchall()
        return [_load(r[0]) for r in rows]

    async def flag_interruption_buffer(self, start_ts: float, end_ts: float) -> int:
        """Mark snapshots in the pre-interruption window as the interruption buffer.

        Returns how many rows were flagged. Clears prior flags first so the buffer
        always reflects the most recent interruption (the restoration engine reads
        the freshest one).
        """
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "UPDATE snapshots SET is_interruption_buffer = 0 WHERE is_interruption_buffer = 1"
            )
            cur = await db.execute(
                "UPDATE snapshots SET is_interruption_buffer = 1 WHERE ts >= ? AND ts <= ?",
                (start_ts, end_ts),
            )
            await db.commit()
            return cur.rowcount if cur.rowcount is not None else 0

    async def get(self, snapshot_id: str) -> Optional[Snapshot]:
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(
                "SELECT data FROM snapshots WHERE id = ?", (snapshot_id,)
            ) as cur:
                row = await cur.fetchone()
        if row is None:
            return None
        return _load(row[0])

    async def history(
        self,
        workspace: Optional[str] = None,
        limit: int = 50,
        include_passive: bool = False,
    ) -> List[HistoryItem]:
        query = "SELECT id, ts, trigger, workspace_name, headline FROM snapshots"
        clauses: list[str] = []
        params: tuple = ()
        if not include_passive:
            # Keep the dev-facing timeline to real restore points, not the
            # continuous observer stream.
            clauses.append("event_type != 'passive_snapshot'")
        if workspace:
            clauses.append("workspace_name = ?")
            params = params + (workspace,)
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
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

    async def count_since(
        self, since_ts: float, event_type: Optional[EventType] = None
    ) -> int:
        """How many snapshots were captured since ``since_ts`` (e.g. midnight)."""
        query = "SELECT COUNT(*) FROM snapshots WHERE ts >= ?"
        params: tuple = (since_ts,)
        if event_type is not None:
            query += " AND event_type = ?"
            params += (event_type.value,)
        async with aiosqlite.connect(self._db_path) as db:
            async with db.execute(query, params) as cur:
                row = await cur.fetchone()
        return int(row[0]) if row else 0
