import type { Metadata } from "next";
import { CLI_ROWS } from "@/lib/content";
import { DocHeader, Prose, H2, Code, CodeBlock, Table, PageNav } from "@/components/docs/doc-parts";

export const metadata: Metadata = {
  title: "CLI & Shortcuts",
  description: "Keyboard shortcuts, VS Code commands, and the desktop widget toggle.",
};

export default function CliPage() {
  return (
    <>
      <DocHeader
        eyebrow="Reference"
        title="CLI & shortcuts"
        intro="FlowState is mostly hands-off, but a handful of shortcuts and commands put you in control — capture on demand, rehydrate the last session, and pause recording whenever you want privacy."
      />

      <Prose>
        <H2 id="table">Everyday actions</H2>
        <Table
          columns={[{ header: "Action" }, { header: "How" }, { header: "Notes" }]}
          rows={CLI_ROWS.map((r) => [
            <span key="a" className="font-medium text-ink">{r.action}</span>,
            <span key="h" className="font-mono text-[12.5px] text-ink">{r.how}</span>,
            <span key="n">{r.notes}</span>,
          ])}
        />

        <H2 id="commands">VS Code commands</H2>
        <p>Open the Command Palette (<Code>Ctrl+Shift+P</Code>) and search &ldquo;FlowState&rdquo;:</p>
        <CodeBlock
          lang="text"
          code={`FlowState: Capture Snapshot Now
FlowState: Rehydrate Latest Session
FlowState: Open Dashboard`}
        />

        <H2 id="widget">The desktop widget</H2>
        <p>
          A small always-on card sits bottom-right showing your last capture. Its toggle flips recording on and off —
          teal when recording, grey when paused. It talks to the same daemon, so the state is shared with the
          extension.
        </p>

        <H2 id="health">Health & maintenance from the shell</H2>
        <CodeBlock
          lang="powershell"
          code={`# Is the daemon healthy?
curl 127.0.0.1:8420/health

# Pause capture for a sensitive session
curl -X POST "127.0.0.1:8420/recording?enabled=false"`}
        />
      </Prose>

      <PageNav
        prev={{ label: "REST API", href: "/docs/api" }}
        next={{ label: "Architecture", href: "/docs/architecture" }}
      />
    </>
  );
}
