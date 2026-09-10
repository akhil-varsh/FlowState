"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  FileCode2,
  GitBranch,
  Loader2,
  RefreshCw,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { RestoreResponse } from "@/lib/types";

export default function RestoreCard({
  data,
  loading,
  onRestore,
  onRehydrate,
  rehydrating,
}: {
  data: RestoreResponse | null;
  loading: boolean;
  onRestore: () => void;
  onRehydrate: (targets: string[]) => void;
  rehydrating: boolean;
}) {
  const summary = data?.summary ?? null;
  const snap = data?.snapshot ?? null;
  const branch = snap?.workspace.git?.branch;

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-6 shadow-card">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-flow-300">
          <Sparkles className="h-4 w-4" />
          Where you left off
        </div>
        <button
          onClick={onRestore}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {loading ? "Thinking…" : "Restore latest"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3 py-4"
          >
            <div className="h-6 w-2/3 animate-pulse rounded bg-white/5" />
            <div className="h-4 w-full animate-pulse rounded bg-white/5" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-white/5" />
            <p className="pt-2 text-xs text-slate-500">
              The local model is reading your snapshot…
            </p>
          </motion.div>
        ) : summary ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-xl font-semibold tracking-tight text-slate-50">
              {summary.headline}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {branch && (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <GitBranch className="h-3.5 w-3.5 text-pulse-400" />
                  {branch}
                </span>
              )}
              {snap?.workspace.name && (
                <span className="font-mono">{snap.workspace.name}</span>
              )}
              {snap?.timestamp && (
                <span>{new Date(snap.timestamp).toLocaleString()}</span>
              )}
            </div>

            <p className="mt-4 leading-relaxed text-slate-300">
              {summary.what_you_were_doing}
            </p>

            <div className="mt-4 rounded-xl bg-flow-500/[0.07] p-4 ring-1 ring-flow-400/20">
              <p className="text-xs font-medium uppercase tracking-wide text-flow-300">
                Next step
              </p>
              <p className="mt-1.5 flex items-start gap-2 text-slate-200">
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-flow-300" />
                {summary.next_step}
              </p>
            </div>

            {summary.open_threads.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Open threads
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {summary.open_threads.map((t, i) => (
                    <li
                      key={i}
                      className="rounded-lg bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/5"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.files_to_reopen.length > 0 && (
              <div className="mt-5 border-t border-white/5 pt-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Files to reopen
                </p>
                <div className="flex flex-wrap gap-2">
                  {summary.files_to_reopen.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-ink-700/50 px-2.5 py-1 font-mono text-xs text-slate-300 ring-1 ring-white/5"
                    >
                      <FileCode2 className="h-3.5 w-3.5 text-flow-300" />
                      {f}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => onRehydrate(summary.files_to_reopen)}
                  disabled={rehydrating}
                  className="group mt-4 inline-flex items-center gap-2 rounded-xl bg-flow-500 px-4 py-2.5 text-sm font-semibold text-ink-950 shadow-glow transition hover:bg-flow-400 disabled:opacity-60"
                >
                  {rehydrating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Undo2 className="h-4 w-4" />
                  )}
                  Rehydrate in VS Code
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8 text-center"
          >
            <p className="text-slate-400">No context to restore yet.</p>
            <p className="mt-1 text-sm text-slate-500">
              Capture a snapshot from VS Code (Ctrl+Alt+S), then restore it here.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
