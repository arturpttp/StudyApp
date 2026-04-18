# Components — Rules & Conventions

## Reusable Components

- When a component is used in more than one place, extract it into `ui/` as a standalone component.
- All UI components must use **Tailwind CSS**, **tailwind-merge** (`twMerge`) for class merging, and **tailwind-variants** (`tv`) for variant definitions.

## Interactive Elements

- Every `<button>`, `<a>`, and clickable element must include `cursor-pointer` in its class list.
