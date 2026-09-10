"""FlowState daemon — the local, offline orchestrator.

Binds to 127.0.0.1 only. After a one-time model pull, it makes no outbound
network calls. It assembles snapshots, stores them ephemerally, and (on demand)
asks a local model for a "where you left off" briefing.
"""

__version__ = "0.1.0"
