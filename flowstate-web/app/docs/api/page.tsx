import type { Metadata } from "next";
import { API_ROWS } from "@/lib/content";
import { DocHeader, Prose, H2, Code, CodeBlock, Callout, Table, Verb, PageNav } from "@/components/docs/doc-parts";

export const metadata: Metadata = {
  title: "REST API",
  description: "Every FlowState daemon endpoint on 127.0.0.1:8420, with request shapes and examples.",
};

export default function ApiPage() {
  return (
    <>
      <DocHeader
        eyebrow="Reference"
        title="REST API"
        intro="The daemon exposes a small HTTP API on 127.0.0.1:8420 — always loopback, never 0.0.0.0. The restore path is a single indexed SQL lookup; the only vector path in the whole system is /search."
      />

      <Prose>
        <H2 id="endpoints">Endpoints</H2>
        <Table
          columns={[{ header: "Method" }, { header: "Endpoint" }, { header: "Purpose" }]}
          rows={API_ROWS.map((r) => [
            <Verb key="m" method={r.method} />,
            <span key="p" className="font-mono text-[12.5px] text-ink">{r.path}</span>,
            <span key="u">{r.purpose}</span>,
          ])}
        />

        <H2 id="restore">Restore a session</H2>
        <p>
          The core path. Returns the latest briefing for a workspace, assembled from one indexed lookup — no vectors,
          no model call at read time.
        </p>
        <CodeBlock lang="powershell" code={`curl "http://127.0.0.1:8420/restore?workspace=MP"`} />
        <CodeBlock
          lang="json"
          code={`{
  "summary": {
    "headline": "Fixing retry backoff in loop.py",
    "next_step": "Cap delay at max_retries, re-run tests",
    "files_to_reopen": ["learner/loop.py:88", "learner/client.py:12"]
  },
  "branch": "fix/retry-backoff",
  "captured": "14m ago"
}`}
        />

        <H2 id="search">Search your history</H2>
        <p>
          Semantic search over past sessions, powered by on-device embeddings (all-MiniLM-L6-v2 via ONNX Runtime).
          <Code>k</Code> caps the result count; <Code>workspace</Code> is optional.
        </p>
        <CodeBlock lang="powershell" code={`curl "http://127.0.0.1:8420/search?q=websocket+reconnect&k=5"`} />

        <H2 id="recording">Toggle recording</H2>
        <p>Flip the kill-switch that gates all capture. While disabled, <Code>/snapshot</Code> drops writes and returns <Code>{"{ stored: false, paused: true }"}</Code>.</p>
        <CodeBlock
          lang="powershell"
          code={`curl -X POST "http://127.0.0.1:8420/recording?enabled=false"
curl -X POST "http://127.0.0.1:8420/recording?enabled=true"`}
        />

        <H2 id="purge">Force a TTL sweep</H2>
        <CodeBlock lang="powershell" code={`curl -X POST "http://127.0.0.1:8420/maintenance/purge?ttl_seconds=604800"`} />

        <Callout tone="note" title="Loopback only">
          Every endpoint binds <Code>127.0.0.1</Code>. Nothing on your network can reach the daemon — there is no
          authentication layer because there is no remote surface to authenticate.
        </Callout>
      </Prose>

      <PageNav
        prev={{ label: "Configuration", href: "/docs/configuration" }}
        next={{ label: "CLI & shortcuts", href: "/docs/cli" }}
      />
    </>
  );
}
