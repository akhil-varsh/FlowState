import { describe, it, expect } from "vitest";
import {
  API_ROWS,
  CONFIG_ROWS,
  NAV_LINKS,
  FEATURES,
  FAQS,
  DOC_PAGES,
  SITE,
} from "@/lib/content";

describe("site content invariants", () => {
  it("uses deepseek as the one default model", () => {
    expect(SITE.model).toBe("deepseek-r1:1.5b");
    const modelRow = CONFIG_ROWS.find((r) => r.key === "model");
    expect(modelRow?.def).toBe("deepseek-r1:1.5b");
  });

  it("binds the daemon to loopback only", () => {
    expect(SITE.daemon).toContain("127.0.0.1");
    expect(SITE.daemon).not.toContain("0.0.0.0");
  });

  it("exposes the core restore and search endpoints", () => {
    const paths = API_ROWS.map((r) => r.path);
    expect(paths.some((p) => p.startsWith("/restore"))).toBe(true);
    expect(paths.some((p) => p.startsWith("/search"))).toBe(true);
    expect(paths).toContain("/health");
  });

  it("only allows GET or POST methods", () => {
    for (const row of API_ROWS) {
      expect(["GET", "POST"]).toContain(row.method);
    }
  });

  it("has non-empty, well-formed nav links", () => {
    expect(NAV_LINKS.length).toBeGreaterThan(0);
    for (const link of NAV_LINKS) {
      expect(link.label).toBeTruthy();
      expect(link.href.startsWith("/")).toBe(true);
    }
  });

  it("gives every feature a title, body, and icon", () => {
    expect(FEATURES.length).toBe(6);
    for (const f of FEATURES) {
      expect(f.title.length).toBeGreaterThan(2);
      expect(f.body.length).toBeGreaterThan(20);
      expect(f.icon).toBeTruthy();
    }
  });

  it("keeps FAQ answers substantive", () => {
    expect(FAQS.length).toBeGreaterThanOrEqual(5);
    for (const f of FAQS) {
      expect(f.q.endsWith("?")).toBe(true);
      expect(f.a.length).toBeGreaterThan(40);
    }
  });

  it("routes every doc page under /docs", () => {
    for (const p of DOC_PAGES) {
      expect(p.href.startsWith("/docs/")).toBe(true);
      expect(p.slug).toMatch(/^[a-z-]+$/);
    }
  });
});
