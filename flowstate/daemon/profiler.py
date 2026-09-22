"""Deep context profiler (Phase 10) — Start-of-Day / End-of-Day captures.

A deep inspection of the local workspace, run on demand when the user clicks
"Start Day" or "End Day". It records the project directory + git status, the
files open in the editor (from the most recent editor snapshot), and a bounded,
sanitized excerpt of the active file read from disk, tagged with the file's
architectural role. The morning baseline and the evening state are what the
end-of-day report diffs to describe the day's work.

The daemon can read files on disk (it owns the workspace root); it does not read
the IDE's memory, so open-file/cursor context is taken from the latest editor
snapshot the extension already sent. Everything captured here is sanitized before
storage, exactly like a normal snapshot.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from .capture.git_collector import collect_git_state
from .models import Cursor, EditorState, EventType, Snapshot, Trigger, Workspace
from .sanitize import sanitize_snapshot

# Bounded excerpt so a deep capture stays compact (~4 KB of text at most).
_MAX_EXCERPT_CHARS = 4000

# Map a file extension to a plain-English architectural role.
_ROLE_BY_EXT = {
    ".py": "backend logic (Python)",
    ".rb": "backend logic (Ruby)",
    ".go": "backend logic (Go)",
    ".java": "backend logic (Java)",
    ".cs": "backend logic (C#)",
    ".rs": "backend logic (Rust)",
    ".ts": "application logic (TypeScript)",
    ".js": "application logic (JavaScript)",
    ".jsx": "UI component (React)",
    ".tsx": "UI component (React)",
    ".vue": "UI component (Vue)",
    ".svelte": "UI component (Svelte)",
    ".html": "UI markup",
    ".css": "UI styling",
    ".scss": "UI styling",
    ".sql": "database migration / query",
    ".md": "documentation",
    ".json": "configuration",
    ".yaml": "configuration",
    ".yml": "configuration",
    ".toml": "configuration",
    ".sh": "automation script",
    ".ps1": "automation script",
}


def _role_for(path: str) -> str:
    if not path:
        return ""
    ext = Path(path).suffix.lower()
    if path.endswith((".test.ts", ".test.tsx", ".test.js", ".spec.py")) or "test" in Path(path).stem.lower():
        return "tests"
    return _ROLE_BY_EXT.get(ext, "source file")


def _read_excerpt(root: str, rel_path: str) -> str:
    """Read a bounded excerpt of the active file from disk. Never raises."""
    if not root or not rel_path:
        return ""
    try:
        p = Path(root) / rel_path
        if not p.is_file():
            # rel_path may already be absolute, or not exist yet.
            p = Path(rel_path)
            if not p.is_file():
                return ""
        if p.stat().st_size > 2_000_000:  # skip very large files
            return ""
        text = p.read_text(encoding="utf-8", errors="ignore")
        return text[:_MAX_EXCERPT_CHARS]
    except Exception:
        return ""


async def capture_deep(
    store,
    event_type: EventType,
    workspace_name: Optional[str] = None,
    workspace_root: Optional[str] = None,
) -> Optional[Snapshot]:
    """Take a deep Start/End-of-Day snapshot and persist it.

    Uses the latest editor snapshot for the workspace as the base for open files
    and cursor, enriches with a fresh git read and an on-disk active-file excerpt,
    tags the event type, sanitizes, and stores. Returns the stored snapshot (or
    ``None`` if there is no workspace to profile).
    """
    base: Optional[Snapshot] = None
    if workspace_name:
        base = await store.latest_for_workspace(workspace_name)
    if base is None:
        base = await store.latest_any()

    name = workspace_name or (base.workspace.name if base else "")
    root = workspace_root or (base.workspace.root if base else "")
    if not name and not root:
        return None

    editor = EditorState()
    if base is not None:
        editor.active_file = base.editor.active_file
        editor.cursor = Cursor(line=base.editor.cursor.line, col=base.editor.cursor.col)
        editor.open_files = list(base.editor.open_files)
        editor.recently_edited = list(base.editor.recently_edited)

    editor.active_file_excerpt = _read_excerpt(root, editor.active_file)
    editor.file_role = _role_for(editor.active_file)

    git = collect_git_state(root) if root else None

    snap = Snapshot(
        trigger=Trigger.manual,
        event_type=event_type,
        workspace=Workspace(name=name, root=root, git=git),
        editor=editor,
    )
    snap = sanitize_snapshot(snap)

    label = "Start of day" if event_type == EventType.start_of_day else "End of day"
    headline = f"{label}: {name or 'workspace'}"
    await store.store(snap, headline=headline)
    return snap
