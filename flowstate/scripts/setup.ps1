# FlowState — one-time setup (Windows / PowerShell).
# Creates the daemon virtualenv and installs Phase 1 deps.
#
# Usage:  ./scripts/setup.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "==> Creating Python venv at $root\.venv" -ForegroundColor Cyan
python -m venv "$root\.venv"

Write-Host "==> Installing daemon dependencies" -ForegroundColor Cyan
& "$root\.venv\Scripts\python.exe" -m pip install --upgrade pip
& "$root\.venv\Scripts\python.exe" -m pip install -r "$root\daemon\requirements.txt"

Write-Host "==> Done. Start the daemon with ./scripts/run-daemon.ps1" -ForegroundColor Green
