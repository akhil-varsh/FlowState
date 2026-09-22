import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { CodeLine } from "@/components/copy-button";

// Public download URL for the packaged installer. Set NEXT_PUBLIC_DOWNLOAD_URL
// (e.g. a Supabase Storage public URL) to enable the direct download; when unset
// the button falls back to the install docs.
const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL ?? "";

const STEPS = [
  {
    n: "1",
    title: "Run the installer",
    body: "Download and launch FlowState-Setup.exe. It's a per-user install — no admin rights required.",
    code: "FlowState-Setup.exe",
  },
  {
    n: "2",
    title: "Pull the local model",
    body: "Install Ollama, then pull the default 1.5B model once. After this, FlowState never needs the network again.",
    code: "ollama pull deepseek-r1:1.5b",
  },
  {
    n: "3",
    title: "Work as usual",
    body: "Open your project in VS Code. FlowState captures in the background. When you come back, capture and rehydrate.",
    code: "Ctrl+Alt+S  ·  capture now",
  },
];

const REQS = [
  ["Platform", "Windows 10 / 11 · x64"],
  ["Editor", "VS Code 1.93+"],
  ["Memory", "16 GB · CPU-only OK"],
  ["Runtime", "Ollama (local)"],
  ["Network", "Only once, to pull the model"],
  ["Data", "%LOCALAPPDATA%\\FlowState"],
];

export function InstallCta() {
  return (
    <section id="install" className="border-y border-line bg-surface py-[clamp(64px,9vw,116px)]">
      <div className="wrap">
        <Reveal className="max-w-prose">
          <span className="eyebrow block">Get FlowState</span>
          <h2 className="mt-4 text-[clamp(30px,4.4vw,48px)]">Installed and capturing in three steps.</h2>
          <p className="mt-[18px] max-w-[38em] text-[19px] text-ink-soft">
            One Windows installer bundles the daemon (no Python needed), the desktop widget, and the VS Code
            extension — then registers everything to start with your session.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-[18px] md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.06}>
              <div className="h-full rounded-[14px] border border-line bg-bg px-[22px] pb-[22px] pt-6">
                <div
                  className="mb-3.5 grid h-[30px] w-[30px] place-items-center rounded-lg font-mono text-[12px] tracking-[0.1em] text-accent"
                  style={{ border: "1px solid color-mix(in srgb, var(--accent) 34%, transparent)" }}
                >
                  {s.n}
                </div>
                <h4 className="mb-1.5 text-[19px]">{s.title}</h4>
                <p className="mb-3.5 text-[14.5px] text-ink-soft">{s.body}</p>
                <CodeLine value={s.code} />
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-[34px]">
          <div className="flex flex-wrap gap-x-7 gap-y-3 rounded-[13px] border border-line bg-surface-2 px-[22px] py-5">
            {REQS.map(([k, v]) => (
              <div key={k} className="flex min-w-[140px] flex-col gap-0.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">{k}</span>
                <span className="text-[14.5px] font-medium text-ink">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {DOWNLOAD_URL ? (
              <a href={DOWNLOAD_URL} download className="btn btn-primary">
                ↓ Download for Windows · .exe
              </a>
            ) : (
              <Link href="/docs/installation" className="btn btn-primary">
                ↓ Download for Windows · .exe
              </Link>
            )}
            <Link href="/guide" className="btn btn-ghost">
              Full getting-started guide →
            </Link>
          </div>
          <p className="mt-3 text-[13px] text-ink-faint">
            Windows 10/11 · x64 · ~70 MB · per-user install (no admin). Unsigned build — if
            SmartScreen appears, choose “More info → Run anyway.”
          </p>
        </Reveal>
      </div>
    </section>
  );
}
