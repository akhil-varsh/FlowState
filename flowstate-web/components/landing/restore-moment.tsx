import { Reveal } from "@/components/reveal";
import { Check } from "@/components/icons";

const POINTS = [
  ["Read the briefing.", "A two-line recap of what you were doing and what's next — no re-reading your own diff to remember."],
  ["Hit rehydrate.", "Every file reopens at its cursor line, in order — from the dashboard, the widget, or the command palette."],
  ["Keep typing.", "The failing test, the open branch, the half-written function — all exactly where you left them."],
];

export function RestoreMoment() {
  return (
    <section className="py-[clamp(64px,9vw,116px)]">
      <div className="wrap grid items-center gap-[clamp(32px,5vw,64px)] lg:grid-cols-2">
        <Reveal>
          <span className="eyebrow block">The moment that matters</span>
          <h2 className="mt-4 text-[clamp(28px,4vw,44px)]">The interruption is the enemy. Rehydration is the cure.</h2>
          <ul className="mt-[26px] flex flex-col gap-4">
            {POINTS.map(([b, s]) => (
              <li key={b} className="flex items-start gap-3.5">
                <span
                  className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-accent"
                  style={{ background: "var(--accent-wash)" }}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-[15px] text-ink-soft">
                  <b className="font-semibold text-ink">{b}</b> {s}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow)]">
            <div className="flex items-center gap-[7px] border-b border-line bg-surface-2 px-[15px] py-[11px]">
              <i className="block h-2.5 w-2.5 rounded-full bg-line-strong" />
              <i className="block h-2.5 w-2.5 rounded-full bg-line-strong" />
              <i className="block h-2.5 w-2.5 rounded-full bg-line-strong" />
              <span className="ml-2 font-mono text-[11.5px] text-ink-faint">powershell — flowstate</span>
            </div>
            <pre className="overflow-x-auto px-[18px] py-[18px] font-mono text-[13px] leading-[1.7]">
              <code>
                <span className="text-ink-faint"># You just got back. Ask FlowState where you were.</span>
                {"\n"}
                <span className="text-accent">PS&gt;</span> <span className="text-ink">curl 127.0.0.1:8420/restore?workspace=MP</span>
                {"\n\n"}
                <span className="text-cyan">{"{"}</span>
                {"\n  "}
                <span className="text-good">&quot;summary&quot;</span>: {"{"}
                {"\n    "}
                <span className="text-good">&quot;headline&quot;</span>: <span className="text-ink">&quot;Fixing retry backoff in loop.py&quot;</span>,
                {"\n    "}
                <span className="text-good">&quot;next_step&quot;</span>: <span className="text-ink">&quot;Cap delay at max_retries, re-run tests&quot;</span>,
                {"\n    "}
                <span className="text-good">&quot;files_to_reopen&quot;</span>: [<span className="text-ink">&quot;learner/loop.py:88&quot;</span>]
                {"\n  "}
                {"}"},
                {"\n  "}
                <span className="text-good">&quot;branch&quot;</span>: <span className="text-ink">&quot;fix/retry-backoff&quot;</span>,
                {"\n  "}
                <span className="text-good">&quot;captured&quot;</span>: <span className="text-ink">&quot;14m ago&quot;</span>
                {"\n"}
                <span className="text-cyan">{"}"}</span>
                {"\n\n"}
                <span className="text-accent">PS&gt;</span> <span className="text-ink-faint"># “FlowState: Rehydrate Latest Session”</span>
                {"\n"}
                <span className="text-good">✓ reopened 3 files at cursor.</span>
              </code>
            </pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
