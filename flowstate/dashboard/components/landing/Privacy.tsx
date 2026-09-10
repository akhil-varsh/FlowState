"use client";

import { motion } from "framer-motion";
import { WifiOff, Server, Timer, KeyRound } from "lucide-react";
import { fadeUp, stagger } from "./anim";

const GUARANTEES = [
  { icon: Server, title: "Localhost only", body: "Every server binds to 127.0.0.1. There is no inbound network surface." },
  { icon: WifiOff, title: "Zero outbound", body: "After the one-time model pull, no packet leaves the device. Run it with Wi-Fi off." },
  { icon: Timer, title: "Ephemeral by default", body: "Snapshots auto-expire on a configurable TTL. Context never accumulates into a liability." },
  { icon: KeyRound, title: "Encrypted at rest", body: "Snapshots live in your user profile, optionally encrypted with an OS-keychain key." },
];

export default function Privacy() {
  return (
    <section id="privacy" className="relative py-24">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="relative overflow-hidden rounded-3xl glass p-8 sm:p-12"
        >
          {/* pulsing offline emblem */}
          <div className="pointer-events-none absolute -right-10 -top-10 hidden sm:block">
            <div className="relative grid h-48 w-48 place-items-center">
              <span className="absolute h-24 w-24 rounded-full bg-flow-500/10 animate-pulse-ring" />
              <span className="absolute h-24 w-24 rounded-full bg-flow-500/10 animate-pulse-ring [animation-delay:1.25s]" />
              <span className="relative grid h-20 w-20 place-items-center rounded-2xl bg-ink-800 ring-1 ring-flow-400/30">
                <WifiOff className="h-8 w-8 text-flow-300" />
              </span>
            </div>
          </div>

          <motion.p variants={fadeUp} className="text-sm font-medium text-flow-300">
            Privacy is the architecture, not a setting
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Your proprietary code never touches a cloud.
          </motion.h2>

          <motion.div
            variants={stagger}
            className="mt-10 grid gap-4 sm:grid-cols-2"
          >
            {GUARANTEES.map((g) => (
              <motion.div
                key={g.title}
                variants={fadeUp}
                className="flex gap-4 rounded-2xl bg-white/[0.02] p-5 ring-1 ring-white/5"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-flow-500/10 ring-1 ring-flow-400/25">
                  <g.icon className="h-5 w-5 text-flow-300" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{g.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    {g.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
