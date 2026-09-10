// Ground-truth capture from the VS Code Extension API.
//
// This is Tier 1 — the editor's own document model, terminal shell-integration
// output, and the language servers' diagnostics. No screen scraping, no OCR,
// no OS window-content reads. The daemon adds git (Tier 2) and ambient (Tier 3).

import * as vscode from "vscode";
import * as path from "path";
import {
  Diagnostic,
  EditorState,
  Severity,
  Snapshot,
  TerminalCommand,
  Trigger,
} from "./types";

const MAX_RECENT_COMMANDS = 10;
const MAX_RECENT_EDIT_FILES = 10;
const MAX_OUTPUT_TAIL = 600;
const MAX_SELECTION = 400;

interface EditRange {
  min: number;
  max: number;
  touchedAt: number;
}

/**
 * Holds rolling buffers (recent edits, terminal commands) and builds a
 * Snapshot on demand. One instance lives for the extension's lifetime.
 */
export class StateCollector implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private recentEdits = new Map<string, EditRange>(); // fsPath -> range
  private recentCommands: TerminalCommand[] = [];
  private execBuffers = new Map<object, string>(); // execution -> output

  // Last file-scheme editor we saw focused. Lets us still record the code file
  // you were in even when the trigger fires while a non-text tab (an HTML
  // preview, a terminal, the Settings UI) happens to be focused.
  private lastActive?: {
    fsPath: string;
    line: number;
    col: number;
    selection: string;
  };

  constructor() {
    this.registerEditListener();
    this.registerTerminalListeners();
    this.registerActiveListener();
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  // ---- rolling buffer: recent edits -------------------------------------
  private registerEditListener(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.scheme !== "file" || e.contentChanges.length === 0) {
          return;
        }
        const key = e.document.uri.fsPath;
        let range = this.recentEdits.get(key);
        for (const change of e.contentChanges) {
          const startLine = change.range.start.line + 1; // 1-based
          const endLine = change.range.end.line + 1;
          if (!range) {
            range = { min: startLine, max: endLine, touchedAt: Date.now() };
          } else {
            range.min = Math.min(range.min, startLine);
            range.max = Math.max(range.max, endLine);
            range.touchedAt = Date.now();
          }
        }
        if (range) {
          this.recentEdits.set(key, range);
        }
        this.trimRecentEdits();
      })
    );
  }

  // ---- remember the last real code file focused --------------------------
  private registerActiveListener(): void {
    const remember = (editor?: vscode.TextEditor) => {
      if (editor && editor.document.uri.scheme === "file") {
        const pos = editor.selection.active;
        this.lastActive = {
          fsPath: editor.document.uri.fsPath,
          line: pos.line + 1,
          col: pos.character + 1,
          selection: editor.document.getText(editor.selection).slice(0, MAX_SELECTION),
        };
      }
    };
    remember(vscode.window.activeTextEditor);
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(remember),
      vscode.window.onDidChangeTextEditorSelection((e) => remember(e.textEditor))
    );
  }

  // Actual open tabs (survives VS Code releasing a document's TextDocument).
  private openTabFiles(root: string): string[] {
    const out: string[] = [];
    try {
      for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
          const input: any = tab.input;
          if (input && input.uri && input.uri.scheme === "file") {
            out.push(rel(root, input.uri.fsPath));
          }
        }
      }
    } catch {
      /* older host without tabGroups — fall back to textDocuments */
    }
    return out;
  }

  private trimRecentEdits(): void {
    if (this.recentEdits.size <= MAX_RECENT_EDIT_FILES) {
      return;
    }
    const sorted = [...this.recentEdits.entries()].sort(
      (a, b) => b[1].touchedAt - a[1].touchedAt
    );
    this.recentEdits = new Map(sorted.slice(0, MAX_RECENT_EDIT_FILES));
  }

  // ---- rolling buffer: terminal commands via Shell Integration ----------
  private registerTerminalListeners(): void {
    // Shell Integration API (VS Code 1.93+). Guarded so older hosts degrade.
    const onStart = (vscode.window as any).onDidStartTerminalShellExecution;
    const onEnd = (vscode.window as any).onDidEndTerminalShellExecution;
    if (typeof onStart !== "function" || typeof onEnd !== "function") {
      return;
    }

    this.disposables.push(
      onStart(async (e: any) => {
        try {
          const execution = e.execution;
          const stream = execution.read();
          let out = "";
          for await (const chunk of stream) {
            out += chunk;
            if (out.length > MAX_OUTPUT_TAIL * 4) {
              out = out.slice(-MAX_OUTPUT_TAIL * 4);
            }
          }
          this.execBuffers.set(execution, out);
        } catch {
          /* stream unavailable — ignore */
        }
      })
    );

    this.disposables.push(
      onEnd((e: any) => {
        const execution = e.execution;
        const cmd: string = execution?.commandLine?.value ?? "";
        if (!cmd.trim()) {
          this.execBuffers.delete(execution);
          return;
        }
        const raw = this.execBuffers.get(execution) ?? "";
        this.execBuffers.delete(execution);
        const tail = stripAnsi(raw).slice(-MAX_OUTPUT_TAIL).trim();
        this.recentCommands.push({
          cmd,
          exit_code: typeof e.exitCode === "number" ? e.exitCode : null,
          output_tail: tail,
        });
        if (this.recentCommands.length > MAX_RECENT_COMMANDS) {
          this.recentCommands = this.recentCommands.slice(-MAX_RECENT_COMMANDS);
        }
      })
    );
  }

  // ---- build the snapshot ----------------------------------------------
  buildSnapshot(trigger: Trigger): Snapshot {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const root = folder?.uri.fsPath ?? "";
    const name =
      folder?.name ??
      (root ? path.basename(root) : "unknown");

    return {
      trigger,
      workspace: { root, name, git: null }, // git filled by the daemon
      editor: this.buildEditorState(root),
      terminal: { recent_commands: [...this.recentCommands] },
      diagnostics: this.buildDiagnostics(root),
      ambient: { active_app: "", clipboard_recent: [], browser_tabs: [] },
    };
  }

  private buildEditorState(root: string): EditorState {
    const active = vscode.window.activeTextEditor;
    let active_file = "";
    let cursor = { line: 0, col: 0 };
    let selection = "";

    if (active && active.document.uri.scheme === "file") {
      active_file = rel(root, active.document.uri.fsPath);
      const pos = active.selection.active;
      cursor = { line: pos.line + 1, col: pos.character + 1 }; // 1-based
      const selText = active.document.getText(active.selection);
      selection = selText.slice(0, MAX_SELECTION);
    } else if (this.lastActive) {
      // Trigger fired while a non-text tab (preview/terminal/settings) was
      // focused — fall back to the last code file we saw you in.
      active_file = rel(root, this.lastActive.fsPath);
      cursor = { line: this.lastActive.line, col: this.lastActive.col };
      selection = this.lastActive.selection;
    }

    // Prefer real open tabs (tabGroups); union with loaded text documents.
    const open_files = dedupe([
      ...this.openTabFiles(root),
      ...vscode.workspace.textDocuments
        .filter((d) => d.uri.scheme === "file" && !d.isUntitled)
        .map((d) => rel(root, d.uri.fsPath)),
    ]);

    const recently_edited = [...this.recentEdits.entries()]
      .sort((a, b) => b[1].touchedAt - a[1].touchedAt)
      .map(([fsPath, r]) => `${rel(root, fsPath)}:${r.min}-${r.max}`);

    return {
      active_file,
      cursor,
      selection,
      open_files: dedupe(open_files),
      recently_edited,
    };
  }

  private buildDiagnostics(root: string): Diagnostic[] {
    const out: Diagnostic[] = [];
    for (const [uri, diags] of vscode.languages.getDiagnostics()) {
      if (uri.scheme !== "file") {
        continue;
      }
      for (const d of diags) {
        // Only surface errors and warnings — info/hints are noise for restore.
        if (
          d.severity !== vscode.DiagnosticSeverity.Error &&
          d.severity !== vscode.DiagnosticSeverity.Warning
        ) {
          continue;
        }
        out.push({
          file: rel(root, uri.fsPath),
          line: d.range.start.line + 1,
          severity: mapSeverity(d.severity),
          message: d.message.slice(0, 300),
        });
      }
    }
    // Errors first, cap the list to keep the snapshot compact.
    out.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
    return out.slice(0, 25);
  }
}

// ---- helpers ------------------------------------------------------------
function rel(root: string, fsPath: string): string {
  if (root && fsPath.startsWith(root)) {
    return path.relative(root, fsPath).split(path.sep).join("/");
  }
  return fsPath.split(path.sep).join("/");
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

function mapSeverity(s: vscode.DiagnosticSeverity): Severity {
  switch (s) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    default:
      return "info";
  }
}

function severityRank(s: Severity): number {
  return s === "error" ? 0 : s === "warning" ? 1 : 2;
}

function stripAnsi(s: string): string {
  // Remove ANSI escape sequences that shell output carries.
  // eslint-disable-next-line no-control-regex
  return s.replace(/\[[0-9;]*[A-Za-z]/g, "");
}
