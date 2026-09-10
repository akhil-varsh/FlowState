# FlowState — pre-download the semantic-search embedding model (Phase 6).
#
# History search uses all-MiniLM-L6-v2 via ONNX Runtime (ChromaDB's default
# embedder — no PyTorch). The ~80 MB model downloads once; after that, search
# runs fully offline. Running this ahead of time means the first search isn't
# slowed by the download. This is a one-time network operation, like the model pull.
#
# Usage:
#   ./scripts/pull-embed.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

Write-Host "==> Warming the ONNX all-MiniLM-L6-v2 embedder (one-time download)" -ForegroundColor Cyan

& $py -c @"
from chromadb.utils import embedding_functions
ef = embedding_functions.DefaultEmbeddingFunction()
v = ef(['flowstate embedding warmup'])
print(f'    embedder ready ({len(v[0])} dims)')
"@

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to load the embedder. Is chromadb installed (./scripts/setup.ps1)?" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "==> Done. Semantic history search now runs fully offline." -ForegroundColor Green
