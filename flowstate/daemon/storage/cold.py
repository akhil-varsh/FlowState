"""Cold store: ChromaDB vector index for the "search my history" feature.

This is the ONLY place vectors are used. The restore path never touches this —
it is a single indexed SQL lookup in ``hot.py``. Semantic search is a separate,
opt-in feature: "when did I last touch auth?", "that session about the CSS grid".

Design notes
------------
- **Embedding model.** We use Chroma's built-in default embedding function,
  which is ``all-MiniLM-L6-v2`` served through **ONNX Runtime** — the exact model
  the spec names, but with no PyTorch dependency. That keeps it light and CPU-fast
  on a 16 GB, no-GPU laptop (Python 3.14 has no torch wheels anyway). The model
  (~80 MB) downloads once, like the Ollama pull, then runs fully offline.
- **Offline / no telemetry.** Chroma's anonymized telemetry is disabled, so the
  daemon still makes zero outbound calls after the one-time model fetch.
- **Graceful degradation.** If ``chromadb`` is not installed or the model can't be
  loaded, the store reports unavailable and ``/search`` returns empty rather than
  erroring — capture and restore are never affected.
- **Cosine space.** The collection uses cosine distance, so a hit's similarity is
  ``1 - distance`` in [0, 1], which we surface as a "% match".
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from ..config import config
from ..models import SearchHit

try:  # pragma: no cover - import guard
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions

    _HAS_CHROMA = True
except Exception:  # pragma: no cover
    chromadb = None  # type: ignore
    _HAS_CHROMA = False


_COLLECTION = "snapshots"


class ColdStore:
    """Vector index over snapshot digests. One instance for the app lifetime.

    All Chroma calls are synchronous (they embed on the CPU); callers run them
    off the event loop via ``asyncio.to_thread``.
    """

    def __init__(self, persist_dir: Optional[str] = None) -> None:
        self._persist_dir = Path(persist_dir) if persist_dir else config.data_dir / "chroma"
        self._client = None
        self._collection = None
        self._init_error: Optional[str] = None
        self._tried = False

    # -- lifecycle ---------------------------------------------------------
    def _ensure(self):
        """Lazily open the client + collection (loads the embedder on first use).

        Memoized. On failure, records the error and returns None so callers
        degrade gracefully instead of raising.
        """
        if self._collection is not None:
            return self._collection
        if self._tried and self._init_error:
            return None
        self._tried = True
        if not _HAS_CHROMA:
            self._init_error = "chromadb not installed"
            return None
        try:
            self._persist_dir.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=str(self._persist_dir),
                settings=Settings(anonymized_telemetry=False, allow_reset=False),
            )
            # DefaultEmbeddingFunction == all-MiniLM-L6-v2 via ONNX Runtime.
            ef = embedding_functions.DefaultEmbeddingFunction()
            self._collection = self._client.get_or_create_collection(
                name=_COLLECTION,
                embedding_function=ef,
                metadata={"hnsw:space": "cosine"},
            )
            return self._collection
        except Exception as err:  # model download blocked, disk issue, etc.
            self._init_error = f"{type(err).__name__}: {err}"
            self._collection = None
            return None

    @property
    def available(self) -> bool:
        return self._ensure() is not None

    # -- writes ------------------------------------------------------------
    def add(self, snapshot_id: str, workspace: str, ts: float, text: str) -> bool:
        """Upsert one snapshot's searchable digest. Returns success.

        ``ts`` is unix epoch seconds; ``text`` is a short human-readable digest
        (never raw file contents). Upsert keeps a single vector per snapshot even
        when /restore later replaces the digest with a richer model summary.
        """
        col = self._ensure()
        if col is None or not text.strip():
            return False
        try:
            col.upsert(
                ids=[snapshot_id],
                documents=[text],
                metadatas=[{"workspace": workspace, "ts": float(ts)}],
            )
            return True
        except Exception as err:
            print(f"[FlowState] cold.add failed ({type(err).__name__}: {err})")
            return False

    # -- reads -------------------------------------------------------------
    def search(self, query: str, k: int = 8, workspace: Optional[str] = None) -> List[SearchHit]:
        """Semantic search over stored digests. Empty list if unavailable."""
        col = self._ensure()
        if col is None or not query.strip():
            return []
        try:
            where = {"workspace": workspace} if workspace else None
            res = col.query(
                query_texts=[query],
                n_results=max(1, min(k, 50)),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as err:
            print(f"[FlowState] cold.search failed ({type(err).__name__}: {err})")
            return []

        ids = (res.get("ids") or [[]])[0]
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]

        hits: List[SearchHit] = []
        for i, sid in enumerate(ids):
            meta = metas[i] or {}
            ts = float(meta.get("ts", 0.0))
            dist = float(dists[i]) if i < len(dists) else 1.0
            hits.append(
                SearchHit(
                    id=sid,
                    timestamp=datetime.fromtimestamp(ts, tz=timezone.utc)
                    if ts
                    else datetime.now(timezone.utc),
                    workspace_name=str(meta.get("workspace", "")),
                    summary_text=docs[i] if i < len(docs) else "",
                    # cosine distance -> similarity in [0, 1]
                    score=max(0.0, 1.0 - dist),
                )
            )
        return hits

    def count(self) -> int:
        col = self._ensure()
        if col is None:
            return 0
        try:
            return col.count()
        except Exception:
            return 0

    # -- maintenance (TTL parity with the hot store; wired fully in Phase 7)
    def delete_ids(self, ids: List[str]) -> None:
        col = self._ensure()
        if col is None or not ids:
            return
        try:
            col.delete(ids=ids)
        except Exception as err:
            print(f"[FlowState] cold.delete_ids failed ({type(err).__name__}: {err})")

    def purge_before(self, cutoff_ts: float) -> None:
        """Drop vectors whose snapshot timestamp is older than ``cutoff_ts``."""
        col = self._ensure()
        if col is None:
            return
        try:
            col.delete(where={"ts": {"$lt": float(cutoff_ts)}})
        except Exception as err:
            print(f"[FlowState] cold.purge_before failed ({type(err).__name__}: {err})")

    def health(self) -> dict:
        info: dict = {"chroma_installed": _HAS_CHROMA}
        if not _HAS_CHROMA:
            info["available"] = False
            return info
        ok = self._ensure() is not None
        info["available"] = ok
        if ok:
            info["indexed"] = self.count()
            info["embed_model"] = "all-MiniLM-L6-v2 (onnx)"
        elif self._init_error:
            info["error"] = self._init_error
        return info
