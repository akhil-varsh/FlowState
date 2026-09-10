"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Download, Shield, Arrow } from "@/components/icons";

export function Hero() {
  const reduce = useReducedMotion();

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: 0.05 } },
  };
  const item = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
      };

  return (
    <header
      className="relative overflow-hidden py-[clamp(56px,9vw,120px)]"
      style={{ backgroundImage: "var(--hero-glow)" }}
    >
      <div
        aria-hidden
        className="grid-backdrop pointer-events-none absolute inset-0"
        style={{
          maskImage: "radial-gradient(80% 70% at 50% 30%, #000, transparent 85%)",
          WebkitMaskImage: "radial-gradient(80% 70% at 50% 30%, #000, transparent 85%)",
        }}
      />

      <div className="wrap relative grid items-center gap-[clamp(32px,5vw,72px)] lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.span variants={item} className="pill">
            <span className="h-[7px] w-[7px] rounded-full bg-good shadow-[0_0_0_3px_var(--cyan-soft)]" />
            Offline · On-device · Zero telemetry
          </motion.span>

          <motion.h1 variants={item} className="mt-[22px] text-[clamp(42px,6.4vw,78px)] font-semibold leading-[1.02]">
            Pick up exactly
            <br />
            where you <span className="italic text-accent">left off</span>.
          </motion.h1>

          <motion.p variants={item} className="mt-[22px] max-w-[33em] text-[clamp(18px,2vw,21px)] text-ink-soft">
            FlowState quietly captures your real working context — open files, cursor, branch, the command you
            just ran — and when an interruption pulls you away, a local model hands you back the thread. No cloud.
            No screenshots. Just your flow, restored.
          </motion.p>

          <motion.div variants={item} className="mt-8 flex flex-wrap gap-3.5">
            <Link href="/docs/installation" className="btn btn-primary px-[22px] py-3.5 text-[16px]">
              <Download className="h-[18px] w-[18px]" />
              Download for Windows
            </Link>
            <Link href="/docs" className="btn btn-ghost px-[22px] py-3.5 text-[16px]">
              Read the docs
            </Link>
          </motion.div>

          <motion.div
            variants={item}
            className="mt-[30px] flex flex-wrap gap-x-[26px] gap-y-[18px] font-mono text-[12.5px] text-ink-faint"
          >
            <span className="inline-flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-accent" />
              Runs on 127.0.0.1 only
            </span>
            <span className="inline-flex items-center gap-2">
              <Arrow className="h-3.5 w-3.5 text-accent" />
              Ground-truth capture
            </span>
          </motion.div>
        </motion.div>

        <HeroMock reduce={!!reduce} />
      </div>
    </header>
  );
}

function HeroMock({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 26, scale: 0.98 }}
      animate={reduce ? {} : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <span className="absolute -right-2.5 top-[76px] z-10 rotate-2 rounded-lg bg-ink px-[11px] py-1.5 font-mono text-[11px] tracking-[0.08em] text-bg shadow-[var(--shadow)]">
        Ctrl+Alt+S
      </span>

      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-3">
          <span className="flex gap-1.5">
            <i className="block h-[11px] w-[11px] rounded-full bg-line-strong" />
            <i className="block h-[11px] w-[11px] rounded-full bg-line-strong" />
            <i className="block h-[11px] w-[11px] rounded-full bg-line-strong" />
          </span>
          <span className="ml-1.5 font-mono text-[12px] text-ink-faint">flowstate · where you left off</span>
          <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.1em] text-good">
            <i className="block h-1.5 w-1.5 rounded-full bg-good animate-pulse-slow" />
            CAPTURING
          </span>
        </div>

        <div className="px-[22px] pb-6 pt-[22px]">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Restored · 14 min ago</span>
          <h3 className="mt-2 text-[22px] tracking-tight">You were wiring the retry loop.</h3>

          <div
            className="mt-4 rounded-[11px] border p-4 text-[14.5px] leading-[1.55] text-ink"
            style={{ background: "var(--accent-wash)", borderColor: "color-mix(in srgb, var(--accent) 30%, var(--line))" }}
          >
            You were mid-fix on <b className="text-accent">learner/loop.py</b>: the exponential backoff wasn&apos;t
            honoring <b className="text-accent">max_retries</b>. Your last run failed with{" "}
            <b className="text-accent">ConnectionError</b> on attempt 4. Next: cap the delay and re-run{" "}
            <b className="text-accent">pytest tests/test_loop.py</b>.
          </div>

          <ul className="mt-4 flex flex-col gap-px">
            {[
              ["branch", "fix/retry-backoff"],
              ["cursor", "learner/loop.py : 88"],
              ["last cmd", "python -m pytest -k retry ✕"],
              ["open", "loop.py · client.py · test_loop.py"],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center gap-[11px] rounded-lg bg-surface-2 px-3 py-2.5 font-mono text-[12.5px]">
                <span className="w-[74px] flex-none text-cyan">{k}</span>
                <span className="truncate text-ink">{v}</span>
              </li>
            ))}
          </ul>

          <div className="mt-[18px] flex gap-2.5">
            <Link href="/docs/installation" className="btn btn-primary btn-sm flex-1 justify-center">
              Rehydrate in VS Code
            </Link>
            <Link href="/docs/api" className="btn btn-ghost btn-sm flex-1 justify-center">
              View full snapshot
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
