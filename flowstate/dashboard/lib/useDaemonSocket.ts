"use client";

import { useEffect, useRef, useState } from "react";
import { DAEMON_WS } from "./api";

export interface DaemonEvent {
  type: "hello" | "snapshot_captured" | "summary" | string;
  [key: string]: any;
}

/**
 * Subscribe to the daemon's live push channel (/ws). Reconnects with backoff.
 * Returns the connection state and the most recent event.
 */
export function useDaemonSocket(onEvent?: (e: DaemonEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<DaemonEvent | null>(null);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(DAEMON_WS);
      } catch {
        schedule();
        return;
      }
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as DaemonEvent;
          setLastEvent(data);
          handlerRef.current?.(data);
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        schedule();
      };
      ws.onerror = () => ws?.close();
    };

    const schedule = () => {
      if (closed) return;
      retry = Math.min(retry + 1, 6);
      const delay = Math.min(1000 * 2 ** retry, 15000);
      timer = setTimeout(connect, delay);
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  return { connected, lastEvent };
}
