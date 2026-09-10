"""Native ambient collector (Tier 3).

Reads ONLY the least-invasive OS signals that the editor cannot see:
- the active window's title and process name (NOT its content), and
- the current clipboard text (the user's own clipboard, truncated).

It never reads the contents of other applications, never takes screenshots,
and never uses accessibility APIs to scrape document text. Any signal that is
unavailable is simply omitted — capture must always degrade gracefully.

Windows uses pywin32; macOS uses pyobjc (best-effort). Other platforms return
an empty ambient state.
"""

from __future__ import annotations

import sys

from ..models import AmbientState

_MAX_TITLE = 140
_MAX_CLIP = 240


def collect_ambient() -> AmbientState:
    try:
        if sys.platform == "win32":
            return _collect_windows()
        if sys.platform == "darwin":
            return _collect_macos()
    except Exception:
        # Never let ambient capture break a snapshot.
        pass
    return AmbientState()


# --------------------------------------------------------------------------
# Windows (pywin32)
# --------------------------------------------------------------------------
def _collect_windows() -> AmbientState:
    import os

    import win32api  # type: ignore
    import win32con  # type: ignore
    import win32gui  # type: ignore
    import win32process  # type: ignore

    state = AmbientState()

    # Active window title + owning process name (never window *content*).
    try:
        hwnd = win32gui.GetForegroundWindow()
        title = win32gui.GetWindowText(hwnd) or ""
        proc = ""
        try:
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            handle = win32api.OpenProcess(
                win32con.PROCESS_QUERY_LIMITED_INFORMATION, False, pid
            )
            proc = os.path.basename(win32process.GetModuleFileNameEx(handle, 0))
        except Exception:
            proc = ""
        state.active_app = _fmt_app(proc, title)
    except Exception:
        pass

    # Current clipboard text only (CF_UNICODETEXT). Not a background poll —
    # read once, at capture time.
    try:
        state.clipboard_recent = _windows_clipboard()
    except Exception:
        state.clipboard_recent = []

    return state


def _windows_clipboard() -> list[str]:
    import win32clipboard  # type: ignore

    text = ""
    win32clipboard.OpenClipboard()
    try:
        if win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_UNICODETEXT):
            text = win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT) or ""
    finally:
        win32clipboard.CloseClipboard()
    text = text.strip()
    if not text:
        return []
    return [text[:_MAX_CLIP]]


# --------------------------------------------------------------------------
# macOS (pyobjc) — best effort, not testable on the build machine
# --------------------------------------------------------------------------
def _collect_macos() -> AmbientState:
    state = AmbientState()
    try:
        from AppKit import NSPasteboard, NSWorkspace  # type: ignore

        app = NSWorkspace.sharedWorkspace().frontmostApplication()
        if app is not None:
            name = app.localizedName() or ""
            state.active_app = str(name)[:_MAX_TITLE]

        pb = NSPasteboard.generalPasteboard()
        text = pb.stringForType_("public.utf8-plain-text")
        if text:
            clip = str(text).strip()
            if clip:
                state.clipboard_recent = [clip[:_MAX_CLIP]]
    except Exception:
        pass
    return state


def _fmt_app(proc: str, title: str) -> str:
    title = (title or "").strip()[:_MAX_TITLE]
    proc = (proc or "").strip()
    if proc and title:
        return f"{proc} — {title}"
    return proc or title
