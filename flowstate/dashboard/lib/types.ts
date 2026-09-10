// Mirror of the daemon's Pydantic models (daemon/models.py). Keep in sync.

export type Trigger = "focus_loss" | "idle" | "calendar" | "manual";
export type Severity = "error" | "warning" | "info";

export interface GitState {
  branch: string;
  dirty_files: string[];
  diff_summary: string;
  recent_commits: string[];
}

export interface Snapshot {
  id: string;
  timestamp: string;
  trigger: Trigger;
  workspace: {
    root: string;
    name: string;
    git?: GitState | null;
  };
  editor: {
    active_file: string;
    cursor: { line: number; col: number };
    selection: string;
    open_files: string[];
    recently_edited: string[];
  };
  terminal: {
    recent_commands: { cmd: string; exit_code: number | null; output_tail: string }[];
  };
  diagnostics: { file: string; line: number; severity: Severity; message: string }[];
  ambient: {
    active_app: string;
    clipboard_recent: string[];
    browser_tabs: string[];
  };
}

export interface Summary {
  headline: string;
  what_you_were_doing: string;
  next_step: string;
  open_threads: string[];
  files_to_reopen: string[];
}

export interface RestoreResponse {
  snapshot: Snapshot;
  summary: Summary | null;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  trigger: Trigger;
  workspace_name: string;
  headline: string;
}

export interface SearchHit {
  id: string;
  timestamp: string;
  workspace_name: string;
  summary_text: string;
  score: number;
}

export interface Health {
  status: string;
  version: string;
  model: string;
  snapshots: number;
  offline: boolean;
  inference: {
    ollama_installed: boolean;
    model: string;
    available: boolean;
    model_present?: boolean;
    error?: string;
  };
  search?: {
    chroma_installed: boolean;
    available: boolean;
    indexed?: number;
    embed_model?: string;
    error?: string;
  };
}
