"""Ephemerality: TTL purge across both stores (Phase 7).

Snapshots are meant to be short-lived. This module deletes anything older than
the configured TTL from the hot SQLite store AND the cold vector index, keeping
them in lockstep (the hot store returns the ids it removed; the cold store drops
exactly those).

It runs as a low-frequency background task (sleep-driven, so it costs nothing at
idle — no busy polling) plus once at startup, and is also exposed as an on-demand
endpoint. This is maintenance, never inference: it never loads the LLM.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from .config import config
from .storage import ColdStore, HotStore


async def purge_once(hot: HotStore, cold: ColdStore, ttl_seconds: Optional[int] = None) -> int:
    """Purge expired snapshots from both stores. Returns how many were removed."""
    ids = await hot.purge_expired(ttl_seconds)
    if ids:
        # Cold deletes are synchronous CPU/disk work — keep them off the loop.
        await asyncio.to_thread(cold.delete_ids, ids)
    return len(ids)


async def run_purge_loop(hot: HotStore, cold: ColdStore) -> None:
    """Background TTL sweeper. Sweeps at startup, then every purge_interval.

    Cancelled on shutdown via the app lifespan. Errors are swallowed so a single
    bad sweep never takes the daemon down.
    """
    interval = max(60, config.purge_interval_seconds)
    while True:
        try:
            removed = await purge_once(hot, cold)
            if removed:
                print(f"[FlowState] TTL purge removed {removed} expired snapshot(s)")
        except asyncio.CancelledError:
            raise
        except Exception as err:  # pragma: no cover - defensive
            print(f"[FlowState] purge sweep failed ({type(err).__name__}: {err})")
        try:
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            raise
