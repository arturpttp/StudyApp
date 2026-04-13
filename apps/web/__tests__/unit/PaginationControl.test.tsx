import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaginationControl } from "@/components/ui/PaginationControl";

describe("PaginationControl", () => {
  it("shows current page and total pages", () => {
    render(<PaginationControl page={2} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("disables previous button on first page", () => {
    render(<PaginationControl page={1} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText("Página anterior")).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<PaginationControl page={5} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText("Próxima página")).toBeDisabled();
  });

  it("calls onPageChange with correct page", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<PaginationControl page={3} totalPages={5} onPageChange={handler} />);

    await user.click(screen.getByLabelText("Próxima página"));
    expect(handler).toHaveBeenCalledWith(4);

    await user.click(screen.getByLabelText("Página anterior"));
    expect(handler).toHaveBeenCalledWith(2);
  });

  it("hides when totalPages is 1", () => {
    const { container } = render(
      <PaginationControl page={1} totalPages={1} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
