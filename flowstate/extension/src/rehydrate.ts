// Rehydration — reopen files at their cursor positions.
//
// Phase 2 provides the reusable open-at-cursor primitive and a command that
// rehydrates from the latest restore. Phase 4 lets the daemon drive this over
// the WebSocket after the user clicks "Rehydrate" in the dashboard.

import * as vscode from "vscode";
import { getRestore } from "./daemonClient";

/**
 * Reopen a set of targets. Each target is either "relpath" or "relpath:line"
 * (line is 1-based). Files open in order; the last one becomes active.
 */
export async function rehydrate(targets: string[]): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showWarningMessage("FlowState: no workspace folder open.");
    return;
  }

  let opened = 0;
  for (const target of targets) {
    const { file, line } = parseTarget(target);
    if (!file) {
      continue;
    }
    const abs = vscode.Uri.file(joinPath(root, file));
    try {
      const doc = await vscode.workspace.openTextDocument(abs);
      const editor = await vscode.window.showTextDocument(doc, {
        preview: false,
      });
      if (line && line > 0) {
        const pos = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(
          new vscode.Range(pos, pos),
          vscode.TextEditorRevealType.InCenter
        );
      }
      opened++;
    } catch (err) {
      console.error(`[FlowState] could not reopen ${target}:`, err);
    }
  }
  vscode.window.showInformationMessage(
    `FlowState: reopened ${opened} file${opened === 1 ? "" : "s"}.`
  );
}

/** Command handler: fetch the latest restore and rehydrate its targets. */
export async function rehydrateLatest(): Promise<void> {
  const name = vscode.workspace.workspaceFolders?.[0]?.name;
  if (!name) {
    vscode.window.showWarningMessage("FlowState: no workspace folder open.");
    return;
  }
  const restore = await getRestore(name);
  if (!restore) {
    vscode.window.showWarningMessage(
      "FlowState: no snapshot to restore (is the daemon running?)."
    );
    return;
  }
  // Prefer the model's files_to_reopen; fall back to the snapshot's open files.
  const targets: string[] =
    restore.summary?.files_to_reopen?.length
      ? restore.summary.files_to_reopen
      : restore.snapshot?.editor?.open_files ?? [];
  await rehydrate(targets);
}

function parseTarget(target: string): { file: string; line: number } {
  // Split on the LAST colon so Windows drive letters survive; but targets are
  // workspace-relative with forward slashes, so a trailing ":<n>" is the line.
  const m = target.match(/^(.*?):(\d+)$/);
  if (m) {
    return { file: m[1], line: parseInt(m[2], 10) };
  }
  return { file: target, line: 0 };
}

function joinPath(root: string, rel: string): string {
  const sep = root.includes("\\") ? "\\" : "/";
  const normalized = rel.split("/").join(sep);
  return root.endsWith(sep) ? root + normalized : root + sep + normalized;
}
