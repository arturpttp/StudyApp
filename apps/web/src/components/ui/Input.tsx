import type { InputHTMLAttributes } from "react";
import { tv } from "tailwind-variants";
import { twMerge } from "tailwind-merge";

const input = tv({
  base: "w-full rounded border border-border bg-surface px-3 py-2 text-foreground focus:border-accent focus:outline-none",
});

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return <input className={twMerge(input(), className)} {...props} />;
}
