"use client";

import {
  Activity,
  AppWindow,
  Coffee,
  Cpu,
  Lock,
  Pause,
  Play,
  Video,
} from "lucide-react";
import type { ObserverStatus } from "@/lib/types";

const CAUSE: Record<string, { label: string; icon: React.ReactNode }> = {
  idle: { label: "Stepped away (idle)", icon: <Coffee className="h-4 w-4" /> },
  meeting: { label: "In a meeting", icon: <Video className="h-4 w-4" /> },
  screen_lock: { label: "Screen locked", icon: <Lock className="h-4 w-4" /> },
};

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function MonitorCard({
  status,
  onToggle,
}: {
  status: ObserverStatus | null;
  onToggle: (enabled: boolean) => void;
}) {
  const s = status;
  const cpu = Math.round(s?.cpu_percent ?? 0);
  const cpuTone =
    cpu >= 80 ? "bg-red-400" : cpu >= 50 ? "bg-amber-400" : "bg-flow-400";
  const monitoring = !!s?.observer_enabled && !!s?.recording;
  const interrupted = !!s?.interruption_active;
  const cause = s?.interruption_cause
    ? CAUSE[s.interruption_cause] ?? { label: "Interrupted", icon: <Activity className="h-4 w-4" /> }
    : null;

  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`relative grid h-6 w-6 place-items-center rounded-lg ${
              monitoring ? "bg-flow-500/15 ring-1 ring-flow-400/30" : "bg-white/5 ring-1 ring-white/10"
            }`}
          >
            <Activity className={`h-3.5 w-3.5 ${monitoring ? "text-flow-300" : "text-slate-500"}`} />
            {monitoring && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-flow-400" />
            )}
          </span>
          <h3 className="text-sm font-semibold text-slate-200">Live monitoring</h3>
        </div>
        <button
          onClick={() => onToggle(!s?.observer_enabled)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 px-2.5 py-1 text-xs text-slate-300 transition hover:border-flow-400/40 hover:text-flow-200"
        >
          {s?.observer_enabled ? (
            <>
              <Pause className="h-3.5 w-3.5" /> Pause
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Resume
            </>
          )}
        </button>
      </div>

      {interrupted && cause && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-amber-200">
          {cause.icon}
          <span className="text-sm font-medium">{cause.label}</span>
          <span className="ml-auto text-xs text-amber-300/70">{ago(s?.interruption_at ?? null)}</span>
        </div>
      )}

      {/* CPU governor */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" /> Host CPU
          </span>
          <span className="tabular-nums text-slate-300">
            {cpu}%{s?.cpu_deferring ? " · deferring" : ""}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${cpuTone}`}
            style={{ width: `${Math.min(100, cpu)}%` }}
          />
        </div>
        {s?.cpu_deferring && (
          <p className="mt-1 text-[11px] text-amber-300/80">
            Host busy — AI synthesis is deferred. Context is still being preserved.
          </p>
        )}
      </div>

      {/* Facts */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <Row icon={<AppWindow className="h-3.5 w-3.5" />} label="Active window">
          <span className="truncate">{s?.active_app || "—"}</span>
        </Row>
        <Row icon={<Coffee className="h-3.5 w-3.5" />} label="Idle">
          {s ? `${Math.round(s.idle_seconds)}s` : "—"}
        </Row>
        <Row icon={<Activity className="h-3.5 w-3.5" />} label="Samples today">
          <span className="tabular-nums">{s?.observations_today ?? 0}</span>
        </Row>
        <Row icon={<Cpu className="h-3.5 w-3.5" />} label="Status">
          {monitoring ? (
            <span className="text-flow-300">observing</span>
          ) : (
            <span className="text-slate-500">paused</span>
          )}
        </Row>
      </dl>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-medium text-slate-200">{children}</dd>
    </div>
  );
}
