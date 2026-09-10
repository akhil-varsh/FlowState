"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ShieldCheck, WifiOff, Zap } from "lucide-react";
import Backdrop from "../Backdrop";
import DemoCard from "./DemoCard";
import { fadeUp, stagger } from "./anim";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-36 pb-24">
      <Backdrop />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-flow-400/25 bg-flow-500/10 px-3 py-1 text-xs font-medium text-flow-200">
              <WifiOff className="h-3.5 w-3.5" />
              Fully offline · 127.0.0.1 only · zero telemetry
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Never lose
            <br />
            your <span className="text-gradient">flow</span>.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400"
          >
            Every interruption costs ~23 minutes of rebuilding context. FlowState
            captures your working state from the tools you already use, then a{" "}
            <span className="text-slate-200">local AI</span> tells you exactly
            where you left off — and reopens your files at the cursor.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 rounded-xl bg-flow-500 px-5 py-3 text-sm font-semibold text-ink-950 shadow-glow-lg transition hover:bg-flow-400"
            >
              Open Dashboard
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.06]"
            >
              See how it works
            </a>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-400"
          >
            <Stat icon={<ShieldCheck className="h-4 w-4 text-flow-300" />} label="0% data leaves device" />
            <Stat icon={<Zap className="h-4 w-4 text-flow-300" />} label="Restore in < 3 min" />
            <Stat icon={<WifiOff className="h-4 w-4 text-flow-300" />} label="Works with Wi-Fi off" />
          </motion.div>
        </motion.div>

        <div className="flex justify-center lg:justify-end">
          <DemoCard />
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      {label}
    </span>
  );
}
