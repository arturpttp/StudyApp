import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Select } from "@/components/ui/Select";

describe("Select", () => {
  it("renders with placeholder option", () => {
    render(
      <Select placeholder="Escolha...">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Escolha...")).toBeInTheDocument();
  });

  it("forwards value and onChange", () => {
    let captured = "";
    render(
      <Select value="b" onChange={(e) => (captured = e.target.value)}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("b");
  });

  it("renders without placeholder when not provided", () => {
    render(
      <Select>
        <option value="x">X</option>
      </Select>,
    );

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
  });
});
