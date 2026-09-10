import Link from "next/link";

export default function NotFound() {
  return (
    <section className="wrap flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <span className="font-mono text-[13px] uppercase tracking-[0.2em] text-accent">404</span>
      <h1 className="mt-4 text-[clamp(32px,5vw,52px)]">This page slipped out of context.</h1>
      <p className="mt-4 max-w-[34em] text-[18px] text-ink-soft">
        The page you&apos;re after doesn&apos;t exist — but your flow doesn&apos;t have to break. Head back and pick
        up where you were.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3.5">
        <Link href="/" className="btn btn-primary">Back to home</Link>
        <Link href="/docs" className="btn btn-ghost">Browse the docs</Link>
      </div>
    </section>
  );
}
