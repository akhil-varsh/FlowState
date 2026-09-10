import { Reveal } from "@/components/reveal";
import { Arrow } from "@/components/icons";

const NODES = [
  {
    cap: "Capture · 3 tiers",
    title: "Sources",
    rows: [
      ["T1", "VS Code: files, cursor, terminal, diagnostics"],
      ["T2", "Git: branch, dirty files, last commit"],
      ["T3", "Ambient: window title + process + clipboard only"],
    ],
  },
  {
    cap: "Assemble",
    title: "The daemon",
    rows: [
      ["API", "FastAPI on 127.0.0.1:8420"],
      ["CPU", "Event-driven, <5% idle"],
      ["AI", "Ollama · deepseek-r1:1.5b"],
    ],
  },
  {
    cap: "Store & serve",
    title: "Two stores",
    rows: [
      ["HOT", "SQLite — indexed restore path"],
      ["COLD", "ChromaDB — search only"],
      ["OUT", "Restore + rehydrate in VS Code"],
    ],
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-line bg-surface py-[clamp(64px,9vw,116px)]">
      <div className="wrap">
        <Reveal className="max-w-prose">
          <span className="eyebrow block">How it works</span>
          <h2 className="mt-4 text-[clamp(30px,4.4vw,48px)]">Three tiers in. One SQL lookup out.</h2>
          <p className="mt-[18px] max-w-[38em] text-[19px] text-ink-soft">
            A local FastAPI daemon assembles context from three ground-truth tiers, indexes it, and serves your
            last session back the instant you ask for it.
          </p>
        </Reveal>

        <Reveal className="mt-[52px]">
          <div className="grid items-stretch gap-3.5 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:gap-0">
            {NODES.map((n, i) => (
              <div key={n.title} className="contents">
                <div className="flex min-w-0 flex-col rounded-[13px] border border-line-strong bg-bg p-5 pb-[22px]">
                  <span className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">{n.cap}</span>
                  <h4 className="mb-1 text-[18px]">{n.title}</h4>
                  {n.rows.map(([t, v], r) => (
                    <div
                      key={t}
                      className={`flex items-baseline gap-2.5 py-[7px] text-[13.5px] text-ink-soft ${
                        r === 0 ? "" : "border-t border-dashed border-line"
                      }`}
                    >
                      <span className="w-[38px] flex-none font-mono text-[10.5px] text-cyan">{t}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
                {i < NODES.length - 1 && (
                  <div className="grid w-full place-items-center py-1 text-ink-faint lg:w-14 lg:py-0">
                    <Arrow className="h-[26px] w-[26px] rotate-90 lg:rotate-0" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-[26px] flex max-w-[52em] items-start gap-2.5 text-[14.5px] text-ink-faint">
            <svg viewBox="0 0 24 24" className="mt-[3px] h-[17px] w-[17px] flex-none text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
            </svg>
            <span>
              Snapshots fire on the moments that matter — focus loss (debounced 12s so a quick alt-tab is ignored),
              300s idle, or a manual <span className="font-mono">Ctrl+Alt+S</span> — never on a fixed timer hammering
              your machine.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
