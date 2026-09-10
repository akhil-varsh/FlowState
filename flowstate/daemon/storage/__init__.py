"""Storage layer.

- ``hot.py``  : SQLite. Fast, indexed, ephemeral. Powers the restore path.
- ``cold.py`` : ChromaDB. Vector search. Powers the history-search feature ONLY
                (added in Phase 6). Never used on the restore path.
"""

from .cold import ColdStore
from .hot import HotStore

__all__ = ["HotStore", "ColdStore"]
