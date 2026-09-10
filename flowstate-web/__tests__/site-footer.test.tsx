import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/site-footer";
import { SITE } from "@/lib/content";

describe("<SiteFooter />", () => {
  it("shows the product name and version", () => {
    render(<SiteFooter />);
    expect(screen.getAllByText(SITE.name).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`v${SITE.version}`))).toBeInTheDocument();
  });

  it("links to the key docs routes", () => {
    render(<SiteFooter />);
    const api = screen.getByRole("link", { name: "REST API" });
    expect(api).toHaveAttribute("href", "/docs/api");

    const install = screen.getByRole("link", { name: "Installation" });
    expect(install).toHaveAttribute("href", "/docs/installation");
  });
});
