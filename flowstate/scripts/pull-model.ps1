# FlowState — pull the local inference model (Windows / PowerShell).
#
# This is the ONE network operation FlowState performs. After this, the system
# runs fully offline. Pass a model name to override the default.
#
# Usage:
#   ./scripts/pull-model.ps1                     # pulls $env:FLOWSTATE_MODEL or the default
#   ./scripts/pull-model.ps1 deepseek-r1:1.5b    # pulls a specific model

param(
    [string]$Model = ""
)

$ErrorActionPreference = "Stop"

if (-not $Model) {
    $Model = if ($env:FLOWSTATE_MODEL) { $env:FLOWSTATE_MODEL } else { "deepseek-r1:1.5b" }
}

# Make sure Ollama is reachable.
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/version" -TimeoutSec 3 | Out-Null
} catch {
    Write-Host "Ollama server not reachable on 127.0.0.1:11434." -ForegroundColor Yellow
    Write-Host "Start it with 'ollama serve' (or launch the Ollama app), then re-run." -ForegroundColor Yellow
    exit 1
}

Write-Host "==> Pulling model '$Model' (one-time download)" -ForegroundColor Cyan
ollama pull $Model

Write-Host ""
Write-Host "==> Done. FlowState can now run fully offline with this model." -ForegroundColor Green
Write-Host "    Set FLOWSTATE_MODEL=$Model to use it (or edit daemon/config.py)." -ForegroundColor Green
