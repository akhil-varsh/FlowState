; FlowState - Windows installer definition (Inno Setup 6).
;
; Build the installer:
;   winget install JRSoftware.InnoSetup        ; one-time, if needed
;   ./scripts/build-daemon.ps1                  ; produces dist\flowstate-daemon\
;   (cd extension && npx @vscode/vsce package)  ; produces extension\flowstate-0.1.0.vsix
;   iscc installer\flowstate.iss                ; produces installer\Output\FlowState-Setup.exe
;
; The result is a single Setup.exe that: installs the bundled daemon (no Python
; needed), installs the VS Code extension, registers the daemon to autostart at
; logon in the user's session, and starts it. Snapshots live per-user in
; %LOCALAPPDATA%\FlowState and are left alone on uninstall.

#define AppName "FlowState"
#define AppVersion "0.1.0"
#define AppPublisher "FlowState"
#define DaemonExe "flowstate-daemon.exe"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=FlowState-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Per-user install needs no admin; ambient capture requires the user session anyway.
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
; The bundled daemon (PyInstaller onedir output).
Source: "..\dist\flowstate-daemon\*"; DestDir: "{app}\daemon"; Flags: recursesubdirs createallsubdirs ignoreversion
; The desktop widget (PyInstaller onedir output).
Source: "..\dist\flowstate-widget\*"; DestDir: "{app}\widget"; Flags: recursesubdirs createallsubdirs ignoreversion
; The packaged VS Code extension.
Source: "..\extension\flowstate-{#AppVersion}.vsix"; DestDir: "{app}"; Flags: ignoreversion
; Setup / teardown scripts.
Source: "..\scripts\postinstall.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\scripts\register-autostart.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\scripts\uninstall-hooks.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Icons]
Name: "{group}\FlowState widget"; Filename: "{app}\widget\flowstate-widget.exe"
Name: "{group}\FlowState health check"; Filename: "http://127.0.0.1:8420/health"
Name: "{group}\Edit FlowState config"; Filename: "{localappdata}\FlowState\config.toml"
Name: "{group}\Uninstall FlowState"; Filename: "{uninstallexe}"

[Run]
; Install the VS Code extension, register autostart, and start the daemon.
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\postinstall.ps1"" -InstallDir ""{app}"""; \
  StatusMsg: "Setting up FlowState (extension, autostart, daemon)..."; \
  Flags: runhidden waituntilterminated

[UninstallRun]
; Stop the daemon and remove the autostart task (keeps user data).
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\uninstall-hooks.ps1"""; \
  Flags: runhidden waituntilterminated; RunOnceId: "FlowStateHooks"

[Messages]
FinishedLabel=FlowState is installed and running on 127.0.0.1:8420.%n%nLast step: install Ollama (https://ollama.com/download) and run "ollama pull deepseek-r1:1.5b". That is the default model - no config change needed.
