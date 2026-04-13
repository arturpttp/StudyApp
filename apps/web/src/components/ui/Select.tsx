import type { SelectHTMLAttributes } from "react";
import { tv } from "tailwind-variants";
import { twMerge } from "tailwind-merge";

const select = tv({
  base: "w-full rounded border border-border bg-surface px-3 py-2 text-foreground focus:border-accent focus:outline-none cursor-pointer appearance-none",
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string;
}

export function Select({
  placeholder,
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <select className={twMerge(select(), className)} {...props}>
      {placeholder && (
        <option value="" disabled={!props.value && props.value !== ""}>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  );
}
