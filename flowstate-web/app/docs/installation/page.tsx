import type { Metadata } from "next";
import { DocHeader, Prose, H2, H3, Code, CodeBlock, Callout, PageNav } from "@/components/docs/doc-parts";

export const metadata: Metadata = {
  title: "Installation",
  description: "Install FlowState on Windows: the signed installer, the model pull, and verification.",
};

export default function InstallationPage() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Installation"
        intro="One Windows installer bundles the daemon (no Python required), the desktop widget, and the VS Code extension, then registers everything to start with your session. You'll be capturing in about five minutes."
      />

      <Prose>
        <H2 id="requirements">Requirements</H2>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Windows 10 or 11, x64</li>
          <li>Visual Studio Code 1.93 or newer</li>
          <li>16 GB RAM (CPU-only is fine — no GPU needed)</li>
          <li>
            <a href="https://ollama.com/download" className="font-medium text-accent">Ollama</a> for local inference
          </li>
        </ul>

        <H2 id="step-1">1 · Run the installer</H2>
        <p>
          Download and launch <Code>FlowState-Setup.exe</Code>. It&apos;s a per-user install built with Inno Setup,
          so <b>no administrator rights are required</b>. The installer will:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Install the bundled daemon and the desktop widget under your local app data.</li>
          <li>Install the VS Code extension (<Code>random-state.flowstate</Code>).</li>
          <li>Register per-user logon Scheduled Tasks so the daemon and widget start with your session.</li>
        </ul>

        <Callout tone="note" title="Why a scheduled task, not a service">
          FlowState registers a per-user logon task rather than a Windows service on purpose: a session-0 service
          can&apos;t read the foreground window, which would break the ambient capture tier.
        </Callout>

        <H2 id="step-2">2 · Pull the local model</H2>
        <p>
          Install Ollama, then pull the default model once. This is the only step that touches the network — after
          it completes, FlowState runs fully offline.
        </p>
        <CodeBlock lang="powershell" code={`ollama pull deepseek-r1:1.5b`} />
        <p>
          <Code>deepseek-r1:1.5b</Code> is the default and only supported model. It&apos;s ~1.1 GB and fits a tight
          RAM budget while still writing a useful briefing.
        </p>

        <H2 id="step-3">3 · Work as usual</H2>
        <p>
          Open a project in VS Code. FlowState captures in the background on the moments that matter. To capture
          on demand, press:
        </p>
        <CodeBlock lang="shortcut" code={`Ctrl + Alt + S`} />

        <H3>Verify it&apos;s running</H3>
        <p>Confirm the daemon and every subsystem are up:</p>
        <CodeBlock lang="powershell" code={`curl 127.0.0.1:8420/health`} />
        <p>
          A healthy response reports the <Code>search</Code>, <Code>security</Code>, <Code>recording</Code>, and
          <Code> ttl_seconds</Code> blocks. If the extension reports &ldquo;could not reach the daemon&rdquo;, see the{" "}
          <a href="/#faq" className="font-medium text-accent">troubleshooting FAQ</a>.
        </p>

        <Callout tone="warn" title="First run after install">
          Autostart tasks register at install time but only run at logon. After a fresh install, sign out and back
          in — or start FlowState from the Start menu — before your first capture.
        </Callout>
      </Prose>

      <PageNav
        prev={{ label: "Overview", href: "/docs" }}
        next={{ label: "Configuration", href: "/docs/configuration" }}
      />
    </>
  );
}
