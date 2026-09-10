// Thin client for the local FlowState daemon. Talks only to 127.0.0.1.

import * as vscode from "vscode";
import { Snapshot } from "./types";

export function daemonUrl(): string {
  const cfg = vscode.workspace.getConfiguration("flowstate");
  return cfg.get<string>("daemonUrl", "http://127.0.0.1:8420");
}

export async function postSnapshot(
  snapshot: Snapshot
): Promise<{ id: string; stored: boolean; paused?: boolean } | null> {
  const url = `${daemonUrl()}/snapshot`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    if (!res.ok) {
      throw new Error(`daemon responded ${res.status}`);
    }
    return (await res.json()) as { id: string; stored: boolean; paused?: boolean };
  } catch (err) {
    // The daemon may be down; capture must never crash the editor.
    console.error("[FlowState] postSnapshot failed:", err);
    return null;
  }
}

export interface TriggerPolicy {
  focus_debounce_seconds: number;
  idle_seconds: number;
  min_capture_interval_seconds: number;
}

export async function getPolicy(): Promise<TriggerPolicy | null> {
  try {
    const res = await fetch(`${daemonUrl()}/config`);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as TriggerPolicy;
  } catch {
    return null;
  }
}

export async function getRestore(workspace: string): Promise<any | null> {
  const url = `${daemonUrl()}/restore?workspace=${encodeURIComponent(workspace)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[FlowState] getRestore failed:", err);
    return null;
  }
}
