"""End-of-day report cloud sync (Phase 10) — the ONLY thing that may leave localhost.

The blueprint's hybrid rule: raw snapshots, code, file contents and clipboard NEVER
leave the machine. When (and only when) the operator explicitly enables cloud sync
and provides an endpoint, the generated *high-level summary string* — plus minimal
metadata (date, workspace, user) — is POSTed to a manager-visibility store
(Supabase REST, or a mock endpoint).

Everything here is opt-in and fail-safe:
- Disabled by default (``cloud_report_enabled = false``) and a no-op with no URL.
- Sends a whitelisted payload only — never a Snapshot, never file contents.
- Synchronous ``requests`` call; callers run it via ``asyncio.to_thread``.
- Never raises into the request path; returns a status dict either way.
"""

from __future__ import annotations

import ssl
from datetime import datetime, timezone
from urllib.parse import unquote, urlsplit

from .config import config
from .models import DailyReport

try:  # pragma: no cover - import guard
    import requests

    _HAS_REQUESTS = True
except Exception:  # pragma: no cover
    requests = None  # type: ignore
    _HAS_REQUESTS = False

try:  # pragma: no cover - optional Postgres (Supabase) sink, pure-Python driver
    import pg8000.dbapi as _pg

    _HAS_PG = True
except Exception:  # pragma: no cover
    _pg = None  # type: ignore
    _HAS_PG = False


_PG_TABLE = "flowstate_daily_reports"


def _is_postgres(url: str) -> bool:
    return url.startswith("postgresql://") or url.startswith("postgres://")


def _pg_connect():
    """Open a pg8000 connection from the configured postgresql:// URL.

    TLS-encrypted; identity check relaxed for pooled endpoints. Caller closes it.
    """
    parts = urlsplit(config.cloud_report_url)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return _pg.connect(
        user=unquote(parts.username or ""),
        password=unquote(parts.password or ""),
        host=parts.hostname or "",
        port=parts.port or 5432,
        database=(parts.path or "/postgres").lstrip("/") or "postgres",
        ssl_context=ctx,
        timeout=15,
    )


def _headers() -> dict:
    headers = {"Content-Type": "application/json"}
    key = config.cloud_report_key
    if key:
        # Works for Supabase (apikey + Authorization) and generic bearer APIs.
        headers["apikey"] = key
        headers["Authorization"] = f"Bearer {key}"
    return headers


def _payload(report: DailyReport, report_markdown: str, date: str, workspace: str) -> dict:
    """A whitelisted, summary-only payload. No raw snapshot ever appears here."""
    return {
        "user": config.report_user or "",
        "date": date,
        "workspace": workspace,
        "summary": report_markdown,
        "primary_objectives": report.primary_objectives,
        "status_and_blockers": report.status_and_blockers,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "flowstate",
    }


def _push_postgres(report: DailyReport, report_markdown: str, date: str, workspace: str) -> dict:
    """Insert the summary into a Postgres table (e.g. Supabase). Summary only.

    Uses pg8000 (pure Python — no native build). Creates the table if missing so
    a first run works out of the box. Never sends raw snapshots or code — just the
    generated report fields, exactly like the REST path.
    """
    if not _HAS_PG:
        return {"pushed": False, "reason": "pg8000 not installed"}
    con = None
    try:
        con = _pg_connect()
        cur = con.cursor()
        cur.execute(
            f"""CREATE TABLE IF NOT EXISTS {_PG_TABLE} (
                id BIGSERIAL PRIMARY KEY,
                report_user TEXT, report_date TEXT, workspace TEXT,
                summary TEXT, primary_objectives TEXT, files_altered TEXT,
                cross_tool_tasks TEXT, status_and_blockers TEXT,
                generated_at TIMESTAMPTZ, source TEXT,
                created_at TIMESTAMPTZ DEFAULT now())"""
        )
        # Bring older tables up to the current shape (idempotent).
        cur.execute(f"ALTER TABLE {_PG_TABLE} ADD COLUMN IF NOT EXISTS files_altered TEXT")
        cur.execute(f"ALTER TABLE {_PG_TABLE} ADD COLUMN IF NOT EXISTS cross_tool_tasks TEXT")
        cur.execute(
            f"""INSERT INTO {_PG_TABLE}
                (report_user, report_date, workspace, summary, primary_objectives,
                 files_altered, cross_tool_tasks, status_and_blockers, generated_at, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (
                config.report_user or "",
                date,
                workspace,
                report_markdown,
                " | ".join(report.primary_objectives),
                " | ".join(report.files_components_altered),
                " | ".join(report.cross_tool_tasks),
                " | ".join(report.status_and_blockers),
                datetime.now(timezone.utc),
                "flowstate",
            ),
        )
        new_id = cur.fetchone()[0]
        con.commit()
        return {"pushed": True, "target": "postgres", "table": _PG_TABLE, "row_id": new_id}
    except Exception as err:
        return {"pushed": False, "error": f"{type(err).__name__}: {err}"}
    finally:
        if con is not None:
            try:
                con.close()
            except Exception:
                pass


def push_report(
    report: DailyReport,
    report_markdown: str,
    date: str = "",
    workspace: str = "",
) -> dict:
    """Push the summary to the configured cloud sink. Never raises.

    Routes by URL: a ``postgresql://`` URL inserts into Postgres (Supabase);
    anything else is treated as a REST endpoint (PostgREST/Supabase REST, or a
    mock). Returns a status dict: ``{"pushed": bool, ...}``.
    """
    if not config.cloud_report_enabled or not config.cloud_report_url:
        return {"pushed": False, "reason": "cloud sync disabled"}

    if _is_postgres(config.cloud_report_url):
        return _push_postgres(report, report_markdown, date, workspace)

    if not _HAS_REQUESTS:
        return {"pushed": False, "reason": "requests not installed"}
    try:
        resp = requests.post(
            config.cloud_report_url,
            json=_payload(report, report_markdown, date, workspace),
            headers=_headers(),
            timeout=10,
        )
        ok = 200 <= resp.status_code < 300
        return {
            "pushed": ok,
            "status_code": resp.status_code,
            "endpoint": config.cloud_report_url,
        }
    except Exception as err:  # network/DNS/timeout — stay local, report why
        return {"pushed": False, "error": f"{type(err).__name__}: {err}"}


def fetch_monthly(month: str) -> dict:
    """Aggregate the stored daily reports for a month (YYYY-MM) from Postgres.

    Reads only the durable summaries in the cloud table — raw snapshots never
    left the machine — and rolls them up into a monthly view. This is what makes
    the record survive local TTL expiry and powers the monthly report.
    """
    if not (config.cloud_report_url and _is_postgres(config.cloud_report_url) and _HAS_PG):
        return {"available": False, "reason": "no postgres sink configured"}
    con = None
    try:
        con = _pg_connect()
        cur = con.cursor()
        cur.execute(
            f"""SELECT report_date, workspace, primary_objectives, files_altered,
                       cross_tool_tasks, status_and_blockers
                FROM {_PG_TABLE} WHERE report_date LIKE %s ORDER BY report_date""",
            (month + "%",),
        )
        rows = cur.fetchall()
    except Exception as err:
        return {"available": False, "error": f"{type(err).__name__}: {err}"}
    finally:
        if con is not None:
            try:
                con.close()
            except Exception:
                pass

    def _split(s):
        return [x.strip() for x in (s or "").split(" | ") if x.strip()]

    days = sorted({r[0] for r in rows})
    workspaces = sorted({r[1] for r in rows if r[1]})
    files: set = set()
    tasks: set = set()
    objectives: list = []
    blockers: list = []
    per_day: list = []
    for report_date, workspace, obj, fa, ctt, blk in rows:
        objectives += _split(obj)
        files.update(_split(fa))
        tasks.update(_split(ctt))
        blockers += _split(blk)
        per_day.append({"date": report_date, "workspace": workspace, "objectives": _split(obj)})
    return {
        "available": True,
        "month": month,
        "days_reported": len(days),
        "workspaces": workspaces,
        "files_touched": sorted(files),
        "cross_tool_tasks": sorted(tasks),
        "objectives": objectives,
        "blockers": blockers,
        "per_day": per_day,
    }


def status() -> dict:
    """For /health: whether cloud report sync is configured (never the key)."""
    return {
        "cloud_report_enabled": config.cloud_report_enabled,
        "configured": bool(config.cloud_report_url),
        "requests_installed": _HAS_REQUESTS,
        "postgres_sink": _is_postgres(config.cloud_report_url) if config.cloud_report_url else False,
        "pg8000_installed": _HAS_PG,
    }
