import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { CodeBlock, Callout, Code } from "@/components/docs/doc-parts";

export const metadata: Metadata = {
  title: "Getting-started guide",
  description: "A guided walkthrough from install to your first rehydrated session.",
};

const STEPS = [
  {
    n: "01",
    title: "Install FlowState",
    body: (
      <>
        <p>
          Run <Code>FlowState-Setup.exe</Code> — a per-user install, no admin needed. It sets up the daemon, the
          desktop widget, and the VS Code extension, and registers them to start at logon.
        </p>
        <p className="mt-3">
          Full details, including requirements and verification, live on the{" "}
          <Link href="/docs/installation" className="font-medium text-accent">Installation page</Link>.
        </p>
      </>
    ),
  },
  {
    n: "02",
    title: "Pull the model — once",
    body: (
      <>
        <p>
          FlowState&apos;s briefings run on a local model. Pull it a single time; after that, everything is offline.
        </p>
        <CodeBlock lang="powershell" code={`ollama pull deepseek-r1:1.5b`} />
      </>
    ),
  },
  {
    n: "03",
    title: "Sign out and back in",
    body: (
      <p>
        Autostart tasks register at install but start at logon. Sign out and in (or start FlowState from the Start
        menu) so the daemon is live. Confirm with <Code>curl 127.0.0.1:8420/health</Code>.
      </p>
    ),
  },
  {
    n: "04",
    title: "Just work",
    body: (
      <>
        <p>
          Open a project in VS Code and code as usual. FlowState captures quietly on focus loss, after 300s idle, or
          whenever you press the shortcut:
        </p>
        <CodeBlock lang="shortcut" code={`Ctrl + Alt + S`} />
        <p className="mt-3">The widget in the bottom-right shows your latest capture and lets you pause anytime.</p>
      </>
    ),
  },
  {
    n: "05",
    title: "Get interrupted (it happens)",
    body: (
      <p>
        A meeting, a Slack ping, lunch. Walk away. FlowState already has a snapshot of exactly what you were doing —
        the branch, the file, the cursor line, the command that just failed.
      </p>
    ),
  },
  {
    n: "06",
    title: "Come back and rehydrate",
    body: (
      <>
        <p>
          Read the &ldquo;where you left off&rdquo; briefing, then reopen everything at the cursor with one command:
        </p>
        <CodeBlock lang="text" code={`Command Palette → “FlowState: Rehydrate Latest Session”`} />
        <p className="mt-3">Your files reopen in order, each at the line you left. Keep typing.</p>
      </>
    ),
  },
];

export default function GuidePage() {
  return (
    <div className="wrap max-w-[820px] py-16 md:py-24">
      <Reveal>
        <span className="eyebrow block">Guide</span>
        <h1 className="mt-3 text-[clamp(34px,5vw,54px)]">From zero to rehydrated.</h1>
        <p className="mt-5 max-w-[40em] text-[19px] leading-relaxed text-ink-soft">
          A six-step walkthrough that takes you from a fresh install to picking up a real interrupted session — the
          whole loop FlowState is built around.
        </p>
      </Reveal>

      <div className="mt-14 flex flex-col">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={0.03 * (i % 3)}>
            <div className="relative flex gap-6 pb-12 last:pb-0">
              {i < STEPS.length - 1 && (
                <span aria-hidden className="absolute left-[23px] top-14 h-[calc(100%-3rem)] w-px bg-line" />
              )}
              <div className="flex-none">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-line-strong bg-surface font-mono text-[14px] font-semibold text-accent">
                  {s.n}
                </span>
              </div>
              <div className="min-w-0 pt-1.5">
                <h2 className="text-[24px]">{s.title}</h2>
                <div className="mt-3 text-[15.5px] leading-[1.7] text-ink-soft">{s.body}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-6">
        <Callout tone="note" title="That's the whole loop">
          Capture is automatic, restore is one command. Once it&apos;s installed you rarely think about FlowState —
          until the moment you come back to your desk and it hands you your train of thought.
        </Callout>
        <div className="mt-8 flex flex-wrap gap-3.5">
          <Link href="/docs" className="btn btn-primary">Read the full docs</Link>
          <Link href="/docs/api" className="btn btn-ghost">Explore the API</Link>
        </div>
      </Reveal>
    </div>
  );
}
