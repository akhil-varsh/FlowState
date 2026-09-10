import type { Metadata } from "next";
import { DocHeader, Prose, H2, Code, Callout, PageNav } from "@/components/docs/doc-parts";

export const metadata: Metadata = {
  title: "Architecture",
  description: "The three capture tiers, the two stores, and the restore path that makes FlowState fast.",
};

const TIERS = [
  { tag: "Tier 1", name: "Editor (ground truth)", detail: "Open files, cursor, selection, recent edits, terminal commands with exit codes, and diagnostics — read from the VS Code Extension API. This is the richest, most reliable signal." },
  { tag: "Tier 2", name: "Git", detail: "Branch, dirty files, and last commit, resolved by the daemon from the workspace root via pygit2. Adds project state the editor alone doesn't carry." },
  { tag: "Tier 3", name: "Ambient", detail: "Only the foreground window title, process name, and clipboard — never other apps' contents. Enough to note you'd stepped into a browser, nothing more." },
];

export default function ArchitecturePage() {
  return (
    <>
      <DocHeader
        eyebrow="Concepts"
        title="Architecture"
        intro="FlowState assembles context from three ground-truth tiers, stores it in two purpose-built stores, and serves it back through one indexed lookup. The design keeps capture cheap, restore instant, and privacy structural."
      />

      <Prose>
        <H2 id="tiers">The three capture tiers</H2>
        <div className="my-2 flex flex-col gap-3">
          {TIERS.map((t) => (
            <div key={t.tag} className="rounded-[12px] border border-line bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="rounded-md px-2 py-1 font-mono text-[11px] font-semibold" style={{ background: "var(--cyan-soft)", color: "var(--cyan)" }}>
                  {t.tag}
                </span>
                <h3 className="font-display text-[18px] font-semibold text-ink">{t.name}</h3>
              </div>
              <p className="mt-2 text-[14.5px] leading-[1.6] text-ink-soft">{t.detail}</p>
            </div>
          ))}
        </div>

        <H2 id="flow">Capture → assemble → serve</H2>
        <p>
          The VS Code extension captures Tier 1 and POSTs a snapshot with <Code>git: null</Code>. The daemon&apos;s
          assembler fills Tier 2 (git) and Tier 3 (ambient), then indexes the result. Snapshots fire on focus loss
          (debounced 12s), 300s idle, or a manual <Code>Ctrl+Alt+S</Code> — never on a fixed timer.
        </p>

        <H2 id="stores">Two stores, two jobs</H2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <b className="text-ink">Hot store — SQLite.</b> The restore path. A single indexed lookup returns the
            latest session for a workspace. No vectors involved, so it&apos;s instant.
          </li>
          <li>
            <b className="text-ink">Cold store — ChromaDB.</b> Search only. On-device embeddings
            (all-MiniLM-L6-v2 via ONNX Runtime — no PyTorch) power semantic history search, one vector per snapshot.
          </li>
        </ul>

        <Callout tone="note" title="Why split them">
          Keeping restore on SQL and search on vectors means the common path — &ldquo;bring me back&rdquo; — never
          pays the cost of a similarity search, and the vector index can be rebuilt or purged without touching the
          source of truth.
        </Callout>

        <H2 id="lifecycle">Lifecycle & privacy</H2>
        <p>
          A TTL sweeper purges expired snapshots from both stores in lockstep. Optional Fernet encryption protects the
          payload at rest. Everything lives under <Code>%LOCALAPPDATA%\FlowState</Code>, every server binds
          <Code> 127.0.0.1</Code>, and the whole system runs offline after the one-time model pull.
        </p>
      </Prose>

      <PageNav
        prev={{ label: "CLI & shortcuts", href: "/docs/cli" }}
        next={{ label: "Privacy model", href: "/privacy" }}
      />
    </>
  );
}
