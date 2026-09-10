"""Capture layer — tiered by reliability.

- ``assembler.py``     : merge Tier 1 (editor, from the extension) + Tier 2
                         (git) + Tier 3 (ambient) into one Snapshot.
- ``git_collector.py`` : Tier 2 — branch, dirty files, diff, recent commits.
- ``ambient.py``       : Tier 3 — active window title + clipboard (Phase 5).
"""

from .ambient import collect_ambient
from .assembler import assemble
from .git_collector import collect_git_state

__all__ = ["assemble", "collect_ambient", "collect_git_state"]
