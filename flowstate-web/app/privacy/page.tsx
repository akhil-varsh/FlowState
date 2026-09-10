import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Shield } from "@/components/icons";

export const metadata: Metadata = {
  title: "Privacy model",
  description: "FlowState's privacy isn't a setting you trust — it's how the system is built.",
};

const PROMISES = [
  {
    title: "Loopback only",
    body: "Every server binds 127.0.0.1 — never 0.0.0.0. Nothing on your network, let alone the internet, can reach it. There's no auth layer because there's no remote surface.",
  },
  {
    title: "No pixels, ever",
    body: "Capture comes from the editor's API, git, and the shell — never OCR, screenshots, or reading other apps' contents. Ambient reads only window title, process name, and clipboard.",
  },
  {
    title: "Fully offline",
    body: "After one model pull, FlowState makes zero outbound calls and sends zero telemetry. Turn off Wi-Fi and it works exactly the same.",
  },
  {
    title: "Your data, your disk",
    body: "Everything lives in %LOCALAPPDATA%\\FlowState, optionally encrypted, auto-expiring on a TTL. Uninstalling leaves your data untouched — or you delete the folder.",
  },
];

const CAPTURED = [
  "Open files, cursor position, and current selection in VS Code",
  "Recent edits and terminal commands (with exit codes) in your editor",
  "Git branch, dirty files, and last commit for the workspace",
  "Foreground window title, process name, and clipboard (ambient tier)",
];

const NEVER = [
  "Screenshots, screen recordings, or any OCR of your display",
  "The contents of other applications or which web pages you viewed",
  "Your browsing history, saved credentials, or autofill stores",
  "Anything sent to a remote server — there are no outbound calls",
];

export default function PrivacyPage() {
  return (
    <div className="wrap max-w-[880px] py-16 md:py-24">
      <Reveal>
        <span className="eyebrow block">Privacy by construction</span>
        <h1 className="mt-3 text-[clamp(34px,5vw,54px)]">These aren&apos;t settings. They&apos;re guarantees.</h1>
        <p className="mt-5 max-w-[42em] text-[19px] leading-relaxed text-ink-soft">
          FlowState&apos;s privacy isn&apos;t a toggle you have to trust — it&apos;s the way the system is built. Here
          is exactly what that means.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {PROMISES.map((p, i) => (
          <Reveal key={p.title} delay={(i % 2) * 0.06}>
            <div className="flex h-full gap-4 rounded-[13px] border border-line bg-surface p-[22px]">
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] text-cyan" style={{ background: "var(--cyan-soft)" }}>
                <Shield className="h-[19px] w-[19px]" />
              </span>
              <div>
                <h3 className="font-sans text-[16px] font-semibold text-ink">{p.title}</h3>
                <p className="mt-1.5 text-[14px] leading-[1.55] text-ink-soft">{p.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-14 grid gap-8 md:grid-cols-2">
        <Reveal>
          <h2 className="text-[24px] text-good">What FlowState captures</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {CAPTURED.map((c) => (
              <li key={c} className="flex items-start gap-3 text-[15px] leading-[1.55] text-ink-soft">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-good" />
                {c}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="text-[24px] text-ink">What it never touches</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {NEVER.map((n) => (
              <li key={n} className="flex items-start gap-3 text-[15px] leading-[1.55] text-ink-soft">
                <svg viewBox="0 0 24 24" className="mt-1 h-4 w-4 flex-none text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
                {n}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal className="mt-14">
        <div className="rounded-[14px] border border-line bg-surface-2 p-7">
          <h2 className="text-[22px]">Verify it yourself</h2>
          <p className="mt-3 max-w-[46em] text-[15.5px] leading-[1.7] text-ink-soft">
            You don&apos;t have to take our word for it. Watch the daemon&apos;s network activity — you&apos;ll see it
            reach out only to your local Ollama instance. Turn off Wi-Fi and every feature keeps working. Read the{" "}
            <Link href="/docs/architecture" className="font-medium text-accent">architecture docs</Link> to see where
            each byte comes from and where it&apos;s stored.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
