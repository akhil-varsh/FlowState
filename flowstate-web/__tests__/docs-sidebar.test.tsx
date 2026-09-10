import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/docs/api",
}));

describe("<DocsSidebar />", () => {
  it("marks the current route as the active page", () => {
    render(<DocsSidebar />);
    const active = screen.getByRole("link", { name: "REST API" });
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("does not mark inactive routes", () => {
    render(<DocsSidebar />);
    const inactive = screen.getByRole("link", { name: "Configuration" });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("renders all three section groups", () => {
    render(<DocsSidebar />);
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(screen.getByText("Reference")).toBeInTheDocument();
    expect(screen.getByText("Concepts")).toBeInTheDocument();
  });
});
