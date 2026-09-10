import type { Metadata } from "next";
import { CONFIG_ROWS } from "@/lib/content";
import { DocHeader, Prose, H2, Code, CodeBlock, Callout, Table, PageNav } from "@/components/docs/doc-parts";

export const metadata: Metadata = {
  title: "Configuration",
  description: "The full config.toml key table, environment overrides, and encryption.",
};

export default function ConfigurationPage() {
  return (
    <>
      <DocHeader
        eyebrow="Reference"
        title="Configuration"
        intro="FlowState reads sensible defaults, a per-user config.toml, and environment variables — in that order of increasing precedence. A commented config file is written on first run, so most people never touch it."
      />

      <Prose>
        <H2 id="precedence">Resolution order</H2>
        <p>Each setting resolves from the first source that defines it:</p>
        <CodeBlock lang="text" code={`env  FLOWSTATE_*   →   config.toml   →   built-in default`} />
        <p>
          The config file lives at <Code>%LOCALAPPDATA%\FlowState\config.toml</Code>. A Start-menu shortcut opens it
          directly.
        </p>

        <H2 id="keys">Keys</H2>
        <Table
          columns={[{ header: "Key" }, { header: "Default" }, { header: "Controls" }]}
          rows={CONFIG_ROWS.map((r) => [
            <span key="k" className="font-mono text-[12.5px] text-ink">{r.key}</span>,
            <span key="d" className="font-mono text-[12.5px] text-ink">{r.def}</span>,
            <span key="c">{r.controls}</span>,
          ])}
        />

        <H2 id="example">Example config.toml</H2>
        <CodeBlock
          lang="toml"
          code={`# Written on first run. Uncomment to override a default.
model = "deepseek-r1:1.5b"
port  = 8420
purge_interval_seconds = 3600
# encryption_key = "set me to encrypt snapshots at rest"`}
        />

        <H2 id="env">Environment overrides</H2>
        <p>
          Any key can be overridden with a <Code>FLOWSTATE_</Code> environment variable — useful for testing or
          per-project data directories.
        </p>
        <CodeBlock
          lang="powershell"
          code={`$env:FLOWSTATE_MODEL = "deepseek-r1:1.5b"
$env:FLOWSTATE_DATA_DIR = "D:\\flowstate-data"
$env:FLOWSTATE_ENCRYPTION_KEY = "a-strong-passphrase"`}
        />

        <H2 id="encryption">At-rest encryption</H2>
        <p>
          Setting an <Code>encryption_key</Code> (via config or <Code>FLOWSTATE_ENCRYPTION_KEY</Code>) turns on
          Fernet encryption of the snapshot payload, derived with PBKDF2-HMAC-SHA256. Index columns stay plaintext so
          restore is still a fast SQL lookup; only the JSON body is encrypted.
        </p>
        <Callout tone="warn" title="Keep your key">
          Encryption is opt-in and irreversible without the key. If you lose the passphrase, existing encrypted
          snapshots can&apos;t be read back — FlowState fails loudly rather than silently returning garbage.
        </Callout>
      </Prose>

      <PageNav
        prev={{ label: "Installation", href: "/docs/installation" }}
        next={{ label: "REST API", href: "/docs/api" }}
      />
    </>
  );
}
