"use client";

import { motion } from "framer-motion";
import { ArrowRight, FileCode2, GitBranch, Sparkles, TerminalSquare } from "lucide-react";

/**
 * The landing centerpiece: a stylized "interruption snapshot" transforming into
 * a "where you left off" briefing. Illustrative — mirrors the real data model.
 */
export default function DemoCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="relative grid w-full max-w-md gap-3 sm:max-w-lg"
      style={{ perspective: 1000 }}
    >
      {/* Snapshot card */}
      <div className="glass rounded-2xl p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full bg-flow-400 shadow-glow" />
            snapshot captured
          </div>
          <span className="rounded-md bg-ink-700/60 px-2 py-0.5 font-mono text-[10px] text-slate-400">
            trigger: focus_loss
          </span>
        </div>
        <div className="space-y-1.5 font-mono text-[12px] leading-relaxed">
          <Row icon={<GitBranch className="h-3.5 w-3.5 text-pulse-400" />}>
            <span className="text-slate-500">branch</span>{" "}
            <span className="text-slate-200">fix/token-refresh</span>
          </Row>
          <Row icon={<FileCode2 className="h-3.5 w-3.5 text-flow-300" />}>
            <span className="text-slate-500">active</span>{" "}
            <span className="text-slate-200">auth.py:142</span>{" "}
            <span className="text-slate-500">sel</span>{" "}
            <span className="text-flow-300">payload[&apos;exp&apos;]</span>
          </Row>
          <Row icon={<TerminalSquare className="h-3.5 w-3.5 text-rose-300" />}>
            <span className="text-rose-300/90">pytest → KeyError: &apos;exp&apos;</span>
          </Row>
        </div>
      </div>

      {/* Flowing connector */}
      <div className="relative mx-auto h-6 w-px">
        <motion.span
          className="absolute inset-0 mx-auto block w-px bg-gradient-to-b from-flow-400 to-pulse-500"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          style={{ transformOrigin: "top" }}
        />
        <motion.span
          className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-flow-300 shadow-glow"
          animate={{ y: [0, 24, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        />
      </div>

      {/* Briefing card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1 }}
        className="glass rounded-2xl p-4 shadow-card ring-1 ring-flow-400/20"
      >
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-flow-300">
          <Sparkles className="h-3.5 w-3.5" />
          where you left off
          <span className="ml-auto font-mono text-[10px] text-slate-500">
            local model · 3s
          </span>
        </div>
        <p className="text-[13px] font-semibold text-slate-100">
          Fixing JWT refresh-token expiry parsing
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
          Editing <span className="text-slate-200">refresh_token()</span> in{" "}
          <span className="text-slate-200">auth.py:142</span>;{" "}
          <span className="text-rose-300">test_refresh_expiry</span> failing with
          KeyError <span className="text-slate-200">&apos;exp&apos;</span>.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-flow-500/15 px-2.5 py-1 text-[11px] font-medium text-flow-200 ring-1 ring-flow-400/30">
            Next: check how &apos;exp&apos; is read from the payload
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}
