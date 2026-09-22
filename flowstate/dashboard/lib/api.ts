// REST client for the local FlowState daemon. Localhost only.

import type {
  DailyReport,
  DailyReportResponse,
  DeepCaptureResponse,
  Health,
  HistoryItem,
  ObserverStatus,
  RestoreContextResponse,
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

// --- Phase 10 -------------------------------------------------------------
function wsQuery(workspace?: string): string {
  return workspace ? `?workspace=${encodeURIComponent(workspace)}` : "";
}

export async function getObserverStatus(): Promise<ObserverStatus> {
  return j<ObserverStatus>(
    await fetch(`${DAEMON_URL}/observer/status`, { cache: "no-store" })
  );
}

export async function setObserver(enabled: boolean): Promise<ObserverStatus> {
  return j<ObserverStatus>(
    await fetch(`${DAEMON_URL}/observer?enabled=${enabled}`, { method: "POST" })
  );
}

export async function startDay(workspace?: string): Promise<DeepCaptureResponse> {
  return j<DeepCaptureResponse>(
    await fetch(`${DAEMON_URL}/start-day${wsQuery(workspace)}`, { method: "POST" })
  );
}

export async function endDay(workspace?: string): Promise<DailyReportResponse> {
  return j<DailyReportResponse>(
    await fetch(`${DAEMON_URL}/end-day${wsQuery(workspace)}`, { method: "POST" })
  );
}

export async function getDailyReport(
  workspace?: string
): Promise<DailyReportResponse> {
  return j<DailyReportResponse>(
    await fetch(`${DAEMON_URL}/report/daily${wsQuery(workspace)}`, {
      cache: "no-store",
    })
  );
}

export async function restoreContext(
  workspace?: string
): Promise<RestoreContextResponse> {
  return j<RestoreContextResponse>(
    await fetch(`${DAEMON_URL}/restore-context${wsQuery(workspace)}`, {
      method: "POST",
    })
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** POST an already-generated report and download the formatted PDF (instant). */
export async function downloadDailyPdf(
  report: DailyReport,
  date: string,
  workspace: string
): Promise<void> {
  const q = new URLSearchParams();
  if (date) q.set("date", date);
  if (workspace) q.set("workspace", workspace);
  const res = await fetch(`${DAEMON_URL}/report/pdf?${q.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  triggerDownload(await res.blob(), `flowstate-report-${date || "today"}.pdf`);
}

/** A direct GET URL for the monthly report PDF (opens/downloads in the browser). */
export function monthlyPdfUrl(month?: string): string {
  const q = month ? `?month=${encodeURIComponent(month)}` : "";
  return `${DAEMON_URL}/report/monthly.pdf${q}`;
}
