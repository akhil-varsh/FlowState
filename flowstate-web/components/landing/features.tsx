import { FEATURES } from "@/lib/content";
import { Reveal } from "@/components/reveal";
import { FeatureIcon } from "@/components/icons";

export function Features() {
  return (
    <section id="features" className="py-[clamp(64px,9vw,116px)]">
      <div className="wrap">
        <Reveal className="max-w-prose">
          <span className="eyebrow block">What it does</span>
          <h2 className="mt-4 text-[clamp(30px,4.4vw,48px)]">
            A memory for your working state — not a spy in your editor.
          </h2>
          <p className="mt-[18px] max-w-[38em] text-[19px] text-ink-soft">
            Everything FlowState knows comes from tools that already know it: the editor&apos;s own document model,
            your git repo, your shell. No OCR. No pixels. No accounts.
          </p>
        </Reveal>

        <div className="mt-[52px] grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06}>
              <article className="group h-full rounded-[14px] border border-line bg-surface px-6 pb-7 pt-[26px] transition-all duration-200 hover:-translate-y-[3px] hover:border-line-strong hover:shadow-[var(--shadow)]">
                <div
                  className="mb-4 grid h-[42px] w-[42px] place-items-center rounded-[11px] text-accent"
                  style={{
                    background: "var(--accent-wash)",
                    border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)",
                  }}
                >
                  <FeatureIcon name={f.icon} className="h-[21px] w-[21px]" />
                </div>
                <h3 className="text-[20px] tracking-tight">{f.title}</h3>
                <p className="mt-2.5 text-[15px] leading-[1.55] text-ink-soft">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
