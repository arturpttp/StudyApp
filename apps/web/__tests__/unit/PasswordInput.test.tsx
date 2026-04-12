import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "@/components/PasswordInput";

describe("PasswordInput", () => {
  it("renders with type=password by default", () => {
    render(<PasswordInput value="" onChange={() => {}} />);
    const el = document.querySelector("input[type='password']");
    expect(el).toBeTruthy();
  });

  it("toggles to type=text when clicking the visibility button", async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="secret" onChange={() => {}} />);

    const button = screen.getByRole("button", { name: "Mostrar senha" });
    await user.click(button);

    const input = document.querySelector("input");
    expect(input?.type).toBe("text");
  });

  it("toggles back to type=password on second click", async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="secret" onChange={() => {}} />);

    const button = screen.getByRole("button", { name: "Mostrar senha" });
    await user.click(button);

    const hideButton = screen.getByRole("button", { name: "Ocultar senha" });
    await user.click(hideButton);

    const input = document.querySelector("input");
    expect(input?.type).toBe("password");
  });

  it("has correct aria-label for each state", async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeTruthy();
  });

  it("forwards value and onChange to the input", async () => {
    const onChange = vi.fn();
    render(<PasswordInput value="test" onChange={onChange} />);

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("test");

    const user = userEvent.setup();
    await user.type(input, "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("toggle button has type=button to prevent form submission", () => {
    render(<PasswordInput value="" onChange={() => {}} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("type")).toBe("button");
  });
});
