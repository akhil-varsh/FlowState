// FlowState VS Code extension — ground-truth capture (Tier 1).
//
// Activates on startup, keeps a StateCollector alive to watch edits and
// terminal executions, and exposes commands to capture a snapshot and to
// rehydrate the latest one. All network traffic goes to the local daemon.

import * as vscode from "vscode";
import { StateCollector } from "./collector";
import { postSnapshot } from "./daemonClient";
import { DaemonSocket } from "./daemonSocket";
import { rehydrate, rehydrateLatest } from "./rehydrate";
import { TriggerManager } from "./triggers";
import { Trigger } from "./types";

let collector: StateCollector;
let socket: DaemonSocket;
let triggers: TriggerManager;
let statusItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  collector = new StateCollector();
  context.subscriptions.push(collector);

  // Persistent channel for daemon-driven rehydration (dashboard "Rehydrate").
  socket = new DaemonSocket();
  socket.start();
  context.subscriptions.push(socket);

  // Automatic interruption triggers (focus loss / idle), debounced.
  triggers = new TriggerManager((t) => capture(t));
  triggers.start();
  context.subscriptions.push(triggers);

  statusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusItem.text = "$(history) FlowState";
  statusItem.tooltip = "FlowState is capturing ground-truth context";
  statusItem.command = "flowstate.captureSnapshot";
  statusItem.show();
  context.subscriptions.push(statusItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("flowstate.captureSnapshot", () =>
      capture("manual")
    ),
    vscode.commands.registerCommand("flowstate.rehydrateLatest", () =>
      rehydrateLatest()
    ),
    // Invoked by the daemon-driven flow in Phase 4 (dashboard "Rehydrate").
    vscode.commands.registerCommand(
      "flowstate.rehydrate",
      (targets: string[]) => rehydrate(targets ?? [])
    )
  );

  console.log("[FlowState] extension activated");
}

async function capture(trigger: Trigger): Promise<void> {
  const snapshot = collector.buildSnapshot(trigger);
  if (!snapshot.workspace.root) {
    vscode.window.showWarningMessage(
      "FlowState: open a folder to capture a workspace snapshot."
    );
    return;
  }
  const ack = await postSnapshot(snapshot);
  if (ack?.stored) {
    const how = trigger === "manual" ? "" : ` (${trigger.replace("_", " ")})`;
    flashStatus("$(check) Captured");
    vscode.window.setStatusBarMessage(
      `FlowState: snapshot captured for ${snapshot.workspace.name}${how}`,
      3000
    );
  } else if (ack?.paused) {
    // Recording is turned off in the FlowState widget — this is intentional, not
    // an error. Stay quiet for automatic triggers; nudge only on a manual press.
    flashStatus("$(circle-slash) Paused");
    if (trigger === "manual") {
      vscode.window.setStatusBarMessage(
        "FlowState: recording is paused — turn it on in the FlowState widget.",
        3000
      );
    }
  } else {
    flashStatus("$(warning) Daemon offline");
    vscode.window.showWarningMessage(
      "FlowState: could not reach the daemon on 127.0.0.1. Is it running?"
    );
  }
}

function flashStatus(text: string): void {
  const original = statusItem.text;
  statusItem.text = text;
  setTimeout(() => (statusItem.text = original), 2500);
}

export function deactivate(): void {
  collector?.dispose();
  socket?.dispose();
  triggers?.dispose();
  statusItem?.dispose();
}
