/**
 * Single source of truth for site content used across pages, the docs shell,
 * and tests. Keeping copy here makes the marketing site and product docs stay
 * in sync and gives the test-suite stable data to assert against.
 */

export const SITE = {
  name: "FlowState",
  tagline: "Pick up exactly where you left off.",
  version: "0.1.0",
  daemon: "127.0.0.1:8420",
  model: "deepseek-r1:1.5b",
  dataDir: "%LOCALAPPDATA%\\FlowState",
} as const;

export type NavLink = { label: string; href: string };

export const NAV_LINKS: NavLink[] = [
  { label: "Product", href: "/#features" },
  { label: "How it works", href: "/#how" },
  { label: "Docs", href: "/docs" },
  { label: "Guide", href: "/guide" },
  { label: "Privacy", href: "/privacy" },
];

export type Feature = { title: string; body: string; icon: string };

export const FEATURES: Feature[] = [
  {
    icon: "capture",
    title: "Ground-truth capture",
    body: "Open files, cursor, selection, recent edits, terminal commands with exit codes, diagnostics, and git branch — read straight from the VS Code API and git, never from your screen.",
  },
  {
    icon: "brief",
    title: "“Where you left off” briefings",
    body: "A local model (deepseek-r1) turns a snapshot into a plain-English recap of what you were doing and the obvious next step — generated on your CPU, in seconds.",
  },
  {
    icon: "rehydrate",
    title: "One-click rehydrate",
    body: "Reopen every file from the session at the exact line you left — right inside VS Code. The room is exactly as you left it before the interruption.",
  },
  {
    icon: "search",
    title: "Semantic history search",
    body: "“That afternoon I fought the websocket reconnect” finds the exact session. On-device embeddings power search only; restore stays a pure SQL lookup.",
  },
  {
    icon: "widget",
    title: "Desktop widget & kill-switch",
    body: "A small always-on card shows your last capture — with one toggle to pause recording whenever you want privacy, and resume when you don't.",
  },
  {
    icon: "lock",
    title: "Encrypted & ephemeral",
    body: "Optional at-rest encryption (Fernet + PBKDF2) on the snapshot payload, and a TTL sweeper that purges old sessions from both stores in lockstep.",
  },
];

export type Stat = { value: string; unit?: string; label: string };

export const STATS: Stat[] = [
  { value: "23", unit: "min", label: "avg. to refocus after a ping*" },
  { value: "3", label: "capture tiers, ground-truth only" },
  { value: "0", label: "bytes leave your machine" },
  { value: "<5", unit: "%", label: "idle CPU · ~156MB RSS" },
];

export type ApiRow = {
  method: "GET" | "POST";
  path: string;
  purpose: string;
};

export const API_ROWS: ApiRow[] = [
  { method: "GET", path: "/health", purpose: "Liveness + subsystem status (search, security, recording, TTL)." },
  { method: "POST", path: "/snapshot", purpose: "Store a captured session. Gated by the recording toggle." },
  { method: "GET", path: "/restore?workspace=", purpose: "The core path — one indexed SQL lookup returns the latest briefing." },
  { method: "GET", path: "/search?q=&k=&workspace=", purpose: "Semantic history search. The only vector path in the system." },
  { method: "GET", path: "/history", purpose: "Recent captures for the widget and dashboard." },
  { method: "GET", path: "/recording", purpose: "Read the recording on/off state." },
  { method: "POST", path: "/recording?enabled=", purpose: "Flip the kill-switch that gates all capture." },
  { method: "GET", path: "/config", purpose: "The live trigger policy — single source of truth for the extension." },
  { method: "POST", path: "/maintenance/purge?ttl_seconds=", purpose: "Force a TTL sweep across the hot and cold stores in lockstep." },
];

export type ConfigRow = { key: string; def: string; controls: string };

export const CONFIG_ROWS: ConfigRow[] = [
  { key: "model", def: "deepseek-r1:1.5b", controls: "The Ollama model used for briefings — the default and only supported model." },
  { key: "port", def: "8420", controls: "Loopback port for the daemon. Always bound to 127.0.0.1." },
  { key: "purge_interval_seconds", def: "3600", controls: "How often the TTL sweeper runs to expire old snapshots." },
  { key: "encryption_key", def: "(unset)", controls: "Opt-in at-rest encryption of the snapshot payload. Plaintext passthrough when unset." },
  { key: "data_dir", def: "%LOCALAPPDATA%\\FlowState", controls: "Where flowstate.db, the Chroma index, and config live." },
];

export type CliRow = { action: string; how: string; notes: string };

export const CLI_ROWS: CliRow[] = [
  { action: "Capture now", how: "Ctrl+Alt+S", notes: "Manual snapshot from VS Code, any time." },
  { action: "Rehydrate latest", how: "FlowState: Rehydrate Latest Session", notes: "Command Palette — reopens files at cursor." },
  { action: "Pause / resume", how: "Widget toggle", notes: "The bottom-right card flips recording on and off." },
  { action: "Health check", how: "curl 127.0.0.1:8420/health", notes: "Confirms the daemon and every subsystem is up." },
  { action: "Edit config", how: "%LOCALAPPDATA%\\FlowState\\config.toml", notes: "Start-menu shortcut opens it directly." },
];

export type Faq = { q: string; a: string };

export const FAQS: Faq[] = [
  {
    q: "Is FlowState only for VS Code?",
    a: "The deepest capture — files, cursor, terminal, diagnostics, one-click rehydrate — comes through the VS Code extension, because that's where ground-truth editor state lives. A lighter ambient tier notes your active window title, process name, and clipboard across the whole desktop, but never reads the contents of other apps.",
  },
  {
    q: "Does it capture my browser and which sites I visited?",
    a: "Only the window title of whatever app is in the foreground plus the process name — never the page contents, URL history, or a list of your tabs. Reading your browsing would require the kind of screen or history scraping FlowState refuses to do.",
  },
  {
    q: "“Could not reach the daemon on 127.0.0.1” — what do I do?",
    a: "The extension talks to the local daemon on port 8420. Confirm the daemon is running (curl 127.0.0.1:8420/health), that the FlowState Daemon logon task started, and that Ollama is running. After a fresh install, sign out and back in, or start it from the Start menu, then retry.",
  },
  {
    q: "Why deepseek-r1:1.5b and can I change it?",
    a: "It's the default because it fits a 16 GB, CPU-only laptop while still writing a useful briefing (warm restores land in ~20s). It's the only officially supported model, though advanced users can point FLOWSTATE_MODEL at another Ollama model.",
  },
  {
    q: "How much does it slow my machine down?",
    a: "The daemon is event-driven, not polling — measured idle at about 0.02% CPU and ~156 MB RSS, well under the <5% budget. Inference only runs when you actually restore or when a briefing is generated.",
  },
  {
    q: "Where do my snapshots live, and can I wipe them?",
    a: "In %LOCALAPPDATA%\\FlowState — the SQLite database, the Chroma index, your config, and the recording state. They auto-expire on the TTL, and uninstalling deliberately leaves the folder so nothing is lost by accident. Delete the folder to wipe everything.",
  },
];

export type DocPage = {
  slug: string;
  title: string;
  summary: string;
  href: string;
};

export const DOC_PAGES: DocPage[] = [
  { slug: "installation", title: "Installation", summary: "From installer to first rehydrate in under five minutes.", href: "/docs/installation" },
  { slug: "configuration", title: "Configuration", summary: "The full config.toml key table and environment overrides.", href: "/docs/configuration" },
  { slug: "api", title: "REST API", summary: "Every daemon endpoint on 127.0.0.1:8420, with shapes.", href: "/docs/api" },
  { slug: "cli", title: "CLI & Shortcuts", summary: "Commands, keybindings, and the widget toggle.", href: "/docs/cli" },
  { slug: "architecture", title: "Architecture", summary: "The three capture tiers, the two stores, the restore path.", href: "/docs/architecture" },
];
