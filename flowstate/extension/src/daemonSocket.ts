// Persistent WebSocket from the extension to the local daemon.
//
// The daemon pushes rehydrate commands here when the user clicks "Rehydrate"
// in the dashboard. We reconnect with backoff so the channel survives daemon
// restarts. Connects only to the configured localhost daemon.

import * as vscode from "vscode";
import WebSocket from "ws";
import { daemonUrl } from "./daemonClient";
import { rehydrate } from "./rehydrate";

export class DaemonSocket implements vscode.Disposable {
  private ws: WebSocket | null = null;
  private closed = false;
  private retry = 0;
  private timer: NodeJS.Timeout | undefined;

  start(): void {
    this.closed = false;
    this.connect();
  }

  private wsUrl(): string {
    // http://127.0.0.1:8420 -> ws://127.0.0.1:8420/ext/ws
    const base = daemonUrl().replace(/^http/, "ws").replace(/\/$/, "");
    return `${base}/ext/ws`;
  }

  private connect(): void {
    if (this.closed) {
      return;
    }
    try {
      this.ws = new WebSocket(this.wsUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.retry = 0;
      console.log("[FlowState] connected to daemon rehydrate channel");
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      this.handleMessage(data.toString());
    });

    this.ws.on("close", () => this.scheduleReconnect());
    this.ws.on("error", () => {
      // 'close' fires after 'error'; reconnect is handled there.
      this.ws?.close();
    });
  }

  private handleMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg?.type === "rehydrate" && Array.isArray(msg.targets)) {
      rehydrate(msg.targets as string[]);
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) {
      return;
    }
    this.ws = null;
    this.retry = Math.min(this.retry + 1, 6);
    const delay = Math.min(1000 * 2 ** this.retry, 30000); // capped backoff
    this.timer = setTimeout(() => this.connect(), delay);
  }

  dispose(): void {
    this.closed = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.ws?.close();
    this.ws = null;
  }
}
