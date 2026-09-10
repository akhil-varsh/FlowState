import type { MetadataRoute } from "next";
import { DOC_PAGES } from "@/lib/content";

const BASE = "https://flowstate.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/docs", "/guide", "/privacy"].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const docRoutes = DOC_PAGES.map((p) => ({
    url: `${BASE}${p.href}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...docRoutes];
}
