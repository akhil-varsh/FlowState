// REST client for the local FlowState daemon. Localhost only.

import type {
  Health,
  HistoryItem,
  RestoreResponse,
  SearchHit,
} from "./types";

export const DAEMON_URL =
  process.env.NEXT_PUBLIC_DAEMON_URL ?? "http://127.0.0.1:8420";

export const DAEMON_WS =
  process.env.NEXT_PUBLIC_DAEMON_WS ?? DAEMON_URL.replace(/^http/, "ws") + "/ws";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function getHealth(): Promise<Health> {
  return j<Health>(await fetch(`${DAEMON_URL}/health`, { cache: "no-store" }));
}

export async function getRestore(workspace?: string): Promise<RestoreResponse> {
  const q = workspace ? `?workspace=${encodeURIComponent(workspace)}` : "";
  return j<RestoreResponse>(
    await fetch(`${DAEMON_URL}/restore${q}`, { cache: "no-store" })
  );
}

export async function getHistory(workspace?: string): Promise<HistoryItem[]> {
  const q = workspace ? `?workspace=${encodeURIComponent(workspace)}` : "";
  return j<HistoryItem[]>(
    await fetch(`${DAEMON_URL}/history${q}`, { cache: "no-store" })
  );
}

export async function search(query: string): Promise<SearchHit[]> {
  return j<SearchHit[]>(
    await fetch(`${DAEMON_URL}/search?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
    })
  );
}

export async function rehydrate(
  targets: string[],
  workspace?: string
): Promise<{ dispatched: boolean; extension_connected: boolean }> {
  return j(
    await fetch(`${DAEMON_URL}/rehydrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets, workspace }),
    })
  );
}
