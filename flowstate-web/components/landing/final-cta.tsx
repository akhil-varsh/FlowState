import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Download } from "@/components/icons";

export function FinalCta() {
  return (
    <section
      className="relative overflow-hidden py-[clamp(72px,11vw,140px)] text-center"
      style={{ backgroundImage: "radial-gradient(55% 60% at 50% 20%, var(--accent-glow), transparent 70%)" }}
    >
      <div className="wrap">
        <Reveal>
          <span className="eyebrow">Stop losing your place</span>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mx-auto mt-[18px] max-w-[16em] text-[clamp(34px,5.5vw,62px)]">
            Your train of thought deserves a save point.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-[34em] text-[19px] text-ink-soft">
            Install once, work as you always do, and never spend twenty minutes remembering what you were doing
            again.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-wrap justify-center gap-3.5">
            <Link href="/docs/installation" className="btn btn-primary px-[22px] py-3.5 text-[16px]">
              <Download className="h-[18px] w-[18px]" />
              Download for Windows
            </Link>
            <Link href="/docs" className="btn btn-ghost px-[22px] py-3.5 text-[16px]">
              Browse the docs
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
