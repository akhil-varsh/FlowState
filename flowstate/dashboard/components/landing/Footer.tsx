import { Waves } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-flow-500/15 ring-1 ring-flow-400/30">
            <Waves className="h-3.5 w-3.5 text-flow-300" />
          </span>
          <span className="text-sm font-medium">
            Flow<span className="text-flow-300">State</span>
          </span>
        </div>
        <p className="text-center text-xs text-slate-500">
          Ephemeral, privacy-first context restoration · runs entirely on
          127.0.0.1
        </p>
        <p className="text-xs text-slate-500">
          Team <span className="text-slate-300">RANDOM STATE</span> · VNRVJIET
        </p>
      </div>
    </footer>
  );
}
