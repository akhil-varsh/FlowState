"""Optional at-rest encryption for the snapshot payload (Phase 7).

FlowState is local-only, so encryption is *opt-in*: set ``FLOWSTATE_ENCRYPTION_KEY``
to a passphrase and the sensitive part of each snapshot — the full JSON blob — is
encrypted before it touches disk, and decrypted on read. With the variable unset
(the default) everything is stored in plaintext, exactly as before, so existing
databases keep working.

Scope and honest trade-offs
---------------------------
- We encrypt the ``data`` column (the whole structured snapshot: files, cursor,
  diff, terminal, clipboard). The low-sensitivity index columns that queries need
  — ``workspace_name``, ``ts``, ``headline`` — stay plaintext so the restore path
  remains a plain indexed SQL lookup. If you need the *entire* database opaque
  (including workspace names), use a SQLCipher-enabled SQLite build instead; see
  the README. This module is the portable, dependency-light option that works on
  any Python (including 3.14, where a SQLCipher wheel may not exist).
- The key is derived from the passphrase with PBKDF2-HMAC-SHA256 and a fixed,
  app-specific salt. That is deliberately simple: the threat model is "someone
  reads the SQLite file off my disk", not a networked attacker. It is not a
  substitute for full-disk encryption.

Format: an encrypted value is stored as ``"enc:v1:<fernet-token>"``. Any value
without that prefix is treated as plaintext, which is what makes mixed / migrated
databases and the key-off default both just work.
"""

from __future__ import annotations

import base64
import os
from typing import Optional

try:  # pragma: no cover - import guard
    from cryptography.fernet import Fernet, InvalidToken
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

    _HAS_CRYPTO = True
except Exception:  # pragma: no cover
    _HAS_CRYPTO = False


_PREFIX = "enc:v1:"
# Fixed salt: this protects a local file, not a password database. Changing it
# would make previously-encrypted rows undecryptable, so it is a constant.
_SALT = b"flowstate.v1.local-at-rest"
_ITERATIONS = 200_000

_fernet: "Optional[Fernet]" = None
_resolved = False


def _passphrase() -> str:
    # Env var wins (read live so tests and shells can toggle it); otherwise the
    # value resolved by config (which also reads config.toml).
    env = os.environ.get("FLOWSTATE_ENCRYPTION_KEY")
    if env is not None:
        return env.strip()
    try:
        from .config import config

        return (config.encryption_key or "").strip()
    except Exception:
        return ""


def _get_fernet() -> "Optional[Fernet]":
    """Build (once) a Fernet from the passphrase, or None if encryption is off."""
    global _fernet, _resolved
    if _resolved:
        return _fernet
    _resolved = True
    passphrase = _passphrase()
    if not passphrase:
        _fernet = None
        return None
    if not _HAS_CRYPTO:
        # Key requested but the library is missing — fail loudly rather than
        # silently writing plaintext the user believes is encrypted.
        raise RuntimeError(
            "FLOWSTATE_ENCRYPTION_KEY is set but the 'cryptography' package is "
            "not installed. Install it (pip install cryptography) or unset the key."
        )
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_SALT,
        iterations=_ITERATIONS,
    )
    key = base64.urlsafe_b64encode(kdf.derive(passphrase.encode("utf-8")))
    _fernet = Fernet(key)
    return _fernet


def encryption_enabled() -> bool:
    try:
        return _get_fernet() is not None
    except RuntimeError:
        return False


def encrypt(text: str) -> str:
    """Encrypt if a key is configured; otherwise return ``text`` unchanged."""
    f = _get_fernet()
    if f is None:
        return text
    token = f.encrypt(text.encode("utf-8")).decode("ascii")
    return _PREFIX + token


def decrypt(value: str) -> str:
    """Decrypt an ``enc:v1:`` value; pass plaintext through untouched.

    A stored ciphertext with no key (or the wrong key) raises, because returning
    garbage would be worse than a clear failure.
    """
    if not value.startswith(_PREFIX):
        return value  # plaintext row (key off, or written before encryption)
    f = _get_fernet()
    if f is None:
        raise RuntimeError(
            "Found encrypted snapshots but FLOWSTATE_ENCRYPTION_KEY is not set. "
            "Set the same passphrase used to write them."
        )
    token = value[len(_PREFIX):].encode("ascii")
    try:
        return f.decrypt(token).decode("utf-8")
    except InvalidToken as err:  # wrong passphrase
        raise RuntimeError(
            "Could not decrypt a snapshot — FLOWSTATE_ENCRYPTION_KEY does not "
            "match the key it was written with."
        ) from err


def status() -> dict:
    """For /health: whether at-rest encryption is active."""
    try:
        on = encryption_enabled()
    except RuntimeError as err:
        return {"at_rest_encryption": False, "error": str(err)}
    return {"at_rest_encryption": on, "crypto_installed": _HAS_CRYPTO}
