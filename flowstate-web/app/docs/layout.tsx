import type { Metadata } from "next";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export const metadata: Metadata = {
  title: { default: "Documentation", template: "%s · FlowState Docs" },
  description: "Install, configure, script, and understand FlowState.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap grid gap-10 py-12 md:grid-cols-[220px_1fr] md:py-16 lg:grid-cols-[240px_1fr] lg:gap-16">
      <aside className="md:sticky md:top-24 md:h-[calc(100vh-8rem)] md:overflow-y-auto md:pr-2">
        <DocsSidebar />
      </aside>
      <article className="min-w-0 max-w-[52rem]">{children}</article>
    </div>
  );
}
