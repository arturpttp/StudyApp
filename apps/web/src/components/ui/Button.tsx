import type { ButtonHTMLAttributes } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { twMerge } from "tailwind-merge";

const button = tv({
  base: "inline-flex items-center justify-center gap-2 rounded text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
  variants: {
    variant: {
      primary: "bg-primary px-3 py-2 text-primary-foreground hover:opacity-90",
      outline:
        "border border-border bg-surface px-3 py-2 text-foreground hover:bg-background",
      ghost: "px-3 py-2 text-muted hover:text-foreground hover:bg-surface",
      danger: "bg-danger px-3 py-2 text-primary-foreground hover:opacity-90",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

type ButtonVariants = VariantProps<typeof button>;

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariants {}

export function Button({ variant, className, ...props }: ButtonProps) {
  return (
    <button className={twMerge(button({ variant }), className)} {...props} />
  );
}
