"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fadeUp } from "./anim";

export default function CTA() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-4xl px-5">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="relative overflow-hidden rounded-3xl border border-flow-400/20 bg-gradient-to-b from-flow-500/10 to-transparent p-10 text-center sm:p-16"
        >
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Get back into flow.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-slate-400">
            Start the daemon, open the dashboard, and let your context restore
            itself — entirely on your machine.
          </p>
          <Link
            href="/dashboard"
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-flow-500 px-6 py-3 text-sm font-semibold text-ink-950 shadow-glow-lg transition hover:bg-flow-400"
          >
            Open the Dashboard
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
