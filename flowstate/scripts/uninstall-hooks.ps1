# FlowState - undo the system changes made at install (run by the uninstaller).
#
# Stops the daemon, removes the autostart task, and optionally uninstalls the
# VS Code extension. Leaves your data (%LOCALAPPDATA%\FlowState) untouched.
#
# Usage:
#   ./scripts/uninstall-hooks.ps1                 # stop + unregister autostart
#   ./scripts/uninstall-hooks.ps1 -RemoveExtension  # also uninstall the VS Code ext

param(
    [switch]$RemoveExtension
)

$ErrorActionPreference = "Continue"

# Stop the running daemon and widget.
foreach ($n in @('flowstate-daemon.exe', 'flowstate-widget.exe')) {
    Get-CimInstance Win32_Process -Filter "Name='$n'" -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

# Remove the autostart tasks.
foreach ($task in @('FlowState Daemon', 'FlowState Widget')) {
    if (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $task -Confirm:$false
        Write-Host "Removed autostart task: $task"
    }
}

if ($RemoveExtension) {
    $code = Get-Command code -ErrorAction SilentlyContinue
    if (-not $code) {
        $guess = Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\bin\code.cmd"
        if (Test-Path $guess) { $code = @{ Source = $guess } }
    }
    if ($code) {
        & $code.Source --uninstall-extension random-state.flowstate | Out-Null
        Write-Host "Uninstalled the VS Code extension."
    }
}

Write-Host "FlowState system hooks removed. Your snapshots in %LOCALAPPDATA%\FlowState were kept."
