# FlowState — start the Next.js dashboard (Windows / PowerShell).
# Binds to 127.0.0.1:3000 only.
#
# Usage:  ./scripts/run-dashboard.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dash = Join-Path $root "dashboard"

if (-not (Test-Path (Join-Path $dash "node_modules"))) {
    Write-Host "==> Installing dashboard dependencies (first run)" -ForegroundColor Cyan
    Push-Location $dash
    npm install
    Pop-Location
}

Write-Host "==> Starting dashboard on http://127.0.0.1:3000" -ForegroundColor Cyan
Push-Location $dash
try {
    npm run dev
} finally {
    Pop-Location
}
