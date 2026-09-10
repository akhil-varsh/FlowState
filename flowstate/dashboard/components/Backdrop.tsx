"use client";

import { motion } from "framer-motion";

/**
 * Ambient animated backdrop: a masked grid plus slow-drifting glow blobs.
 * Purely decorative, GPU-cheap (transform/opacity only).
 */
export default function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <motion.div
        className="absolute -top-40 left-1/4 h-[36rem] w-[36rem] rounded-full bg-flow-500/20 blur-[120px]"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-20 right-1/5 h-[30rem] w-[30rem] rounded-full bg-pulse-500/20 blur-[120px]"
        animate={{ x: [0, -50, 30, 0], y: [0, 30, 50, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-flow-400/40 to-transparent" />
    </div>
  );
}
