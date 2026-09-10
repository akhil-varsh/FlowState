import Link from "next/link";
import { SITE } from "@/lib/content";
import { Logo } from "./icons";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how" },
      { label: "Download", href: "/docs/installation" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
  {
    title: "Docs",
    links: [
      { label: "Installation", href: "/docs/installation" },
      { label: "REST API", href: "/docs/api" },
      { label: "Configuration", href: "/docs/configuration" },
      { label: "Architecture", href: "/docs/architecture" },
    ],
  },
  {
    title: "More",
    links: [
      { label: "Getting-started guide", href: "/guide" },
      { label: "CLI & shortcuts", href: "/docs/cli" },
      { label: "FAQ", href: "/#faq" },
      { label: "Privacy model", href: "/privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface pb-10 pt-[52px]">
      <div className="wrap">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
              <Logo className="h-[22px] w-[22px]" />
              {SITE.name}
            </Link>
            <p className="mt-3.5 max-w-[26em] text-[14px] leading-relaxed text-ink-soft">
              A privacy-first, fully-offline context-restorer for developers. Your working state, remembered
              locally — and handed back the moment you return.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h5 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                {col.title}
              </h5>
              <ul className="flex flex-col gap-[11px]">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-[14.5px] text-ink-soft transition-colors hover:text-accent">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[13px] text-ink-faint">
          <span className="font-mono text-[12px]">
            {SITE.name} v{SITE.version} · runs on {SITE.daemon}
          </span>
          <span>Built for focus. Runs entirely on your machine.</span>
        </div>
      </div>
    </footer>
  );
}
