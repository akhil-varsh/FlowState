# FlowState

**An ephemeral, privacy-first context restorer for technical workflows.**

FlowState captures a structured snapshot of your working state when you're
interrupted, and when you return, a **local, offline** AI model generates a
"where you left off" briefing — and can reopen your files at the exact cursor
position. Every stage runs on `127.0.0.1`. **No data ever leaves the machine.**

> Core principle: capture ground truth from tools that expose it (the editor's
> API, git, the shell) — never scrape windows or OCR screenshots.

---

## Status

| Phase | What | State |
|------|------|-------|
| 1 | Skeleton: daemon, config, models, SQLite, stub `/snapshot` + `/restore` | ✅ done |
| 2 | Ground-truth capture (VS Code extension + git collector) | ✅ done |
| 3 | Local inference (Ollama structured output) | ✅ done |
| 4 | Dashboard (Next.js) + rehydration | ✅ done |
| 5 | Triggers + ambient collector | ✅ done |
| 6 | History search (ChromaDB) | ✅ done |
| 7 | Hardening (TTL, encryption, offline demo) | ✅ done |
| 8 | Packaging (installer · autostart task · .vsix · config file) | ✅ done |
| 9 | Desktop widget + recording on/off toggle | ✅ done |
| 10 | Zero-Trust Cognitive Restoration (observer · interruption buffer · cross-app restore · daily report · sanitizer · CPU governor) | ✅ done |

---

## Install (packaged Windows build)

For a real "install it and it runs" setup — no Python, no F5, no manual scripts —
FlowState packages into three installable pieces plus a single config file. The
installer bundles the daemon as a standalone `.exe` (via PyInstaller — Python is
**not** required on the target), installs the VS Code extension from a `.vsix`,
and registers the daemon to start at logon.

> **Why a logon task, not a Windows service:** a session-0 service can't see your
> foreground window, which would silently break Tier-3 ambient capture. So the
> daemon autostarts as a per-user **Scheduled Task** that runs in your own
> session (and needs no admin).

### Build the installer

```powershell
# 1. Bundle the daemon into a standalone folder + exe
./scripts/build-daemon.ps1                     # -> dist\flowstate-daemon\flowstate-daemon.exe

# 2. Package the VS Code extension
cd extension; npx @vscode/vsce package; cd ..  # -> extension\flowstate-0.1.0.vsix

# 3. Compile the Windows installer (one-time: winget install JRSoftware.InnoSetup)
iscc installer\flowstate.iss                   # -> installer\Output\FlowState-Setup.exe
```

Running `FlowState-Setup.exe` installs the daemon, installs the extension,
registers autostart, and starts the daemon on `127.0.0.1:8420`. Uninstalling
stops the daemon and removes the task, keeping your snapshots.

### Configure

On first run the daemon writes a commented **`%LOCALAPPDATA%\FlowState\config.toml`**.
Edit it and restart the daemon — `FLOWSTATE_*` environment variables still
override anything set there. Settings include the model, host/port, TTL, trigger
thresholds, and an optional encryption passphrase.

### Last step — the model

The installer can't pull the LLM for you (it depends on your choice and needs
Ollama). Install [Ollama](https://ollama.com/download), run
`ollama pull deepseek-r1:1.5b` — that's the default model, so no config change is
needed. The search embedder downloads itself on first use.

### No-installer path

Prefer not to build the installer? Everything the installer does is runnable
by hand: `./scripts/build-daemon.ps1`, then
`./scripts/postinstall.ps1 -InstallDir dist` (installs the `.vsix`, registers
autostart, starts the daemon). Undo with `./scripts/uninstall-hooks.ps1`.

---

## Repository layout

```
flowstate/
├── daemon/        # FastAPI backend (the orchestrator) — 127.0.0.1 only
├── extension/     # VS Code extension (ground-truth capture)   [Phase 2]
├── dashboard/     # Next.js + Tailwind + Framer Motion UI       [Phase 4]
├── scripts/       # setup · run · build · install helpers
├── installer/     # Inno Setup definition (flowstate.iss)       [Phase 8]
├── run_daemon.py  # frozen-app entry point for PyInstaller
├── docs/          # project dossier (PROJECT.html)
└── README.md
```

---

## Phase 1 — quick start

Requires **Python 3.11+**.

### Windows (PowerShell)

```powershell
cd flowstate
./scripts/setup.ps1        # create venv + install deps
./scripts/run-daemon.ps1   # start daemon on http://127.0.0.1:8420
```

### macOS / Linux

```bash
cd flowstate
python3 -m venv .venv
.venv/bin/pip install -r daemon/requirements.txt
.venv/bin/python -m daemon.main
```

### Verify it works

With the daemon running, in another terminal:

```bash
# Health check
curl http://127.0.0.1:8420/health

# Store a hand-written snapshot
curl -X POST http://127.0.0.1:8420/snapshot \
  -H "Content-Type: application/json" \
  -d @scripts/sample_snapshot.json

# Restore it (echoed back; no AI yet in Phase 1)
curl "http://127.0.0.1:8420/restore?workspace=proj"
```

Interactive API docs: <http://127.0.0.1:8420/docs>

---

## Phase 2 — VS Code extension (ground-truth capture)

The extension captures Tier 1 (editor/terminal/diagnostics); the daemon adds
Tier 2 (git) on receipt via `pygit2` (with a `git`-CLI fallback).

### Build & run in the Extension Development Host

```bash
cd extension
npm install
npm run compile      # or: npm run watch
```

Then open the `extension/` folder in VS Code and press **F5** to launch an
Extension Development Host. In that window:

- A **`$(history) FlowState`** item appears in the status bar.
- Open a folder (ideally a git repo), edit some files, run a command in the
  integrated terminal, then trigger **`FlowState: Capture Snapshot Now`**
  (status-bar click or `Ctrl+Alt+S` / `Cmd+Alt+S`).
- The daemon stores a fully-populated snapshot — verify with
  `curl "http://127.0.0.1:8420/restore?workspace=<folder-name>"`.

What the extension captures (VS Code Extension API — no OCR, no screen reads):

| Signal | Source |
|---|---|
| Active file, cursor, selection | `window.activeTextEditor` |
| Open + dirty files | `workspace.textDocuments` |
| Recent edit ranges | `workspace.onDidChangeTextDocument` (rolling buffer) |
| Terminal commands + output + exit code | Shell Integration API |
| Errors/warnings | `languages.getDiagnostics()` |

---

## Phase 3 — local inference (Ollama structured output)

`daemon/inference.py` turns a snapshot into a structured `Summary` using the
**local** Ollama server. Output is forced to valid JSON via Ollama's `format`
field (the Summary JSON schema), so we never parse freeform text.

### One-time model pull (the only network operation)

```powershell
# Ensure Ollama is running (ollama serve, or launch the app), then:
./scripts/pull-model.ps1            # pulls deepseek-r1:1.5b (the default)
```

FlowState uses **`deepseek-r1:1.5b`** — small, CPU-fast, fits a 16 GB no-GPU
laptop. It is the default; no configuration is needed.

### How it behaves

- **On-demand only** — inference runs when you call `GET /restore`, never in
  the background. `keep_alive` (default `5m`) keeps the model warm during work.
- **Reasoning models** (e.g. `deepseek-r1`) — the `<think>` block can't leak
  because decoding is grammar-constrained to JSON; any stray tags are stripped.
- **Graceful fallback** — if Ollama is down or the model is missing, `/restore`
  returns a deterministic `Summary` built directly from the snapshot (file:line,
  branch, failing command, error, tabs, uncommitted files). It's always
  specific because the snapshot already is — and it works with the network off.

```bash
curl "http://127.0.0.1:8420/restore?workspace=proj"   # -> {snapshot, summary}
curl http://127.0.0.1:8420/health                      # includes inference status
```

---

## Phase 4 — dashboard (Next.js) + rehydration

A rich **Next.js + Tailwind + Framer Motion** app: an animated landing page
(`/`) and the working dashboard (`/dashboard`). Both bind to **127.0.0.1:3000**
and talk only to the local daemon over REST + WebSocket. Fonts are self-hosted
at build time (no runtime CDN).

```powershell
./scripts/run-dashboard.ps1     # installs on first run, then http://127.0.0.1:3000
# (make sure the daemon is running too: ./scripts/run-daemon.ps1)
```

- **Landing** — hero with a live "snapshot → briefing" demo, features, how-it-
  works, and a privacy section. Pure marketing/explainer, no data.
- **Dashboard** — `RestoreCard` (the AI briefing with a **Rehydrate** button),
  `Timeline` (live-updating from `/history` via the `/ws` WebSocket),
  `SearchBar` (wired for Phase 6), and a `DaemonStatus` strip.
- **Rehydration loop** — clicking *Rehydrate* → `POST /rehydrate` → daemon pushes
  the target files over `/ext/ws` → the VS Code extension reopens them at the
  right cursor lines.

New daemon endpoints this phase: `GET /history`, `POST /rehydrate`,
`WS /ws` (dashboard push), `WS /ext/ws` (extension command channel).

> Security note: `npm audit` flags advisories in the Next.js dev toolchain.
> Because the app is bound to `127.0.0.1` and never exposed, the practical risk
> is minimal; pin/upgrade Next before any non-local deployment.

---

## Phase 5 — triggers + ambient capture

**Automatic triggers** are detected in the extension (where the reliable focus
and activity events live) and enforced against a policy served by the daemon at
`GET /config` (one authoritative place to tune it):

- `focus_loss` — the editor window is unfocused for ≥ `focus_debounce_seconds`
  (default 12s). A quick alt-tab that refocuses before the timer **does not**
  fire.
- `idle` — no editor activity for `idle_seconds` (default 300s) while focused.
- a `min_capture_interval_seconds` cooldown (default 60s) prevents snapshot spam.

Detection is event-driven (`onDidChangeWindowState` + the editor event stream) —
no polling, near-zero idle CPU.

**Ambient collector** (`daemon/capture/ambient.py`, Tier 3) fills, at capture
time only:

- the active window's **title + process name** (never its content), and
- the current **clipboard text** (truncated).

It never reads other apps' contents, never screenshots, never uses accessibility
scraping. Windows uses `pywin32`; macOS uses `pyobjc` (best-effort); anything
unavailable is simply omitted. The assembler fills Tier 3 only when the
extension didn't already supply it.

---

## Phase 6 — semantic history search

A separate "search my history" feature, deliberately isolated from restore. It
answers meaning-based questions — *"when did I last touch auth?"*, *"that session
about the CSS grid"* — over your past snapshots.

- **Vectors live ONLY here.** The restore path stays a single indexed SQL lookup
  (`hot.py`). `GET /search` is the one endpoint that reads the ChromaDB vector
  index (`daemon/storage/cold.py`); it never touches restore.
- **Embedder.** ChromaDB's default embedding function — `all-MiniLM-L6-v2` served
  through **ONNX Runtime**, the exact model the spec names but with **no PyTorch**.
  It's light and CPU-fast (fitting the 16 GB, no-GPU target; Python 3.14 has no
  torch wheels anyway). The ~80 MB model downloads once, then runs fully offline.
- **When indexing happens.** At capture (`POST /snapshot`) a compact, deterministic
  *digest* of the snapshot is embedded — no LLM involved, so capture stays cheap and
  event-driven. When you restore a session, the richer model-written briefing
  **upserts** over that same vector (one vector per snapshot, never a duplicate).
- **Offline / no telemetry.** Chroma's anonymized telemetry is disabled, so the
  daemon still makes zero outbound calls after the one-time model fetch.
- **Graceful degradation.** If `chromadb` is missing or the model can't load,
  `/search` returns an empty list and capture/restore are unaffected.

```powershell
./scripts/pull-embed.ps1     # one-time: warm/download the ONNX embedder
```

```bash
curl "http://127.0.0.1:8420/search?q=authentication%20token&k=8"
curl "http://127.0.0.1:8420/search?q=css%20layout&workspace=web"   # scope to a workspace
```

The dashboard `SearchBar` is wired to this endpoint (semantic results with a
"% match" score and timestamp). `GET /health` now reports a `search` block
(installed / available / indexed count / embed model).

---

## Phase 7 — hardening

**Ephemerality (TTL purge).** Snapshots older than `FLOWSTATE_TTL_SECONDS`
(default 7 days) are deleted from **both** stores in lockstep: the hot SQLite
store returns the ids it removed, and the cold vector index drops exactly those
(`daemon/maintenance.py`). A sleep-driven background sweeper runs it at startup
and every `FLOWSTATE_PURGE_INTERVAL_SECONDS` (default 1h) — no busy polling — and
it's also on-demand:

```bash
curl -X POST "http://127.0.0.1:8420/maintenance/purge"            # honor the TTL
curl -X POST "http://127.0.0.1:8420/maintenance/purge?ttl_seconds=0"  # purge all now
```

**Optional at-rest encryption.** Set `FLOWSTATE_ENCRYPTION_KEY` to a passphrase
and each snapshot's JSON payload is encrypted (AES via Fernet, key derived with
PBKDF2-HMAC-SHA256) before it hits disk, and decrypted on read. Unset (the
default) stores plaintext, and mixed databases just work — an unencrypted row has
no `enc:v1:` prefix. The low-sensitivity index columns (`workspace_name`, `ts`,
`headline`) stay plaintext so the restore path remains a plain indexed lookup.

> Scope: this protects the snapshot *contents* against someone reading the
> SQLite file off disk. If you need the entire database opaque (workspace names
> included), point the daemon at a **SQLCipher**-enabled SQLite build instead —
> this module is the portable, dependency-light option that also works where a
> SQLCipher wheel isn't available (e.g. Python 3.14). It is not a substitute for
> full-disk encryption. `GET /health` reports a `security` block showing whether
> at-rest encryption is active.

**Resource profile.** The daemon is event-driven; the only background work is the
sleep-driven sweeper. Measured idle on a 12-core Windows laptop:

```powershell
./scripts/profile-idle.ps1 -Seconds 15
#   Idle CPU     : ~0.02% of total (0.2% of one core)   -> well under the 5% budget
#   Memory (RSS) : ~156 MB  (FastAPI + ONNX embedder resident)
```

**Offline demo (prove it with Wi-Fi off).**

1. One-time, online: `./scripts/pull-model.ps1 deepseek-r1:1.5b` and
   `./scripts/pull-embed.ps1` (fetch the LLM and the ONNX embedder).
2. **Turn Wi-Fi off / pull the Ethernet cable.**
3. Start Ollama, then `./scripts/run-daemon.ps1` and `./scripts/run-dashboard.ps1`.
4. In VS Code (Extension Development Host), edit a file and capture (`Ctrl+Alt+S`).
5. In the dashboard: **Restore** produces a real AI briefing, **Rehydrate**
   reopens the file at the cursor, and **Search** finds the session — all with the
   network physically disconnected. `GET /health` shows `"offline": true` and
   every server bound to `127.0.0.1`.

---

## Phase 10 — Zero-Trust Cognitive Restoration (enterprise)

Phase 10 extends the editor-centric restorer into a full-day, cross-application
record for knowledge workers, while keeping the air-gapped core. Everything below
runs on `127.0.0.1`; the only thing that may ever leave the host is an opt-in
manager summary string.

- **Continuous observer** (`daemon/observer.py`) — a sleep-driven loop samples the
  active window + clipboard every `observer_interval_seconds` (default 25s) and
  stores them as `passive_snapshot`s. This is the OS-wide tier that lets the
  restorer narrate work spanning VS Code → Excel → Word. It never becomes a
  restore target and never shows in the dev timeline.
- **Interruption detection + buffer** (`daemon/interruption.py`) — the observer
  fires on OS input idle (default 2 min), a foreground switch to a meeting app
  (`meeting_apps`), or a screen lock. On a trigger it flags the passive snapshots
  in the preceding `interruption_buffer_seconds` window as `is_interruption_buffer`.
- **Cross-application restoration** — `POST /restore-context` reads the flagged
  buffer and asks the local model to connect the rapid context switches into one
  intent narrative ("what were you doing, across which tools, next step").
- **Deep Start/End-of-Day captures** — `POST /start-day` and `POST /end-day` take a
  deep workspace snapshot (git status, open files, a bounded on-disk excerpt of the
  active file tagged with its architectural role).
- **End-of-day manager report** — `POST /end-day` (or `GET /report/daily`) aggregates
  the day (start baseline → activity → end state) and generates a plain-English
  1-page report: objectives, files/components altered, cross-tool tasks, blockers.
- **Data sanitizer** (`daemon/sanitize.py`) — every captured free-text field is
  masked for emails, API keys, JWTs, bearer tokens, passwords and card-shaped
  numbers **before** it is stored or embedded. On by default (`sanitize_enabled`).
- **CPU governor** (`daemon/resource.py`) — before any local SLM synthesis, if host
  CPU is above `cpu_defer_threshold` (default 80%) generation is deferred with a
  `{"status": "deferred", ...}` response, so FlowState never fights the IDE.
- **Privacy-first cloud sync** (`daemon/report.py`) — opt-in and off by default. When
  `cloud_report_enabled` + `cloud_report_url` are set, ONLY the generated summary
  string (never a snapshot, code, or clipboard) is POSTed to a Supabase/mock endpoint.

New endpoints: `POST /start-day`, `POST /end-day`, `GET /report/daily`,
`POST /restore-context`, `GET /observer/status`, `POST /observer`. `GET /health` now
reports `sanitize`, `resource`, `observer`, and `cloud_report` blocks. The dashboard
gains a Start/End-Day + Restore-Context action bar, a live monitoring card (CPU,
active window, interruption state), a cross-application restore card, and a manager
report viewer. Regression tests live in `daemon/tests/test_phase10.py`
(`python -m daemon.tests.test_phase10`).

## Architecture (target)

```
Presentation  React + Tailwind dashboard (localhost)
      │ REST + WebSocket
Orchestration FastAPI daemon (127.0.0.1)  ── triggers · assembler · summary
      │
  ┌───┴───────────────┬──────────────────┐
Capture            Storage             Inference
VS Code ext ★      SQLite (hot)        Ollama (local)
git collector      ChromaDB (search    structured JSON
native ambient       ONLY)
      ★ = primary source of ground truth
```

The **restore path** is a single indexed SQL lookup feeding the model. Vector
search (ChromaDB) is isolated to the separate "search my history" feature and
never touches restore.

---

## Privacy guarantees

- Every server binds to `127.0.0.1` — never `0.0.0.0`.
- After a one-time Ollama model pull, the system makes **zero** outbound calls
  and runs with the network disabled.
- Snapshots are stored only in your user profile directory and auto-expire via
  a configurable TTL.

Offline-demo steps are documented in Phase 7.

---

## Configuration

Environment variables (all optional, prefix `FLOWSTATE_`):

| Var | Default | Meaning |
|-----|---------|---------|
| `FLOWSTATE_HOST` | `127.0.0.1` | Bind host (do not change to a public interface) |
| `FLOWSTATE_PORT` | `8420` | Daemon port |
| `FLOWSTATE_MODEL` | `deepseek-r1:1.5b` | Ollama model (the default is the only supported model) |
| `FLOWSTATE_TTL_SECONDS` | `604800` | Snapshot retention (7 days) |
| `FLOWSTATE_PURGE_INTERVAL_SECONDS` | `3600` | How often the TTL sweeper runs |
| `FLOWSTATE_ENCRYPTION_KEY` | _(unset)_ | Passphrase for optional at-rest encryption; plaintext if unset |
| `FLOWSTATE_DATA_DIR` | `%LOCALAPPDATA%\FlowState` | Where the SQLite DB + vector index live |
