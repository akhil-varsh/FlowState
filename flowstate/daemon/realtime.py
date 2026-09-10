"""Realtime channels — two WebSocket audiences, both localhost.

- Dashboard clients (``/ws``): receive live push when a snapshot is captured,
  so the timeline and "new context" prompt update without polling.
- Extension clients (``/ext/ws``): receive rehydrate commands. When the user
  clicks "Rehydrate" in the dashboard, the daemon pushes the target files to
  the VS Code extension, which reopens them at the right cursor lines.

Both are simple fan-out registries. No message is ever sent off the machine.
"""

from __future__ import annotations

from typing import Any, Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.dashboard: Set[WebSocket] = set()
        self.extension: Set[WebSocket] = set()

    # ---- connect / disconnect --------------------------------------------
    async def connect_dashboard(self, ws: WebSocket) -> None:
        await ws.accept()
        self.dashboard.add(ws)

    async def connect_extension(self, ws: WebSocket) -> None:
        await ws.accept()
        self.extension.add(ws)

    def drop_dashboard(self, ws: WebSocket) -> None:
        self.dashboard.discard(ws)

    def drop_extension(self, ws: WebSocket) -> None:
        self.extension.discard(ws)

    # ---- send ------------------------------------------------------------
    async def to_dashboard(self, message: Dict[str, Any]) -> int:
        return await self._fanout(self.dashboard, message)

    async def to_extension(self, message: Dict[str, Any]) -> int:
        return await self._fanout(self.extension, message)

    async def _fanout(self, targets: Set[WebSocket], message: Dict[str, Any]) -> int:
        sent = 0
        dead = []
        for ws in list(targets):
            try:
                await ws.send_json(message)
                sent += 1
            except Exception:
                dead.append(ws)
        for ws in dead:
            targets.discard(ws)
        return sent

    @property
    def extension_connected(self) -> bool:
        return len(self.extension) > 0


manager = ConnectionManager()
