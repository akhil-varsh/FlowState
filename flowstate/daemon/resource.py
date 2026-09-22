"""Resource governor (Phase 10) — keep FlowState out of the IDE's way.

Two jobs:

1. **Gate SLM synthesis.** Before any local model call (context restoration or
   the daily report), if host CPU is above ``cpu_defer_threshold`` we defer and
   return a "context preserved; generation deferred" response instead of piling
   load onto a machine that is already compiling or debugging.

2. **Report live load.** The dashboard status card shows current CPU. We keep a
   cheap cached sample (refreshed by the observer loop) so reads are instant.

Graceful degradation: if ``psutil`` is not installed, the governor reports 0%
load and never defers — the daemon still runs, just without the safeguard.
``/health`` surfaces whether the governor is active.
"""

from __future__ import annotations

from typing import Optional

from .config import config

try:  # pragma: no cover - import guard
    import psutil

    _HAS_PSUTIL = True
except Exception:  # pragma: no cover
    psutil = None  # type: ignore
    _HAS_PSUTIL = False


# Last known CPU percentage (0-100). Refreshed by refresh()/measure(); read by
# the status card without blocking. Primed on import so the first read is real.
_last_cpu: float = 0.0
_primed = False


def _prime() -> None:
    """First psutil.cpu_percent(interval=None) call just starts the clock."""
    global _primed
    if _HAS_PSUTIL and not _primed:
        try:
            psutil.cpu_percent(interval=None)
            _primed = True
        except Exception:
            pass


def measure(interval: Optional[float] = None) -> float:
    """Sample CPU now and cache it. ``interval`` blocks that long for accuracy;
    ``None`` returns the load since the previous call (non-blocking)."""
    global _last_cpu
    if not _HAS_PSUTIL:
        return 0.0
    try:
        _prime()
        _last_cpu = float(psutil.cpu_percent(interval=interval))
    except Exception:
        pass
    return _last_cpu


def current() -> float:
    """The last cached CPU percentage — instant, non-blocking."""
    return _last_cpu


def should_defer(sample: bool = True) -> bool:
    """True if synthesis should be deferred because the host is busy.

    ``sample=True`` takes a short (100 ms) blocking reading so the decision is
    based on current load; callers already run off the event loop.
    """
    if not _HAS_PSUTIL:
        return False
    load = measure(interval=0.1) if sample else current()
    return load >= float(config.cpu_defer_threshold)


def deferred_payload() -> dict:
    """The standard 'busy, try later' response body (blueprint-specified)."""
    return {
        "status": "deferred",
        "message": (
            f"Host system CPU busy (>{config.cpu_defer_threshold}%). "
            "Context preserved; generation deferred."
        ),
        "cpu_percent": round(current(), 1),
    }


def status() -> dict:
    """For /health: governor availability + current load + threshold."""
    return {
        "psutil_installed": _HAS_PSUTIL,
        "cpu_percent": round(current(), 1),
        "defer_threshold": config.cpu_defer_threshold,
    }


_prime()
