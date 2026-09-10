"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_PAGES } from "@/lib/content";

const SECTIONS = [
  {
    title: "Getting started",
    links: [
      { label: "Overview", href: "/docs" },
      { label: "Installation", href: "/docs/installation" },
      { label: "Getting-started guide", href: "/guide" },
    ],
  },
  {
    title: "Reference",
    links: [
      { label: "Configuration", href: "/docs/configuration" },
      { label: "REST API", href: "/docs/api" },
      { label: "CLI & shortcuts", href: "/docs/cli" },
    ],
  },
  {
    title: "Concepts",
    links: [
      { label: "Architecture", href: "/docs/architecture" },
      { label: "Privacy model", href: "/privacy" },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-7">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h4 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{section.title}</h4>
          <ul className="flex flex-col gap-0.5">
            {section.links.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 text-[14px] transition-colors ${
                      active
                        ? "bg-accent/10 font-medium text-accent"
                        : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                    }`}
                    style={active ? { background: "var(--accent-wash)" } : undefined}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
        {DOC_PAGES.length} reference pages · v0.1.0
      </p>
    </nav>
  );
}
