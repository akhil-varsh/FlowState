"""Git collector (Tier 2 ground truth).

Reads the repository state that defines *where in version control* the user
was: current branch, uncommitted (dirty) files, a compact diff summary, and
recent commit subjects.

Primary path uses ``pygit2`` (libgit2). If pygit2 is unavailable, we shell out
to the ``git`` CLI. Everything runs locally against a directory on disk — no
network.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import List, Optional

from ..models import GitState

try:  # pragma: no cover - import guard
    import pygit2  # type: ignore

    _HAS_PYGIT2 = True
except Exception:  # pragma: no cover
    pygit2 = None  # type: ignore
    _HAS_PYGIT2 = False


_MAX_DIRTY = 50
_MAX_COMMITS = 5
_MAX_DIFF_SUMMARY = 1200  # keep snapshots compact


def collect_git_state(root: str) -> Optional[GitState]:
    """Return git state for the workspace at ``root``, or None if not a repo.

    Never raises for the common failure modes (no repo, no git); returns None
    or a partially-filled GitState instead, so capture degrades gracefully.
    """
    if not root:
        return None
    path = Path(root)
    if not path.exists():
        return None

    if _HAS_PYGIT2:
        state = _collect_pygit2(path)
        if state is not None:
            return state
    return _collect_cli(path)


# --------------------------------------------------------------------------
# pygit2 path
# --------------------------------------------------------------------------
def _collect_pygit2(path: Path) -> Optional[GitState]:
    try:
        repo_path = pygit2.discover_repository(str(path))  # type: ignore
        if repo_path is None:
            return None
        repo = pygit2.Repository(repo_path)  # type: ignore
    except Exception:
        return None

    try:
        branch = _pygit2_branch(repo)
        dirty = _pygit2_dirty(repo)
        commits = _pygit2_commits(repo)
        diff_summary = _pygit2_diff_summary(repo)
    except Exception:
        return None

    return GitState(
        branch=branch,
        dirty_files=dirty[:_MAX_DIRTY],
        diff_summary=diff_summary[:_MAX_DIFF_SUMMARY],
        recent_commits=commits[:_MAX_COMMITS],
    )


def _pygit2_branch(repo) -> str:
    try:
        if repo.head_is_unborn:
            return "(unborn)"
        if repo.head_is_detached:
            return f"(detached@{str(repo.head.target)[:7]})"
        return repo.head.shorthand
    except Exception:
        return ""


def _pygit2_dirty(repo) -> List[str]:
    dirty: List[str] = []
    try:
        status = repo.status()
        # Bit flags for "not committed" states (staged or unstaged), excluding
        # ignored files.
        ignored = getattr(pygit2, "GIT_STATUS_IGNORED", 1 << 14)
        for filepath, flags in status.items():
            if flags & ignored:
                continue
            dirty.append(filepath)
    except Exception:
        pass
    return sorted(dirty)


def _pygit2_commits(repo) -> List[str]:
    commits: List[str] = []
    try:
        if repo.head_is_unborn:
            return commits
        for i, commit in enumerate(repo.walk(repo.head.target)):
            if i >= _MAX_COMMITS:
                break
            subject = commit.message.strip().splitlines()[0] if commit.message.strip() else ""
            commits.append(subject)
    except Exception:
        pass
    return commits


def _pygit2_diff_summary(repo) -> str:
    """A compact per-file summary of the working-tree diff (names + stats)."""
    try:
        if repo.head_is_unborn:
            return ""
        diff = repo.diff()  # working tree vs index
        parts: List[str] = []
        for patch in diff:
            d = patch.delta
            path_name = d.new_file.path or d.old_file.path
            # line_stats is (context, additions, deletions)
            try:
                _, additions, deletions = patch.line_stats
                parts.append(f"{path_name} +{additions}/-{deletions}")
            except Exception:
                parts.append(path_name)
        return "; ".join(parts)
    except Exception:
        return ""


# --------------------------------------------------------------------------
# git CLI fallback
# --------------------------------------------------------------------------
def _git(path: Path, *args: str) -> Optional[str]:
    try:
        out = subprocess.run(
            ["git", "-C", str(path), *args],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if out.returncode != 0:
            return None
        return out.stdout
    except Exception:
        return None


def _collect_cli(path: Path) -> Optional[GitState]:
    # Confirm it's a repo first.
    inside = _git(path, "rev-parse", "--is-inside-work-tree")
    if inside is None or inside.strip() != "true":
        return None

    branch = ""
    b = _git(path, "rev-parse", "--abbrev-ref", "HEAD")
    if b is not None:
        branch = b.strip()
        if branch == "HEAD":  # detached
            short = _git(path, "rev-parse", "--short", "HEAD")
            branch = f"(detached@{short.strip()})" if short else "(detached)"

    dirty: List[str] = []
    status = _git(path, "status", "--porcelain")
    if status:
        for line in status.splitlines():
            if len(line) > 3:
                dirty.append(line[3:].strip())

    commits: List[str] = []
    log = _git(path, "log", f"-{_MAX_COMMITS}", "--pretty=format:%s")
    if log:
        commits = [ln.strip() for ln in log.splitlines() if ln.strip()]

    diff_summary = ""
    stat = _git(path, "diff", "--stat", "--stat-width=60")
    if stat:
        # Keep the per-file lines, drop the trailing summary line.
        lines = [ln.strip() for ln in stat.splitlines() if "|" in ln]
        diff_summary = "; ".join(lines)

    return GitState(
        branch=branch,
        dirty_files=sorted(dirty)[:_MAX_DIRTY],
        diff_summary=diff_summary[:_MAX_DIFF_SUMMARY],
        recent_commits=commits[:_MAX_COMMITS],
    )
