# FlowState - bundle the daemon into a standalone Windows executable (Phase 8).
#
# Produces dist\flowstate-daemon\flowstate-daemon.exe - a self-contained folder
# that runs WITHOUT a Python install on the target machine. chromadb + onnxruntime
# + tokenizers + pygit2 carry native pieces, so we collect them wholesale.
#
# Usage:  ./scripts/build-daemon.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root ".venv\Scripts\python.exe"

Push-Location $root
try {
    & $py -m PyInstaller `
        --noconfirm --clean `
        --name flowstate-daemon `
        --onedir --console `
        --collect-all chromadb `
        --collect-all onnxruntime `
        --collect-all tokenizers `
        --collect-all chroma_hnswlib `
        --collect-submodules pygit2 `
        --collect-data pygit2 `
        --collect-submodules uvicorn `
        --hidden-import uvicorn.loops.auto `
        --hidden-import uvicorn.protocols.http.auto `
        --hidden-import uvicorn.protocols.websockets.auto `
        --hidden-import uvicorn.lifespan.on `
        run_daemon.py
    Write-Host ""
    Write-Host "==> Built dist\flowstate-daemon\flowstate-daemon.exe" -ForegroundColor Green
} finally {
    Pop-Location
}
