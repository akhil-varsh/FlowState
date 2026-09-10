"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { NAV_LINKS, SITE } from "@/lib/content";
import { Logo } from "./icons";
import { ThemeToggle } from "./theme-toggle";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`sticky top-0 z-50 border-b backdrop-blur-md transition-colors ${
        scrolled ? "border-line bg-bg/80" : "border-transparent bg-bg/40"
      }`}
    >
      <nav className="wrap flex h-16 items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
          <Logo className="h-[22px] w-[22px]" />
          {SITE.name}
        </Link>

        <div className="ml-3.5 hidden gap-[26px] md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[14.5px] text-ink-soft transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Link href="/docs/installation" className="btn btn-primary btn-sm hidden sm:inline-flex">
            Download
          </Link>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-[38px] w-[38px] place-items-center rounded-[9px] border border-line-strong text-ink-soft md:hidden"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-line bg-bg px-7 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-[15px] text-ink-soft hover:bg-surface-2 hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/docs/installation" onClick={() => setOpen(false)} className="btn btn-primary btn-sm mt-2 justify-center">
              Download
            </Link>
          </div>
        </div>
      )}
    </motion.header>
  );
}
