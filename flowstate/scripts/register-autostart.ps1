# FlowState - register (or remove) the daemon as a per-user autostart task.
#
# Why a Scheduled Task and not a Windows service: a true service runs in session 0
# and CANNOT see your foreground window, which would silently break Tier-3 ambient
# capture (active window title + clipboard). A logon-triggered task runs in YOUR
# interactive session, so ambient capture keeps working. It also needs no admin.
#
# Usage:
#   ./scripts/register-autostart.ps1                 # register, autodetect the exe
#   ./scripts/register-autostart.ps1 -ExePath "C:\Program Files\FlowState\daemon\flowstate-daemon.exe"
#   ./scripts/register-autostart.ps1 -Remove         # unregister

param(
    [string]$ExePath = "",
    [switch]$Remove
)

$ErrorActionPreference = "Stop"
$taskName = "FlowState Daemon"

if ($Remove) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "==> Removed autostart task '$taskName'." -ForegroundColor Green
    } else {
        Write-Host "No autostart task '$taskName' found."
    }
    return
}

if (-not $ExePath) {
    $root = Split-Path -Parent $PSScriptRoot
    $ExePath = Join-Path $root "dist\flowstate-daemon\flowstate-daemon.exe"
}
if (-not (Test-Path $ExePath)) {
    Write-Host "Daemon exe not found at: $ExePath" -ForegroundColor Yellow
    Write-Host "Build it first (./scripts/build-daemon.ps1) or pass -ExePath." -ForegroundColor Yellow
    exit 1
}

# Launch the console exe hidden so no window flashes at logon. PowerShell starts
# it detached and exits; the daemon keeps running in the user session.
$launch = "Start-Process -FilePath '$ExePath' -WindowStyle Hidden"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -Command `"$launch`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
# Interactive, non-elevated: runs in the user's own session (required for ambient).
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "==> Registered '$taskName' to start the FlowState daemon at logon." -ForegroundColor Green
Write-Host "    Runs: $ExePath" -ForegroundColor Green
Write-Host "    Start it now without logging out:  Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor DarkGray
