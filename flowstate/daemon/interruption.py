"""Native interruption signals (Phase 10) — input idle and screen lock.

The observer uses three interruption triggers: OS input idle, a foreground switch
to a meeting app (detected in the observer from the active window), and a screen
lock. This module owns the two that need native calls:

- ``idle_seconds()``  — seconds since the last mouse/keyboard input, system-wide.
- ``is_screen_locked()`` — whether the workstation is locked (Win+L / secure desktop).

Both are best-effort and fail safe: on any platform or error where the signal is
unavailable they return ``0.0`` / ``False`` so detection simply degrades to the
other triggers. Windows uses ctypes (no extra dependency); macOS uses Quartz via
pyobjc if present.
"""

from __future__ import annotations

import sys


# --------------------------------------------------------------------------
# Idle time
# --------------------------------------------------------------------------
def idle_seconds() -> float:
    """Seconds since the last system-wide user input. 0.0 if unknown."""
    try:
        if sys.platform == "win32":
            return _idle_windows()
        if sys.platform == "darwin":
            return _idle_macos()
    except Exception:
        pass
    return 0.0


def _idle_windows() -> float:
    import ctypes
    from ctypes import wintypes

    class LASTINPUTINFO(ctypes.Structure):
        _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]

    info = LASTINPUTINFO()
    info.cbSize = ctypes.sizeof(LASTINPUTINFO)
    if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):
        return 0.0
    tick = ctypes.windll.kernel32.GetTickCount()
    # GetTickCount wraps every ~49.7 days; clamp negatives to 0.
    elapsed_ms = tick - info.dwTime
    if elapsed_ms < 0:
        return 0.0
    return elapsed_ms / 1000.0


def _idle_macos() -> float:
    # Quartz exposes seconds since the last HID event.
    from Quartz import (  # type: ignore
        CGEventSourceSecondsSinceLastEventType,
        kCGAnyInputEventType,
        kCGEventSourceStateHIDSystemState,
    )

    return float(
        CGEventSourceSecondsSinceLastEventType(
            kCGEventSourceStateHIDSystemState, kCGAnyInputEventType
        )
    )


# --------------------------------------------------------------------------
# Screen lock
# --------------------------------------------------------------------------
def is_screen_locked() -> bool:
    """True if the workstation appears locked. False if unknown."""
    try:
        if sys.platform == "win32":
            return _locked_windows()
        if sys.platform == "darwin":
            return _locked_macos()
    except Exception:
        pass
    return False


def _locked_windows() -> bool:
    """Read the current input desktop name. When the session is locked the input
    desktop switches away from "Default" (to Winlogon / the secure desktop), and
    a normal process often cannot open it at all — either signals a lock."""
    import ctypes

    DESKTOP_READOBJECTS = 0x0001
    UOI_NAME = 2

    user32 = ctypes.windll.user32
    hdesk = user32.OpenInputDesktop(0, False, DESKTOP_READOBJECTS)
    if not hdesk:
        # Cannot open the input desktop -> we are not on it -> locked/secure.
        return True
    try:
        needed = ctypes.c_ulong(0)
        buf = ctypes.create_unicode_buffer(256)
        user32.GetUserObjectInformationW(
            hdesk, UOI_NAME, buf, ctypes.sizeof(buf), ctypes.byref(needed)
        )
        name = buf.value or ""
        return name.lower() != "default"
    finally:
        user32.CloseDesktop(hdesk)


def _locked_macos() -> bool:
    from Quartz import CGSessionCopyCurrentDictionary  # type: ignore

    session = CGSessionCopyCurrentDictionary()
    if not session:
        return False
    return bool(session.get("CGSSessionScreenIsLocked", 0))
