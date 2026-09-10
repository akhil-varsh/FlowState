"use client";

import { useState } from "react";
import { Copy, Check } from "./icons";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      /* clipboard unavailable — still show feedback */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={label ?? `Copy: ${value}`}
      className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-[7px] border transition-colors ${
        copied ? "border-good text-good" : "border-line-strong text-ink-faint hover:border-accent hover:text-accent"
      }`}
    >
      {copied ? <Check className="h-[15px] w-[15px]" /> : <Copy className="h-[15px] w-[15px]" />}
    </button>
  );
}

export function CodeLine({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2.5 overflow-x-auto rounded-[9px] border border-line bg-bg-tint px-3 py-[11px] font-mono text-[12.5px] text-ink">
      <code className="flex-1 whitespace-pre">{value}</code>
      <CopyButton value={value} />
    </div>
  );
}
