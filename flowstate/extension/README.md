# FlowState (VS Code extension)

Ground-truth context capture and restoration for interrupted work — **fully
local, fully offline**.

This extension is the capture surface of FlowState. It reads your
working state directly from the VS Code Extension API — active file and cursor,
open/dirty files, recent edits, terminal commands, and diagnostics — and sends a
compact snapshot to the local FlowState daemon on `127.0.0.1`. It never uses OCR
or screen scraping, and it talks only to your machine.

## What it does

- **Automatic capture** on interruption: a debounced focus-loss trigger (a quick
  alt-tab is ignored) and an idle trigger, with a cooldown to avoid spam.
- **Manual capture**: `Ctrl+Alt+S` (`Cmd+Alt+S` on macOS), or the **FlowState**
  status-bar item.
- **Rehydration**: reopens the files from a session at their exact cursor lines,
  either from the command palette or driven by the dashboard's *Rehydrate* button.

## Requirements

The FlowState daemon must be running locally (installed separately). By default
the extension talks to `http://127.0.0.1:8420`.

## Settings

| Setting | Default | Description |
|---|---|---|
| `flowstate.daemonUrl` | `http://127.0.0.1:8420` | URL of the local daemon (localhost only). |

## Commands

- **FlowState: Capture Snapshot Now** — capture the current session.
- **FlowState: Rehydrate Latest Session** — reopen the last session's files.
