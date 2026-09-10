import Link from "next/link";
import { Reveal } from "@/components/reveal";

const RESOURCES = [
  { title: "Quickstart", body: "From installer to your first rehydrate in under five minutes.", href: "/guide", go: "Guide" },
  { title: "REST API reference", body: "Every daemon endpoint on 127.0.0.1:8420, with shapes.", href: "/docs/api", go: "Reference" },
  { title: "Configuration", body: "The full config.toml key table and environment overrides.", href: "/docs/configuration", go: "Configure" },
  { title: "CLI & shortcuts", body: "Commands, keybindings, and the widget toggle.", href: "/docs/cli", go: "Reference" },
  { title: "Architecture", body: "The three capture tiers, the two stores, the restore path.", href: "/docs/architecture", go: "Diagram" },
  { title: "Installation", body: "The signed installer, requirements, and the model pull.", href: "/docs/installation", go: "Install" },
  { title: "Privacy model", body: "What is captured, what never is, and how to verify it.", href: "/privacy", go: "Guarantees" },
  { title: "FAQ & troubleshooting", body: "Daemon not reachable, model choice, VS Code vs. the whole OS.", href: "/#faq", go: "Answers" },
];

export function Resources() {
  return (
    <section id="docs" className="py-[clamp(64px,9vw,116px)]">
      <div className="wrap">
        <Reveal className="max-w-prose">
          <span className="eyebrow block">Resources</span>
          <h2 className="mt-4 text-[clamp(30px,4.4vw,48px)]">Documentation built to leave no room for error.</h2>
          <p className="mt-[18px] max-w-[38em] text-[19px] text-ink-soft">
            Everything you need to install, configure, script, and understand FlowState — with real endpoints, real
            config keys, and copy-ready examples. Each lives on its own page.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RESOURCES.map((r, i) => (
            <Reveal key={r.title} delay={(i % 4) * 0.05}>
              <Link
                href={r.href}
                className="flex h-full flex-col gap-2 rounded-[13px] border border-line bg-surface px-5 py-[22px] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-surface-2"
              >
                <h4 className="mt-0.5 font-sans text-[16px] font-semibold">{r.title}</h4>
                <p className="text-[13.5px] leading-[1.5] text-ink-soft">{r.body}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 font-mono text-[12px] text-accent">
                  {r.go} →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
