# FlowState — measure the daemon's idle CPU and memory (Phase 7).
#
# The design goal is an event-driven daemon that costs < 5% CPU at idle (no
# busy-polling; the only background task is a sleep-driven TTL sweeper). This
# script samples a running daemon's CPU over a window and reports the average.
#
# Usage (with the daemon already running):
#   ./scripts/profile-idle.ps1 -Seconds 20

param(
    [int]$Seconds = 20
)

$ErrorActionPreference = "Stop"

# A venv launcher can leave a lightweight parent stub alongside the real server,
# so pick the heaviest matching process (the one actually holding the app).
$proc = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -like '*daemon.main*' } |
    Sort-Object WorkingSetSize -Descending |
    Select-Object -First 1

if (-not $proc) {
    Write-Host "No running FlowState daemon found (python -m daemon.main)." -ForegroundColor Yellow
    Write-Host "Start it first: ./scripts/run-daemon.ps1" -ForegroundColor Yellow
    exit 1
}

$pid_ = [int]$proc.ProcessId
$cores = [Environment]::ProcessorCount
$p = Get-Process -Id $pid_

$cpu0 = $p.TotalProcessorTime.TotalMilliseconds
$t0 = Get-Date
Write-Host "==> Sampling daemon PID $pid_ for $Seconds s at idle ($cores logical cores)..." -ForegroundColor Cyan
Start-Sleep -Seconds $Seconds
$p.Refresh()
$cpu1 = $p.TotalProcessorTime.TotalMilliseconds
$t1 = Get-Date

$wallMs = ($t1 - $t0).TotalMilliseconds
$busyMs = $cpu1 - $cpu0
# Percentage of ONE core, then normalized across all cores for a system-wide view.
$pctOneCore = [math]::Round(($busyMs / $wallMs) * 100, 2)
$pctAllCores = [math]::Round($pctOneCore / $cores, 2)
$memMB = [math]::Round($p.WorkingSet64 / 1MB, 1)

Write-Host ""
Write-Host "  CPU busy time : $([math]::Round($busyMs)) ms over $([math]::Round($wallMs)) ms wall"
Write-Host "  Idle CPU      : $pctAllCores% of total ($pctOneCore% of one core)"
Write-Host "  Memory (RSS)  : $memMB MB"
Write-Host ""
if ($pctAllCores -lt 5) {
    Write-Host "  PASS - under the 5% idle-CPU budget." -ForegroundColor Green
} else {
    Write-Host "  OVER budget - investigate for polling loops." -ForegroundColor Yellow
}
