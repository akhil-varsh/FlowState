"use client";

import { Cpu, Database, Wifi, WifiOff } from "lucide-react";
import type { Health } from "@/lib/types";

export default function DaemonStatus({
  health,
  connected,
}: {
  health: Health | null;
  connected: boolean;
}) {
  const online = !!health;
  const infReady = health?.inference?.available && health?.inference?.model_present;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Pill
        tone={connected ? "good" : "bad"}
        icon={connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      >
        {connected ? "live" : "reconnecting"}
      </Pill>

      <Pill tone={online ? "good" : "bad"} icon={<Database className="h-3.5 w-3.5" />}>
        daemon {online ? `· ${health?.snapshots ?? 0} snaps` : "offline"}
      </Pill>

      <Pill
        tone={infReady ? "good" : online ? "warn" : "bad"}
        icon={<Cpu className="h-3.5 w-3.5" />}
      >
        {health?.inference?.model ?? "model"}
        {online ? (infReady ? " · ready" : " · fallback") : ""}
      </Pill>
    </div>
  );
}

function Pill({
  children,
  icon,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: "good" | "warn" | "bad";
}) {
  const tones = {
    good: "text-flow-200 ring-flow-400/30 bg-flow-500/10",
    warn: "text-amber-200 ring-amber-400/30 bg-amber-500/10",
    bad: "text-slate-400 ring-white/10 bg-white/[0.03]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1 ${tones}`}
    >
      {icon}
      {children}
    </span>
  );
}
