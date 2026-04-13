import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";

describe("DifficultyBadge", () => {
  it("renders EASY with Portuguese label", () => {
    render(<DifficultyBadge difficulty="EASY" />);
    expect(screen.getByText("Fácil")).toBeInTheDocument();
  });

  it("renders MEDIUM with Portuguese label", () => {
    render(<DifficultyBadge difficulty="MEDIUM" />);
    expect(screen.getByText("Médio")).toBeInTheDocument();
  });

  it("renders HARD with Portuguese label", () => {
    render(<DifficultyBadge difficulty="HARD" />);
    expect(screen.getByText("Difícil")).toBeInTheDocument();
  });

  it("applies different styles per difficulty", () => {
    const { rerender } = render(<DifficultyBadge difficulty="EASY" />);
    const easyClassName = screen.getByText("Fácil").className;
    expect(easyClassName).not.toBe("");

    rerender(<DifficultyBadge difficulty="HARD" />);
    const hardClassName = screen.getByText("Difícil").className;
    expect(hardClassName).not.toBe(easyClassName);
  });
});
