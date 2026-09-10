import { STATS } from "@/lib/content";

export function Stats() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="wrap">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`px-6 py-[26px] ${i < 3 ? "md:border-r border-line" : ""} ${
                i % 2 === 0 ? "border-r md:border-r" : ""
              } ${i < 2 ? "border-b md:border-b-0" : ""}`}
            >
              <div className="font-display text-[34px] font-semibold tracking-[-0.02em] tnum text-ink">
                {s.value}
                {s.unit && <span className="text-[20px]">{s.unit}</span>}
              </div>
              <div className="mt-1.5 font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-faint">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
