import type { AnchorHTMLAttributes } from "react";
import { tv } from "tailwind-variants";
import { twMerge } from "tailwind-merge";

const linkButton = tv({
  base: "text-sm text-accent underline hover:text-foreground cursor-pointer",
});

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {}

export function LinkButton({ className, ...props }: LinkButtonProps) {
  return <a className={twMerge(linkButton(), className)} {...props} />;
}
