"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Sparkles } from "lucide-react";
import { search } from "@/lib/api";
import type { SearchHit } from "@/lib/types";

export default function SearchBar() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setNote(null);
    try {
      const res = await search(q.trim());
      setHits(res);
      if (res.length === 0) setNote("No matching sessions found.");
    } catch {
      // Search index unavailable (daemon down, or model not yet downloaded).
      setHits(null);
      setNote("Search is unavailable — is the daemon running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <form onSubmit={run} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your history — “when did I last touch auth?”"
          className="w-full rounded-xl border border-white/10 bg-ink-900/60 py-2.5 pl-9 pr-24 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition focus:border-flow-400/40 focus:ring-2 focus:ring-flow-400/20"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-lg bg-flow-500/90 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-flow-400 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Search
        </button>
      </form>

      <AnimatePresence>
        {note && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 text-xs text-slate-500"
          >
            {note}
          </motion.p>
        )}
      </AnimatePresence>

      {hits && hits.length > 0 && (
        <ul className="mt-3 space-y-2">
          {hits.map((h) => (
            <li
              key={h.id}
              className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono">
                  {h.workspace_name || "—"}
                  <span className="ml-2 text-slate-600">
                    {new Date(h.timestamp).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                <span className="text-flow-300/80">{(h.score * 100).toFixed(0)}% match</span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{h.summary_text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
