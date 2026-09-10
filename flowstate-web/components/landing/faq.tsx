"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FAQS } from "@/lib/content";
import { Reveal } from "@/components/reveal";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section id="faq" className="py-[clamp(64px,9vw,116px)]">
      <div className="wrap max-w-[860px]">
        <Reveal>
          <span className="eyebrow block">Answers</span>
          <h2 className="mt-4 text-[clamp(30px,4.4vw,48px)]">Questions, answered plainly.</h2>
        </Reveal>

        <div className="mt-11 border-t border-line">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b border-line">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center gap-4 py-[22px] text-left font-display text-[19px] font-semibold tracking-tight text-ink"
                >
                  {f.q}
                  <svg
                    viewBox="0 0 24 24"
                    className={`ml-auto h-[22px] w-[22px] flex-none text-accent transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-[56em] pb-6 pr-8 text-[15.5px] leading-[1.65] text-ink-soft">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
