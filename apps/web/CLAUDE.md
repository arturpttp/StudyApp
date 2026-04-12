# apps/web — Rules & Conventions

## API Error Envelope

Route handlers return a consistent JSON shape for errors:

```ts
// Validation failure (400)
{ "error": "Dados inválidos.", "fields": { "email": "E-mail inválido." } }

// Conflict / business error (4xx)
{ "error": "E-mail já cadastrado." }

// Server error (5xx)
{ "error": "Erro interno do servidor." }
```

- `error` is always present and always Portuguese (pt-BR).
- `fields` is an optional map of `fieldName → Portuguese message`, used when the client needs to render inline errors per-field.
- Never leak Prisma error codes, stack traces, or English framework messages to the client.

## Route Groups & Protection

- `app/(auth)/` — public auth pages (login, register). No session required.
- `app/(app)/` — protected pages. Every route here is behind the session check.
- `middleware.ts` is the primary gate — its `matcher` lists the protected paths (e.g. `['/dashboard/:path*']`). Add new `(app)` segments to the matcher as they're introduced.
- **Defense-in-depth:** `(app)/layout.tsx` (or the page itself) must also call `await auth()` and `redirect('/login')` if null. Middleware protects against missing session cookies; the layout protects against misconfigured matchers and server-side data leaks.

## Server vs Client Components

- Default to server components. Only mark `'use client'` when the component needs state, effects, or browser-only APIs (forms, `useSession`, `signIn`, `router.push`, etc.).
- Server components read data directly via `@healthquest/db` (`prisma.*`).
- Client components never import `@healthquest/db` — they go through route handlers + Kubb-generated hooks (once Kubb lands).

## Test Layout

- Tests live in `apps/web/__tests__/` split into:
  - `unit/` — pure functions, schemas, helpers. No DB, no network.
  - `integration/` — real Docker Postgres via `@healthquest/db`. Cleans up its own test data in `afterEach`/`afterAll`.
- Vitest config loads `.env.local` via `dotenv` in `setupFiles` — mirrors the `packages/db` pattern.
- Integration tests scope their data by prefixing identifiers with `__test_` so cleanup is a single `deleteMany({ where: { ...: { startsWith: '__test_' } } })`.
- No `@testing-library/react` or `jsdom` until we genuinely need component rendering tests — keeps the dev-dependency surface small.

## Theming

The app ships three themes — `light`, `dark`, `code` — switched via the `data-theme` attribute on `<html>` by `next-themes`. Default on first visit is `light` (explicit, not `prefers-color-scheme`). Persistence is `localStorage` only, no DB column.

**Semantic tokens** (defined in `src/app/globals.css` via `@theme inline`):

| Token utility | Use for |
|---|---|
| `bg-background` | Page background |
| `bg-surface` | Cards, headers, inputs, raised surfaces |
| `text-foreground` | Primary body text and headings |
| `text-muted` | Secondary text, labels, captions |
| `border-border` | All borders and dividers |
| `bg-primary` / `text-primary-foreground` | Primary action buttons |
| `text-accent` / `focus:border-accent` | Accent / focus highlights |
| `text-danger` | Error messages, destructive actions |

**Rules:**

- **Never** introduce a hardcoded `slate-*`, `bg-white`, `text-white`, or `text-red-*` utility in committed code. If a token is missing, add it to `globals.css` (a new CSS variable on every `[data-theme]` block plus the `@theme inline` mapping) and use the new utility.
- The `code` theme redirects `--font-sans` to Geist Mono. Any element using `font-sans` (the default) automatically renders mono in the code theme. Don't add explicit `font-mono` utilities unless you want mono in *all* themes.
- The `ThemeSwitcher` component is `'use client'`; it must guard against SSR with a `mounted` flag to avoid the next-themes hydration mismatch. Server components consuming theme tokens through Tailwind utilities don't need any client boundary — the variables resolve at paint time.
- Adding a new protected page? It only needs the right tokens; the switcher and theme provider already live in the layout.
