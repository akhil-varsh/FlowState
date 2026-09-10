import Link from "next/link";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";

export function DocHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <header className="mb-10 border-b border-line pb-8">
      <span className="eyebrow block">{eyebrow}</span>
      <h1 className="mt-3 text-[clamp(30px,4.5vw,44px)]">{title}</h1>
      <p className="mt-4 max-w-[46em] text-[18px] leading-relaxed text-ink-soft">{intro}</p>
    </header>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 text-[15.5px] leading-[1.7] text-ink-soft">{children}</div>;
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-24 text-[26px] first:mt-0">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 text-[19px] text-ink">{children}</h3>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-[5px] bg-surface-2 px-1.5 py-0.5 font-mono text-[0.86em] text-ink">{children}</code>
  );
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="group relative my-2 overflow-hidden rounded-[11px] border border-line bg-bg-tint">
      {lang && (
        <span className="absolute right-11 top-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
          {lang}
        </span>
      )}
      <div className="absolute right-2.5 top-2">
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto px-[18px] py-[18px] pr-24 font-mono text-[12.5px] leading-[1.7] text-ink">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Callout({ tone = "note", title, children }: { tone?: "note" | "warn"; title: string; children: ReactNode }) {
  const accent = tone === "warn" ? "var(--accent)" : "var(--cyan)";
  return (
    <div
      className="my-2 rounded-[11px] border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 34%, var(--line))`,
        background: tone === "warn" ? "var(--accent-wash)" : "var(--cyan-soft)",
      }}
    >
      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: accent }}>
        {title}
      </p>
      <div className="text-[14.5px] leading-[1.6] text-ink">{children}</div>
    </div>
  );
}

type Col = { header: string; className?: string };

export function Table({ columns, rows }: { columns: Col[]; rows: ReactNode[][] }) {
  return (
    <div className="my-2 overflow-x-auto rounded-[12px] border border-line">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.header}
                className="whitespace-nowrap border-b border-line px-4 py-3.5 text-left font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faint"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border-b border-line px-4 py-3 align-top text-ink-soft last:border-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Verb({ method }: { method: "GET" | "POST" }) {
  const cls =
    method === "GET"
      ? { background: "var(--cyan-soft)", color: "var(--cyan)" }
      : { background: "var(--accent-wash)", color: "var(--accent)" };
  return (
    <span className="inline-block rounded-md px-2 py-1 font-mono text-[11px] font-semibold" style={cls}>
      {method}
    </span>
  );
}

export function PageNav({
  prev,
  next,
}: {
  prev?: { label: string; href: string };
  next?: { label: string; href: string };
}) {
  return (
    <nav className="mt-14 flex items-stretch justify-between gap-4 border-t border-line pt-8">
      {prev ? (
        <Link href={prev.href} className="group flex-1 rounded-[11px] border border-line bg-surface px-5 py-4 transition-colors hover:border-line-strong">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">← Previous</span>
          <span className="mt-1 block font-display text-[17px] font-semibold text-ink group-hover:text-accent">{prev.label}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link href={next.href} className="group flex-1 rounded-[11px] border border-line bg-surface px-5 py-4 text-right transition-colors hover:border-line-strong">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">Next →</span>
          <span className="mt-1 block font-display text-[17px] font-semibold text-ink group-hover:text-accent">{next.label}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}
