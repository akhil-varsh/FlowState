import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Faq } from "@/components/landing/faq";
import { FAQS } from "@/lib/content";

describe("<Faq />", () => {
  it("renders every question as a button", () => {
    render(<Faq />);
    for (const f of FAQS) {
      expect(screen.getByRole("button", { name: f.q })).toBeInTheDocument();
    }
  });

  it("opens the first item by default and toggles others on click", async () => {
    const user = userEvent.setup();
    render(<Faq />);

    // First answer is visible on mount.
    expect(screen.getByText(FAQS[0].a)).toBeInTheDocument();

    const second = screen.getByRole("button", { name: FAQS[1].q });
    expect(second).toHaveAttribute("aria-expanded", "false");

    await user.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(FAQS[1].a)).toBeInTheDocument();
  });
});
