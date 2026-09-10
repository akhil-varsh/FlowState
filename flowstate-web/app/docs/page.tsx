import type { Metadata } from "next";
import Link from "next/link";
import { DOC_PAGES, SITE } from "@/lib/content";
import { DocHeader, Prose, H2, Code, PageNav } from "@/components/docs/doc-parts";

export const metadata: Metadata = {
  title: "Overview",
  description: "Start here — what FlowState is and where to go in the docs.",
};

export default function DocsOverview() {
  return (
    <>
      <DocHeader
        eyebrow="Documentation"
        title="FlowState documentation"
        intro="FlowState is a privacy-first, fully-offline context-restorer for developers. It captures your real working state locally and hands it back the moment you return to your desk. These docs cover everything from install to the REST API."
      />

      <Prose>
        <H2 id="what">What it is</H2>
        <p>
          FlowState runs a small local daemon on <Code>{SITE.daemon}</Code> that assembles ground-truth context from
          three tiers — your editor, your git repo, and lightweight ambient signals — and stores it on your machine.
          A local model (<Code>{SITE.model}</Code>) turns each snapshot into a plain-English &ldquo;where you left
          off&rdquo; briefing. Nothing leaves your device.
        </p>

        <H2 id="start">Where to start</H2>
        <p>
          New here? Follow the <Link href="/guide" className="font-medium text-accent">getting-started guide</Link>{" "}
          end to end. Looking for something specific, jump straight to a reference page below.
        </p>
      </Prose>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {DOC_PAGES.map((p) => (
          <Link
            key={p.slug}
            href={p.href}
            className="group rounded-[13px] border border-line bg-surface px-5 py-5 transition-colors hover:border-accent"
          >
            <h3 className="font-display text-[18px] font-semibold text-ink group-hover:text-accent">{p.title}</h3>
            <p className="mt-1.5 text-[14px] leading-[1.5] text-ink-soft">{p.summary}</p>
          </Link>
        ))}
      </div>

      <PageNav next={{ label: "Installation", href: "/docs/installation" }} />
    </>
  );
}
