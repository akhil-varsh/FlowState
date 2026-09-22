// Mirror of the daemon's Pydantic models (daemon/models.py). Keep in sync.

export type Trigger =
  | "focus_loss"
  | "idle"
  | "calendar"
  | "manual"
  | "passive"
  | "meeting"
  | "screen_lock";
export type Severity = "error" | "warning" | "info";
export type EventType =
  | "snapshot"
  | "passive_snapshot"
  | "start_of_day"
  | "end_of_day";

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
    active_file_excerpt?: string;
    file_role?: string;
  };
  terminal: {
    recent_commands: { cmd: string; exit_code: number | null; output_tail: string }[];
  };
  diagnostics: { file: string; line: number; severity: Severity; message: string }[];
  ambient: {
    active_app: string;
    clipboard_recent: string[];
    browser_tabs: string[];
    foreground_seconds?: number;
  };
  event_type?: EventType;
  is_interruption_buffer?: boolean;
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
  recording?: boolean;
  ttl_seconds?: number;
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
  sanitize?: { sanitize_enabled: boolean };
  resource?: { psutil_installed: boolean; cpu_percent: number; defer_threshold: number };
  observer?: { enabled: boolean; interval: number };
  cloud_report?: {
    cloud_report_enabled: boolean;
    configured: boolean;
    requests_installed: boolean;
  };
}

// --- Phase 10 -------------------------------------------------------------
export interface ObserverStatus {
  observer_enabled: boolean;
  recording: boolean;
  cpu_percent: number;
  cpu_deferring: boolean;
  active_app: string;
  idle_seconds: number;
  screen_locked: boolean;
  interruption_active: boolean;
  interruption_at: string | null;
  interruption_cause: string;
  last_observation_at: string | null;
  observations_today: number;
}

export interface ContextRestoration {
  headline: string;
  narrative: string[];
  tools_used: string[];
  next_step: string;
}

export interface ActivityEvent {
  timestamp: string;
  app: string;
  clipboard: string;
  detail: string;
  foreground_seconds: number;
}

export interface RestoreContextResponse {
  status: "ok" | "deferred" | "empty";
  message: string;
  interruption_at: string | null;
  restoration: ContextRestoration | null;
  events: ActivityEvent[];
  cpu_percent: number;
}

export interface DailyReport {
  primary_objectives: string[];
  files_components_altered: string[];
  cross_tool_tasks: string[];
  status_and_blockers: string[];
}

export interface DailyReportResponse {
  status: "ok" | "deferred";
  message: string;
  date: string;
  workspace: string;
  snapshots_analyzed: number;
  report: DailyReport | null;
  report_markdown: string;
  cloud: Record<string, unknown>;
  cpu_percent: number;
}

export interface DeepCaptureResponse {
  status: string;
  event_type: EventType;
  snapshot: Snapshot | null;
  message: string;
}
