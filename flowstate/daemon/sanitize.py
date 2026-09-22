"""Data sanitizer (Phase 10) — mask secrets and PII before storage or embedding.

All captured text — clipboard, editor selections, terminal output, git diffs,
diagnostic messages, active-file excerpts — can contain proprietary IP and
secrets. This module strips the high-risk classes (API keys, bearer/JWT tokens,
passwords, private keys, emails, and long digit runs that look like card/account
numbers) BEFORE anything is written to SQLite or embedded into the vector index.

Design rules
------------
- **Fail safe, never fail loud.** Sanitization must never break capture. Every
  entry point swallows errors and returns the input unchanged on failure.
- **Idempotent.** Re-running the sanitizer over already-masked text is a no-op
  (the mask tokens contain no matchable secrets).
- **Structure-preserving.** We mask *values*, not structure, so a summary can
  still say "a bearer token" without leaking it. Masks look like ``[REDACTED:EMAIL]``.
- **Order matters.** The most specific / highest-entropy patterns run first
  (private keys, JWTs, key=value secrets) so a generic rule can't shadow them.

This is a defense-in-depth layer, not a guarantee: it complements — never
replaces — the localhost-only boundary and at-rest encryption.
"""

from __future__ import annotations

import re
from typing import List

from .config import config
from .models import Snapshot

# --------------------------------------------------------------------------
# Patterns — ordered most-specific first. Each maps to a stable mask label.
# --------------------------------------------------------------------------
# PEM private key blocks (multi-line) — collapse the whole block.
_PEM_RE = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----",
    re.DOTALL,
)

# JWTs: three base64url segments separated by dots.
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b")

# Cloud / provider key formats with recognizable prefixes.
_PREFIXED_KEY_RE = re.compile(
    r"\b("
    r"AKIA[0-9A-Z]{16}"                       # AWS access key id
    r"|ASIA[0-9A-Z]{16}"                      # AWS temporary key id
    r"|sk-[A-Za-z0-9]{20,}"                   # OpenAI-style secret
    r"|xox[baprs]-[A-Za-z0-9-]{10,}"          # Slack token
    r"|gh[pousr]_[A-Za-z0-9]{20,}"            # GitHub token
    r"|AIza[0-9A-Za-z_-]{20,}"                # Google API key
    r"|glpat-[A-Za-z0-9_-]{20,}"              # GitLab PAT
    r")\b"
)

# Authorization / bearer headers.
_BEARER_RE = re.compile(r"\b[Bb]earer\s+[A-Za-z0-9._~+/=-]{10,}")

# key = value / key: value secrets. Masks only the value.
_KV_SECRET_RE = re.compile(
    r"(?i)\b(password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|"
    r"auth[_-]?token|client[_-]?secret|private[_-]?key|connection[_-]?string|"
    r"conn[_-]?str|db[_-]?password|token)\b\s*[:=]\s*"
    r"(\"[^\"]*\"|'[^']*'|[^\s,;)&]+)"
)

# Email addresses.
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

# Long digit runs (13-19) — card / account-number shaped. Allows spaces/dashes.
_LONGNUM_RE = re.compile(r"\b(?:\d[ -]?){13,19}\b")

# --------------------------------------------------------------------------
# Core
# --------------------------------------------------------------------------
def sanitize_text(text: str) -> str:
    """Return ``text`` with secrets and PII masked. Never raises."""
    if not text or not config.sanitize_enabled:
        return text
    try:
        out = _PEM_RE.sub("[REDACTED:PRIVATE_KEY]", text)
        out = _JWT_RE.sub("[REDACTED:JWT]", out)
        out = _PREFIXED_KEY_RE.sub("[REDACTED:API_KEY]", out)
        out = _BEARER_RE.sub("Bearer [REDACTED:TOKEN]", out)
        out = _KV_SECRET_RE.sub(lambda m: f"{m.group(1)}=[REDACTED:SECRET]", out)
        out = _EMAIL_RE.sub("[REDACTED:EMAIL]", out)
        out = _LONGNUM_RE.sub("[REDACTED:NUMBER]", out)
        return out
    except Exception:  # sanitization must never break capture
        return text


def sanitize_list(items: List[str]) -> List[str]:
    return [sanitize_text(x) for x in items]


def sanitize_snapshot(snap: Snapshot) -> Snapshot:
    """Mask every free-text field on a snapshot in place, then return it.

    Structured identifiers (file paths, branch names, cursor position) are left
    intact — they are needed for restoration and are not secret-bearing. Only the
    fields that can carry pasted secrets or document text are scrubbed.
    """
    if not config.sanitize_enabled:
        return snap
    try:
        e = snap.editor
        e.selection = sanitize_text(e.selection)
        e.active_file_excerpt = sanitize_text(e.active_file_excerpt)

        for c in snap.terminal.recent_commands:
            c.cmd = sanitize_text(c.cmd)
            c.output_tail = sanitize_text(c.output_tail)

        for d in snap.diagnostics:
            d.message = sanitize_text(d.message)

        a = snap.ambient
        a.active_app = sanitize_text(a.active_app)
        a.clipboard_recent = sanitize_list(a.clipboard_recent)
        a.browser_tabs = sanitize_list(a.browser_tabs)

        if snap.workspace.git:
            snap.workspace.git.diff_summary = sanitize_text(snap.workspace.git.diff_summary)
    except Exception:
        pass
    return snap


def status() -> dict:
    """For /health: whether sanitization is active."""
    return {"sanitize_enabled": config.sanitize_enabled}
