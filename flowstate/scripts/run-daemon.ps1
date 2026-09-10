# FlowState — start the daemon (Windows / PowerShell).
# Binds to 127.0.0.1 only.
#
# Usage:  ./scripts/run-daemon.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$py = "$root\.venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Host "venv not found. Run ./scripts/setup.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host "==> Starting FlowState daemon on http://127.0.0.1:8420" -ForegroundColor Cyan
Push-Location $root
try {
    & $py -m daemon.main
} finally {
    Pop-Location
}
