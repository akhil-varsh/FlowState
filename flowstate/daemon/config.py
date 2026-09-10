"""FlowState daemon configuration.

Resolution order for every setting (first match wins):

1. Environment variable, prefixed ``FLOWSTATE_`` (e.g. ``FLOWSTATE_MODEL``).
2. The config file ``config.toml`` in the data directory.
3. The built-in default below.

The data directory itself is bootstrap — it is resolved from ``FLOWSTATE_DATA_DIR``
or the per-user default only (never from the file, since the file lives inside it).
On first run the daemon writes a fully-commented ``config.toml`` there so an
installed copy can be configured by editing one file, no environment variables
needed. The daemon stays localhost-only and fully offline after the one-time
model pull, so these defaults are the safe, private defaults.
"""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path


def _default_data_dir() -> Path:
    """Per-user profile directory for the ephemeral hot store + config file."""
    override = os.environ.get("FLOWSTATE_DATA_DIR")
    if override:
        return Path(override)
    local = os.environ.get("LOCALAPPDATA")
    if local:
        return Path(local) / "FlowState"
    return Path.home() / ".local" / "share" / "flowstate"


_DATA_DIR = _default_data_dir()
_CONFIG_FILENAME = "config.toml"


def _load_file() -> dict:
    """Read config.toml from the data dir, if present. Never raises."""
    path = _DATA_DIR / _CONFIG_FILENAME
    try:
        if path.is_file():
            with open(path, "rb") as fh:
                data = tomllib.load(fh)
            # Accept both flat keys and a [flowstate] table.
            if "flowstate" in data and isinstance(data["flowstate"], dict):
                return {**data, **data["flowstate"]}
            return data
    except Exception as err:  # malformed file must not stop the daemon
        print(f"[FlowState] ignoring bad config.toml ({type(err).__name__}: {err})")
    return {}


_FILE = _load_file()


def _get_str(name: str, default: str) -> str:
    env = os.environ.get(f"FLOWSTATE_{name}")
    if env is not None:
        return env
    v = _FILE.get(name.lower())
    return str(v) if v is not None else default


def _get_int(name: str, default: int) -> int:
    env = os.environ.get(f"FLOWSTATE_{name}")
    if env is not None:
        return int(env)
    v = _FILE.get(name.lower())
    return int(v) if v is not None else default


@dataclass(frozen=True)
class Config:
    # --- Networking: localhost ONLY, never 0.0.0.0 -----------------------
    host: str = field(default_factory=lambda: _get_str("HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: _get_int("PORT", 8420))

    # --- Storage ----------------------------------------------------------
    data_dir: Path = field(default_factory=_default_data_dir)
    db_filename: str = field(default_factory=lambda: _get_str("DB_FILENAME", "flowstate.db"))

    # Ephemerality: snapshots older than this are purged. Default 7 days.
    ttl_seconds: int = field(default_factory=lambda: _get_int("TTL_SECONDS", 7 * 24 * 3600))
    # How often the background sweeper runs the TTL purge. Default 1 hour.
    purge_interval_seconds: int = field(
        default_factory=lambda: _get_int("PURGE_INTERVAL_SECONDS", 3600)
    )

    # --- Inference --------------------------------------------------------
    # The local model is deepseek-r1:1.5b — small enough for a 16 GB, no-GPU
    # laptop and CPU-fast. This is the default and the only supported model.
    model: str = field(default_factory=lambda: _get_str("MODEL", "deepseek-r1:1.5b"))
    ollama_host: str = field(default_factory=lambda: _get_str("OLLAMA_HOST", "http://127.0.0.1:11434"))
    # How long Ollama keeps the model resident after a request.
    ollama_keep_alive: str = field(default_factory=lambda: _get_str("KEEP_ALIVE", "5m"))

    # --- Triggers ---------------------------------------------------------
    focus_debounce_seconds: int = field(
        default_factory=lambda: _get_int("FOCUS_DEBOUNCE_SECONDS", 12)
    )
    idle_seconds: int = field(default_factory=lambda: _get_int("IDLE_SECONDS", 300))
    min_capture_interval_seconds: int = field(
        default_factory=lambda: _get_int("MIN_CAPTURE_INTERVAL_SECONDS", 60)
    )

    # --- Semantic search --------------------------------------------------
    embed_model: str = field(
        default_factory=lambda: _get_str("EMBED_MODEL", "all-MiniLM-L6-v2")
    )

    # --- Optional at-rest encryption -------------------------------------
    # A passphrase turns on encryption of the snapshot payload. Prefer the
    # environment variable; a passphrase written into config.toml is only as
    # private as that file. Empty means encryption is off (plaintext).
    encryption_key: str = field(default_factory=lambda: _get_str("ENCRYPTION_KEY", ""))

    @property
    def db_path(self) -> Path:
        return self.data_dir / self.db_filename

    @property
    def config_path(self) -> Path:
        return self.data_dir / _CONFIG_FILENAME

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.write_default_config()

    def write_default_config(self) -> None:
        """Write a commented config.toml on first run (never overwrites)."""
        path = self.config_path
        if path.exists():
            return
        try:
            path.write_text(_DEFAULT_CONFIG_TOML, encoding="utf-8")
            print(f"[FlowState] wrote default config to {path}")
        except Exception as err:
            print(f"[FlowState] could not write default config ({err})")


_DEFAULT_CONFIG_TOML = """\
# FlowState configuration.
# Edit and restart the daemon. Environment variables (FLOWSTATE_*) override
# anything set here. Lines are commented with their default value; uncomment
# and change to take effect.

# --- Networking (localhost only; do not expose to a public interface) ---
# host = "127.0.0.1"
# port = 8420

# --- Inference ---
# The local Ollama model used to write the "where you left off" briefing.
# FlowState ships with deepseek-r1:1.5b as its default and only supported model.
# model = "deepseek-r1:1.5b"
# ollama_host = "http://127.0.0.1:11434"
# keep_alive = "5m"

# --- Ephemerality ---
# ttl_seconds = 604800            # snapshot retention (7 days)
# purge_interval_seconds = 3600   # how often expired snapshots are swept

# --- Triggers ---
# focus_debounce_seconds = 12       # ignore quick alt-tabs shorter than this
# idle_seconds = 300                # capture after this long with no activity
# min_capture_interval_seconds = 60 # cooldown between automatic captures

# --- Optional at-rest encryption ---
# Set a passphrase to encrypt the snapshot payload on disk. A passphrase here is
# only as private as this file; prefer the FLOWSTATE_ENCRYPTION_KEY env var.
# encryption_key = ""
"""


config = Config()
