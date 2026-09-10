"""Snapshot assembler — merges Tier 1/2/3 into one Snapshot.

- Tier 1 (editor/terminal/diagnostics): captured by the VS Code extension and
  arrives already populated on the incoming snapshot. This is ground truth and
  is never overwritten here.
- Tier 2 (git): filled in here by running the local git collector against the
  workspace root. The extension does not read git; the daemon owns it.
- Tier 3 (ambient: window title + clipboard): filled in here from the native
  ambient collector (wired in Phase 5). Any unavailable signal is simply left
  as its default.

The result is one compact structured document ready to store.
"""

from __future__ import annotations

from ..models import Snapshot
from .ambient import collect_ambient
from .git_collector import collect_git_state


def assemble(incoming: Snapshot) -> Snapshot:
    """Enrich an incoming (editor-tier) snapshot with git and ambient state.

    Mutates and returns ``incoming``. Editor-tier fields are left untouched —
    they are the extension's ground truth.
    """
    root = incoming.workspace.root

    # Tier 2 — git. Only fill if the extension didn't already provide it.
    if root and incoming.workspace.git is None:
        git_state = collect_git_state(root)
        if git_state is not None:
            incoming.workspace.git = git_state

    # Tier 3 — ambient (active window title + process, clipboard). Fill only if
    # the extension didn't already provide it. Never overrides ground truth.
    if not incoming.ambient.active_app and not incoming.ambient.clipboard_recent:
        ambient = collect_ambient()
        # Preserve any browser_tabs the extension/companion may have supplied.
        if incoming.ambient.browser_tabs:
            ambient.browser_tabs = incoming.ambient.browser_tabs
        incoming.ambient = ambient

    return incoming
