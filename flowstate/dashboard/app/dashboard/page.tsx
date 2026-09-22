"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Waves, Bell, X, Sunrise, Moon, RefreshCcw, Loader2, CalendarDays } from "lucide-react";
import DaemonStatus from "@/components/DaemonStatus";
import RestoreCard from "@/components/RestoreCard";
import Timeline from "@/components/Timeline";
import SearchBar from "@/components/SearchBar";
import MonitorCard from "@/components/MonitorCard";
import ContextRestoreCard from "@/components/ContextRestoreCard";
import DayReport from "@/components/DayReport";
import {
  endDay,
  getHealth,
  getHistory,
  getObserverStatus,
  getRestore,
  monthlyPdfUrl,
  rehydrate,
  restoreContext,
  setObserver,
  startDay,
} from "@/lib/api";
import { useDaemonSocket } from "@/lib/useDaemonSocket";
import type {
  DailyReportResponse,
  Health,
  HistoryItem,
  ObserverStatus,
  RestoreContextResponse,
  RestoreResponse,
} from "@/lib/types";

export default function DashboardPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [workspace, setWorkspace] = useState<string | undefined>();
  const [restore, setRestore] = useState<RestoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [rehydrating, setRehydrating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Phase 10 state.
  const [observerStatus, setObserverStatus] = useState<ObserverStatus | null>(null);
  const [ctx, setCtx] = useState<RestoreContextResponse | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [report, setReport] = useState<DailyReportResponse | null>(null);
  const [dayBusy, setDayBusy] = useState<null | "start" | "end">(null);

  const workspaces = useMemo(
    () => Array.from(new Set(history.map((h) => h.workspace_name).filter(Boolean))),
    [history]
  );

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await getHealth());
    } catch {
      setHealth(null);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await getHistory());
    } catch {
      /* daemon offline */
    }
  }, []);

  const refreshObserver = useCallback(async () => {
    try {
      setObserverStatus(await getObserverStatus());
    } catch {
      setObserverStatus(null);
    }
  }, []);

  const doRestore = useCallback(
    async (ws?: string) => {
      setLoading(true);
      try {
        setRestore(await getRestore(ws ?? workspace));
      } catch {
        setRestore(null);
      } finally {
        setLoading(false);
      }
    },
    [workspace]
  );

  // Live push: react to captures + interruptions. Single socket.
  const { connected } = useDaemonSocket((e) => {
    if (e.type === "snapshot_captured") {
      setToast(`New context captured · ${e.item?.active_file ?? e.item?.workspace_name}`);
      refreshHistory();
      refreshHealth();
    } else if (e.type === "interruption") {
      setToast(`Interruption detected · ${e.cause}`);
      refreshObserver();
    } else if (e.type === "resumed" || e.type === "observer") {
      refreshObserver();
    }
  });

  // Initial load.
  useEffect(() => {
    refreshHealth();
    refreshHistory();
    refreshObserver();
  }, [refreshHealth, refreshHistory, refreshObserver]);

  // Default workspace from most recent history once available.
  useEffect(() => {
    if (!workspace && history.length > 0) {
      setWorkspace(history[0].workspace_name || undefined);
    }
  }, [history, workspace]);

  // Poll health (10s) + observer status (3s).
  useEffect(() => {
    const t = setInterval(refreshHealth, 10000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  useEffect(() => {
    const t = setInterval(refreshObserver, 3000);
    return () => clearInterval(t);
  }, [refreshObserver]);

  async function onRehydrate(targets: string[]) {
    setRehydrating(true);
    try {
      const res = await rehydrate(targets, workspace);
      setToast(
        res.dispatched
          ? "Rehydrate sent to VS Code"
          : res.extension_connected
          ? "Extension busy — try again"
          : "No VS Code extension connected"
      );
    } catch {
      setToast("Rehydrate failed — is the daemon running?");
    } finally {
      setRehydrating(false);
    }
  }

  async function onRestoreContext() {
    setCtxLoading(true);
    try {
      setCtx(await restoreContext(workspace));
    } catch {
      setToast("Context restore failed — is the daemon running?");
    } finally {
      setCtxLoading(false);
    }
  }

  async function onStartDay() {
    setDayBusy("start");
    try {
      const r = await startDay(workspace);
      setToast(r.status === "empty" ? r.message : "Start-of-day captured");
      refreshHistory();
    } catch {
      setToast("Start-day failed — is the daemon running?");
    } finally {
      setDayBusy(null);
    }
  }

  async function onEndDay() {
    setDayBusy("end");
    try {
      const r = await endDay(workspace);
      setReport(r);
      setToast(
        r.status === "deferred" ? "Report deferred — host busy" : "End-of-day report ready"
      );
      refreshHistory();
    } catch {
      setToast("End-day failed — is the daemon running?");
    } finally {
      setDayBusy(null);
    }
  }

  async function onToggleObserver(enabled: boolean) {
    try {
      setObserverStatus(await setObserver(enabled));
      setToast(enabled ? "Monitoring resumed" : "Monitoring paused");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="relative min-h-screen bg-ink-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-flow-500/[0.06] to-transparent" />

      {/* Header */}
      <header className="relative border-b border-white/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-flow-500/15 ring-1 ring-flow-400/30">
                <Waves className="h-4 w-4 text-flow-300" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                Flow<span className="text-flow-300">State</span>
              </span>
            </Link>
            {workspaces.length > 0 && (
              <select
                value={workspace ?? ""}
                onChange={(e) => {
                  setWorkspace(e.target.value || undefined);
                  doRestore(e.target.value || undefined);
                }}
                className="rounded-lg border border-white/10 bg-ink-900/60 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-flow-400/40"
              >
                {workspaces.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            )}
          </div>
          <DaemonStatus health={health} connected={connected} />
        </div>
      </header>

      {/* Action bar */}
      <div className="relative border-b border-white/5 bg-white/[0.015]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2.5 px-5 py-3">
          <ActionButton onClick={onStartDay} busy={dayBusy === "start"} icon={<Sunrise className="h-4 w-4" />}>
            Start day
          </ActionButton>
          <ActionButton onClick={onEndDay} busy={dayBusy === "end"} icon={<Moon className="h-4 w-4" />}>
            End day
          </ActionButton>
          <ActionButton
            onClick={onRestoreContext}
            busy={ctxLoading}
            icon={<RefreshCcw className="h-4 w-4" />}
            primary
          >
            Restore context
          </ActionButton>
          <ActionButton
            onClick={() => window.open(monthlyPdfUrl(), "_blank")}
            icon={<CalendarDays className="h-4 w-4" />}
          >
            Monthly PDF
          </ActionButton>
          <p className="ml-auto hidden text-[11px] text-slate-500 sm:block">
            Everything runs on 127.0.0.1 — nothing leaves this machine.
          </p>
        </div>
      </div>

      {/* Main grid */}
      <main className="relative mx-auto grid max-w-6xl gap-5 px-5 py-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <ContextRestoreCard data={ctx} loading={ctxLoading} onRestore={onRestoreContext} />
          <RestoreCard
            data={restore}
            loading={loading}
            onRestore={() => doRestore()}
            onRehydrate={onRehydrate}
            rehydrating={rehydrating}
          />
        </div>

        <div className="space-y-5">
          <MonitorCard status={observerStatus} onToggle={onToggleObserver} />
          <SearchBar />
          <Timeline
            items={history}
            selectedId={restore?.snapshot.id}
            onSelect={(it) => {
              setWorkspace(it.workspace_name || undefined);
              doRestore(it.workspace_name || undefined);
            }}
          />
        </div>
      </main>

      {/* End-of-day report modal */}
      <AnimatePresence>
        {report && <DayReport data={report} onClose={() => setReport(null)} />}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-xl glass px-4 py-3 shadow-glow">
              <Bell className="h-4 w-4 text-flow-300" />
              <span className="text-sm text-slate-200">{toast}</span>
              <button
                onClick={() => setToast(null)}
                className="text-slate-500 transition hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({
  children,
  icon,
  onClick,
  busy,
  primary,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-60 " +
        (primary
          ? "bg-flow-500 text-ink-950 hover:bg-flow-400"
          : "border border-white/10 bg-ink-900/60 text-slate-200 hover:border-flow-400/40 hover:text-flow-100")
      }
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
