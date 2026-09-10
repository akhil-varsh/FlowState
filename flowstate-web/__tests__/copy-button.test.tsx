import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CopyButton } from "@/components/copy-button";

describe("<CopyButton />", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("writes the value to the clipboard on click", async () => {
    render(<CopyButton value="ollama pull deepseek-r1:1.5b" />);

    const btn = screen.getByRole("button");
    fireEvent.click(btn);

    expect(writeText).toHaveBeenCalledWith("ollama pull deepseek-r1:1.5b");
    await waitFor(() => expect(btn).toHaveClass("border-good"));
  });

  it("exposes an accessible label describing the value", () => {
    render(<CopyButton value="curl 127.0.0.1:8420/health" />);
    expect(
      screen.getByRole("button", { name: /curl 127\.0\.0\.1:8420\/health/ }),
    ).toBeInTheDocument();
  });
});
