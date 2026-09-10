# FlowState - post-install setup, run by the installer (or by hand).
#
# Installs the VS Code extension, registers the daemon to autostart at logon,
# and starts it now. Model download (Ollama) is a separate, guided step because
# it depends on which model you choose and needs Ollama installed.
#
# Usage (InstallDir contains \daemon, \scripts, and the .vsix):
#   ./scripts/postinstall.ps1 -InstallDir "C:\Program Files\FlowState"

param(
    [string]$InstallDir = ""
)

$ErrorActionPreference = "Continue"
if (-not $InstallDir) { $InstallDir = Split-Path -Parent $PSScriptRoot }
$exe = Join-Path $InstallDir "daemon\flowstate-daemon.exe"

Write-Host "==> FlowState post-install" -ForegroundColor Cyan

# 1) Install the VS Code extension, if VS Code's CLI is available.
$vsix = Get-ChildItem -Path $InstallDir -Filter "flowstate-*.vsix" -ErrorAction SilentlyContinue | Select-Object -First 1
$code = Get-Command code -ErrorAction SilentlyContinue
if (-not $code) {
    $guess = Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\bin\code.cmd"
    if (Test-Path $guess) { $code = @{ Source = $guess } }
}
if ($vsix -and $code) {
    Write-Host "  - installing VS Code extension ($($vsix.Name))"
    & $code.Source --install-extension $vsix.FullName --force | Out-Null
} elseif ($vsix) {
    Write-Host "  - VS Code CLI not found; install the extension manually:" -ForegroundColor Yellow
    Write-Host "      code --install-extension `"$($vsix.FullName)`"" -ForegroundColor Yellow
}

# 2) Register the daemon to start at logon (runs in your session; no admin).
$reg = Join-Path $InstallDir "scripts\register-autostart.ps1"
if (Test-Path $reg) {
    Write-Host "  - registering autostart task"
    & $reg -ExePath $exe
}

# 3) Start the daemon now.
if (Test-Path $exe) {
    Write-Host "  - starting the daemon"
    Start-Process -FilePath $exe -WindowStyle Hidden
}

# 4) The desktop widget: register it to start at logon, and start it now.
$widget = Join-Path $InstallDir "widget\flowstate-widget.exe"
if (Test-Path $widget) {
    Write-Host "  - registering the desktop widget (autostart + launch)"
    $wa = New-ScheduledTaskAction -Execute $widget
    $wt = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $ws = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $wp = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName "FlowState Widget" -Action $wa -Trigger $wt `
        -Settings $ws -Principal $wp -Force | Out-Null
    Start-Process -FilePath $widget
}

Write-Host ""
Write-Host "==> Done. Last step - the local model:" -ForegroundColor Green
Write-Host "    1. Install Ollama:  https://ollama.com/download" -ForegroundColor Green
Write-Host "    2. Pull the model:  ollama pull deepseek-r1:1.5b" -ForegroundColor Green
Write-Host "    (deepseek-r1:1.5b is the default - no config change needed.)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "    Health check:  http://127.0.0.1:8420/health" -ForegroundColor DarkGray
