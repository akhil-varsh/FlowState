"use client";

import { motion } from "framer-motion";
import {
  Cpu,
  Eye,
  History,
  Lock,
  MousePointerClick,
  Gauge,
} from "lucide-react";
import { fadeUp, stagger } from "./anim";

const FEATURES = [
  {
    icon: Eye,
    title: "Ground-truth capture",
    body: "Reads the editor's own document model, the shell integration API, and git — never OCR or screenshots. It knows the exact line, not a guess from pixels.",
  },
  {
    icon: Cpu,
    title: "Local AI briefing",
    body: "A quantized model via Ollama turns your snapshot into a concise 'where you left off' summary. Structured JSON, always valid, on your CPU.",
  },
  {
    icon: Lock,
    title: "Nothing leaves the machine",
    body: "Every service binds to 127.0.0.1. After a one-time model pull, there are zero outbound calls. Demonstrable with Wi-Fi physically off.",
  },
  {
    icon: MousePointerClick,
    title: "One-click rehydrate",
    body: "Don't just read where you were — go back there. FlowState reopens the exact files at the exact cursor positions in VS Code.",
  },
  {
    icon: History,
    title: "Semantic history search",
    body: "\"When did I last touch the auth module?\" Search past sessions by meaning — the only place vectors are used, kept off the fast restore path.",
  },
  {
    icon: Gauge,
    title: "Lightweight by design",
    body: "Event-driven capture with under 5% idle CPU. Inference runs on-demand only — the model never works while you do.",
  },
];

export default function Features() {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.p variants={fadeUp} className="text-sm font-medium text-flow-300">
            Built on a single principle
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Capture ground truth. Restore understanding.
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-slate-400">
            Not another cloud assistant — an ambient, edge-AI memory for the work
            you were already doing.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="glass group rounded-2xl p-6 transition-shadow hover:shadow-glow"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-flow-500/10 ring-1 ring-flow-400/25 transition group-hover:bg-flow-500/20">
                <f.icon className="h-5 w-5 text-flow-300" />
              </span>
              <h3 className="mt-5 text-base font-semibold text-slate-100">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {f.body}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
