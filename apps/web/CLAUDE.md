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
