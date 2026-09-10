"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

type RevealProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children?: ReactNode;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "span";
};

/**
 * Scroll-triggered reveal. Fades + lifts children into view once, and collapses
 * to a static render when the viewer prefers reduced motion.
 */
export function Reveal({ children, delay = 0, y = 18, as = "div", ...props }: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  if (reduce) {
    const Tag = as;
    return <Tag {...(props as object)}>{children}</Tag>;
  }

  return (
    <MotionTag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </MotionTag>
  );
}
