"use client";

import { motion } from "framer-motion";
import { PauseCircle, ScanLine, Undo2 } from "lucide-react";
import { fadeUp, stagger } from "./anim";

const STEPS = [
  {
    icon: PauseCircle,
    tag: "01 · Interrupt",
    title: "You get pulled away",
    body: "A meeting, a message, a switch. FlowState detects the focus loss or idle and quietly snapshots your working state — editor, terminal, diagnostics, git.",
  },
  {
    icon: ScanLine,
    tag: "02 · Return",
    title: "You come back",
    body: "The local model reads the structured snapshot and writes a precise briefing: the file, the line, the error, and the single most likely next step.",
  },
  {
    icon: Undo2,
    tag: "03 · Rehydrate",
    title: "You're instantly back in",
    body: "One click reopens every relevant file at the exact cursor position. From 23 minutes of re-orientation to a few seconds.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative py-24">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.h2
            variants={fadeUp}
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Three steps. Seconds, not minutes.
          </motion.h2>
        </motion.div>

        <div className="relative mt-16">
          {/* connecting line */}
          <div className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-flow-400/30 to-transparent lg:block" />
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="grid gap-8 lg:grid-cols-3"
          >
            {STEPS.map((s, i) => (
              <motion.div key={s.tag} variants={fadeUp} className="relative">
                <div className="relative z-10 mx-auto grid h-16 w-16 place-items-center">
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="h-16 w-16 rounded-2xl bg-ink-800 ring-1 ring-white/10" />
                  </span>
                  <span className="relative grid h-16 w-16 place-items-center rounded-2xl bg-flow-500/10 ring-1 ring-flow-400/30">
                    <s.icon className="h-7 w-7 text-flow-300" />
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="absolute -right-4 top-1/2 hidden h-2 w-2 -translate-y-1/2 rounded-full bg-flow-400/60 lg:block" />
                  )}
                </div>
                <div className="mt-6 text-center">
                  <p className="font-mono text-xs tracking-wide text-flow-300">
                    {s.tag}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-100">
                    {s.title}
                  </h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
                    {s.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
