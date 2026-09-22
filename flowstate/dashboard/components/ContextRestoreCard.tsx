"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Layers, Loader2, Sparkles } from "lucide-react";
import type { RestoreContextResponse } from "@/lib/types";

function time(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export default function ContextRestoreCard({
  data,
  loading,
  onRestore,
}: {
  data: RestoreContextResponse | null;
  loading: boolean;
  onRestore: () => void;
}) {
  const r = data?.restoration ?? null;
  const deferred = data?.status === "deferred";
  const empty = data?.status === "empty";

  return (
    <div className="rounded-2xl glass p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-flow-500/15 ring-1 ring-flow-400/30">
            <Layers className="h-4 w-4 text-flow-300" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Cross-application restore</h2>
            <p className="text-[11px] text-slate-500">what you were doing before the interruption</p>
          </div>
        </div>
        <button
          onClick={onRestore}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-flow-500 px-3.5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-flow-400 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Restore context
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.p
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6 text-sm text-slate-400"
          >
            Reconstructing your cross-application intent from the pre-interruption buffer…
          </motion.p>
        ) : deferred ? (
          <motion.div key="deferred" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            {data?.message || "Host busy — generation deferred. Your context is preserved."}
          </motion.div>
        ) : empty ? (
          <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-sm text-slate-500">
            No recent cross-application activity captured yet. The observer records what you do across apps between interruptions.
          </motion.p>
        ) : r ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5"
          >
            <h3 className="text-lg font-semibold leading-snug text-slate-50">{r.headline}</h3>

            {r.narrative.length > 0 && (
              <ul className="mt-3 space-y-2">
                {r.narrative.map((n, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-flow-400" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            )}

            {r.tools_used.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {r.tools_used.map((t, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-white/[0.05] px-2 py-1 text-[11px] font-medium text-slate-300 ring-1 ring-white/10"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {r.next_step && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-flow-400/20 bg-flow-500/[0.06] p-3">
                <ArrowRight className="mt-0.5 h-4 w-4 flex-none text-flow-300" />
                <p className="text-sm text-slate-200">
                  <span className="font-semibold text-flow-200">Next: </span>
                  {r.next_step}
                </p>
              </div>
            )}

            {data && data.events.length > 0 && (
              <details className="mt-5 group">
                <summary className="cursor-pointer list-none text-xs font-medium text-slate-400 transition hover:text-slate-200">
                  Activity timeline · {data.events.length} events
                </summary>
                <ol className="mt-3 space-y-2 border-l border-white/10 pl-4">
                  {data.events.map((e, i) => (
                    <li key={i} className="relative text-xs text-slate-400">
                      <span className="absolute -left-[21px] top-1 h-1.5 w-1.5 rounded-full bg-white/25" />
                      <span className="font-mono text-slate-500">{time(e.timestamp)}</span>{" "}
                      <span className="text-slate-300">{e.app || "activity"}</span>
                      {e.foreground_seconds ? (
                        <span className="text-slate-600"> · {Math.round(e.foreground_seconds)}s</span>
                      ) : null}
                      {e.detail ? <span className="text-slate-500"> · {e.detail}</span> : null}
                      {e.clipboard ? (
                        <span className="block truncate pl-2 text-slate-600">“{e.clipboard}”</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </motion.div>
        ) : (
          <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-sm text-slate-500">
            Returned from a meeting or a break? Click <span className="text-slate-300">Restore context</span> to reconstruct
            what you were doing across every app.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
