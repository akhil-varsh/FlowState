"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock, MousePointer2, Coffee, LogOut, CalendarClock } from "lucide-react";
import type { HistoryItem, Trigger } from "@/lib/types";

const TRIGGER_META: Record<Trigger, { icon: any; label: string; color: string }> = {
  manual: { icon: MousePointer2, label: "manual", color: "text-flow-300" },
  idle: { icon: Coffee, label: "idle", color: "text-amber-300" },
  focus_loss: { icon: LogOut, label: "focus loss", color: "text-pulse-400" },
  calendar: { icon: CalendarClock, label: "calendar", color: "text-rose-300" },
};

export default function Timeline({
  items,
  selectedId,
  onSelect,
}: {
  items: HistoryItem[];
  selectedId?: string;
  onSelect?: (item: HistoryItem) => void;
}) {
  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
        <Clock className="h-4 w-4 text-flow-300" />
        Timeline
        <span className="ml-auto text-xs text-slate-500">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          No snapshots captured yet.
        </p>
      ) : (
        <ol className="relative space-y-1 before:absolute before:left-[13px] before:top-1 before:h-[calc(100%-0.5rem)] before:w-px before:bg-white/8">
          <AnimatePresence initial={false}>
            {items.map((it) => {
              const meta = TRIGGER_META[it.trigger] ?? TRIGGER_META.manual;
              const Icon = meta.icon;
              const active = it.id === selectedId;
              return (
                <motion.li
                  key={it.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    onClick={() => onSelect?.(it)}
                    className={`relative flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition ${
                      active ? "bg-flow-500/10 ring-1 ring-flow-400/20" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-800 ring-1 ring-white/10 ${meta.color}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-200">
                          {it.headline || it.workspace_name || "session"}
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-500">
                          {timeAgo(it.timestamp)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className={meta.color}>{meta.label}</span>
                        <span className="font-mono">{it.workspace_name}</span>
                      </span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
