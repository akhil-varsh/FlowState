"""Recording on/off switch (Phase 9).

A user-facing kill switch for capture. When recording is paused, the daemon
drops incoming snapshots instead of storing them — so nothing is recorded no
matter what the extension sends (automatic triggers included). The state is
persisted to the data dir so a pause survives a restart / next logon.

The desktop widget toggles this; the daemon enforces it.
"""

from __future__ import annotations

import json
from typing import Optional

from .config import config

_state: Optional[bool] = None


def _path():
    return config.data_dir / "recording.json"


def is_enabled() -> bool:
    """True if capture is recording (the default). Cached after first read."""
    global _state
    if _state is None:
        try:
            _state = bool(json.loads(_path().read_text("utf-8")).get("enabled", True))
        except Exception:
            _state = True
    return _state


def set_enabled(enabled: bool) -> bool:
    """Turn recording on/off and persist it. Returns the new state."""
    global _state
    _state = bool(enabled)
    try:
        config.ensure_dirs()
        _path().write_text(json.dumps({"enabled": _state}), encoding="utf-8")
    except Exception as err:  # persistence is best-effort
        print(f"[FlowState] could not persist recording state ({err})")
    return _state
