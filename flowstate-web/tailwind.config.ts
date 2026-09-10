import type { Config } from "tailwindcss";

/**
 * Colors are driven by CSS custom properties defined in app/globals.css so the
 * light / dark / system themes resolve through next-themes' `class` strategy.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-tint": "var(--bg-tint)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-faint": "var(--ink-faint)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        "on-accent": "var(--on-accent)",
        cyan: "var(--cyan)",
        good: "var(--good)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        content: "1180px",
        prose: "44rem",
      },
      letterSpacing: {
        eyebrow: "0.22em",
      },
      keyframes: {
        pulse: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "pulse-slow": "pulse 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
