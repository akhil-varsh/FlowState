"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Waves, Github } from "lucide-react";

export default function Navbar() {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl glass px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-flow-500/15 ring-1 ring-flow-400/30">
            <Waves className="h-4 w-4 text-flow-300" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Flow<span className="text-flow-300">State</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
          <a href="#features" className="transition hover:text-slate-100">
            Features
          </a>
          <a href="#how" className="transition hover:text-slate-100">
            How it works
          </a>
          <a href="#privacy" className="transition hover:text-slate-100">
            Privacy
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#"
            className="hidden h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:text-slate-100 sm:grid"
            aria-label="Source"
          >
            <Github className="h-4 w-4" />
          </a>
          <Link
            href="/dashboard"
            className="rounded-lg bg-flow-500 px-4 py-2 text-sm font-medium text-ink-950 shadow-glow transition hover:bg-flow-400"
          >
            Open Dashboard
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
