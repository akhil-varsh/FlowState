// TypeScript mirror of the daemon's Pydantic models (daemon/models.py).
// Keep these in sync in spirit with the backend. The dashboard mirrors the
// Summary / Snapshot shapes too (dashboard/src/types.ts).

export type Trigger = "focus_loss" | "idle" | "calendar" | "manual";
export type Severity = "error" | "warning" | "info";

export interface GitState {
  branch: string;
  dirty_files: string[];
  diff_summary: string;
  recent_commits: string[];
}

export interface Workspace {
  root: string;
  name: string;
  git?: GitState | null;
}

export interface Cursor {
  line: number;
  col: number;
}

export interface EditorState {
  active_file: string;
  cursor: Cursor;
  selection: string;
  open_files: string[];
  recently_edited: string[]; // e.g. "auth.py:130-145"
}

export interface TerminalCommand {
  cmd: string;
  exit_code: number | null;
  output_tail: string;
}

export interface TerminalState {
  recent_commands: TerminalCommand[];
}

export interface Diagnostic {
  file: string;
  line: number;
  severity: Severity;
  message: string;
}

export interface AmbientState {
  active_app: string;
  clipboard_recent: string[];
  browser_tabs: string[];
}

export interface Snapshot {
  id?: string; // daemon assigns if omitted
  timestamp?: string; // ISO-8601; daemon assigns if omitted
  trigger: Trigger;
  workspace: Workspace;
  editor: EditorState;
  terminal: TerminalState;
  diagnostics: Diagnostic[];
  ambient: AmbientState;
}

export interface Summary {
  headline: string;
  what_you_were_doing: string;
  next_step: string;
  open_threads: string[];
  files_to_reopen: string[];
}
