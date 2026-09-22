"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Copy,
  Download,
  FileText,
  ListChecks,
  Loader2,
  Wrench,
  X,
} from "lucide-react";
import { downloadDailyPdf } from "@/lib/api";
import type { DailyReport, DailyReportResponse } from "@/lib/types";

function CloudBadge({ cloud }: { cloud: Record<string, unknown> }) {
  const pushed = cloud?.pushed === true;
  const reason = (cloud?.reason as string) || (cloud?.error as string) || "";
  if (pushed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-flow-500/10 px-2.5 py-1 text-[11px] font-medium text-flow-200 ring-1 ring-flow-400/30">
        <CloudUpload className="h-3.5 w-3.5" /> Synced to manager
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-400 ring-1 ring-white/10">
      <CloudOff className="h-3.5 w-3.5" /> Local only{reason ? ` · ${reason}` : ""}
    </span>
  );
}

function Section({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <section className="mt-5">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {title}
      </h4>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-200">
              <span className="mt-2 h-1 w-1 flex-none rounded-full bg-flow-400" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">None recorded.</p>
      )}
    </section>
  );
}

export default function DayReport({
  data,
  onClose,
}: {
  data: DailyReportResponse;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const r: DailyReport | null = data.report;
  const deferred = data.status === "deferred";

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.report_markdown || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  async function downloadPdf() {
    if (!r) return;
    setPdfBusy(true);
    try {
      await downloadDailyPdf(r, data.date, data.workspace);
    } catch {
      /* download failed — daemon offline */
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-ink-900 shadow-2xl"
      >
        <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-white/10 bg-ink-900/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-flow-500/15 ring-1 ring-flow-400/30">
              <FileText className="h-4 w-4 text-flow-300" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">End-of-day report</h3>
              <p className="text-[11px] text-slate-500">
                {data.date}
                {data.workspace ? ` · ${data.workspace}` : ""} · {data.snapshots_analyzed} snapshots analyzed
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 transition hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 py-5">
          {deferred ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              {data.message ||
                "Host busy — the report was deferred. Your full-day context is preserved; try again shortly."}
            </div>
          ) : r ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <CloudBadge cloud={data.cloud} />
                <button
                  onClick={downloadPdf}
                  disabled={pdfBusy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-flow-500 px-3 py-1 text-[11px] font-semibold text-ink-950 transition hover:bg-flow-400 disabled:opacity-60"
                >
                  {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download PDF
                </button>
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-flow-400/40 hover:text-flow-200"
                >
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-flow-300" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy markdown"}
                </button>
              </div>

              <Section
                icon={<ListChecks className="h-3.5 w-3.5" />}
                title="Primary objectives tackled"
                items={r.primary_objectives}
              />
              <Section
                icon={<FileText className="h-3.5 w-3.5" />}
                title="Files & components altered"
                items={r.files_components_altered}
              />
              <Section
                icon={<Wrench className="h-3.5 w-3.5" />}
                title="Cross-tool tasks performed"
                items={r.cross_tool_tasks}
              />
              <Section
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                title="End-of-day status & blockers"
                items={r.status_and_blockers}
              />
            </>
          ) : (
            <p className="text-sm text-slate-500">No report was generated.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
