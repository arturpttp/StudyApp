# Auth (Step 2) — Design Spec

**Status:** Draft
**Date:** 2026-04-11
**Owner:** HealthQuest
**Scope:** Implements step 2 of `SPECS.md` §9 — Auth.js v5 with credentials provider, registration endpoint, route protection via middleware, and the first protected dashboard stub.

---

## 1. Goal

Allow a new user to register, automatically sign in, land on a protected dashboard, and sign out — end-to-end, with TDD-backed verification on all server-side logic.

This step is **not** responsible for the three-theme design system (`light`/`dark`/`code`). That lands in step 2.5, as its own brainstorm. Step 2 ships with minimal Tailwind v4 and no custom theming so we don't half-design the theme system under time pressure.

## 2. Non-Goals

- Email verification, password reset, OAuth providers, magic links.
- Role-based authorization beyond `STUDENT` default (admins will be seeded manually later).
- Avatar upload — deferred to a future profile flow.
- Full CSS theme system (light/dark/code) — deferred to step 2.5.
- End-to-end browser tests (Playwright not yet installed). Middleware behavior is intentionally exercised through the Auth.js `authorize()` callback and manual smoke rather than automated E2E.

## 3. User Flows

### 3.1 Registration
1. User visits `/register`, fills `name`, `email`, `password`, `confirmPassword`.
2. Form submits JSON to `POST /api/auth/register`.
3. Server validates with shared Zod schema → hashes password (`bcryptjs`, 12 rounds) → `prisma.user.create`.
4. On Prisma `P2002` (unique email conflict), server returns `409` with `{ error: "E-mail já cadastrado." }`.
5. On `201`, client calls `signIn('credentials', { email, password, redirect: false })`.
6. On `signIn` success, client redirects to `/dashboard`.

### 3.2 Login
1. User visits `/login`, fills `email` + `password`.
2. Client calls `signIn('credentials', { email, password, redirect: false, callbackUrl })`.
3. On success, redirect to `callbackUrl ?? '/dashboard'`.
4. On failure, render `"E-mail ou senha inválidos."` inline.

### 3.3 Protected Access
1. User hits `/dashboard` (or any future `(app)` route).
2. `middleware.ts` runs: if no session cookie, redirect to `/login?callbackUrl=/dashboard`.
3. Authenticated requests pass through; the server component reads `await auth()` for the user.

### 3.4 Sign Out
1. `(app)/layout.tsx` renders a "Sair" button that calls the server action wrapping `signOut({ redirectTo: '/login' })`.

## 4. Validation Rules

### 4.1 Password
- Minimum **8 characters**.
- Must contain at least one **letter** (`/[A-Za-z]/`).
- Must contain at least one **digit** (`/\d/`).

### 4.2 Email
- Must match `z.string().email()`.
- Stored lowercased (normalized in the register handler before insert and in `authorize()` before lookup).

### 4.3 Name
- Trimmed, min length 1 after trim, max length 120.

### 4.4 `confirmPassword`
- Must equal `password`; enforced via `z.object(...).refine(...)` with path `['confirmPassword']`.

All error messages are Portuguese strings defined inside the Zod schemas so the same source of truth feeds both the API and the client form.

## 5. Data & Schema

No Prisma schema changes. The existing `User` model already has `name`, `email` (unique), `password`, `role` (default `STUDENT`), `avatar?`, `createdAt`. Registration writes the first four fields; `role` defaults, `avatar` is null.

## 6. API

### 6.1 `POST /api/auth/register`

**Request body**
```json
{ "name": "string", "email": "string", "password": "string", "confirmPassword": "string" }
```

**Responses**
- `201` → `{ "id": "cuid", "name": "string", "email": "string" }` (never the hash)
- `400` → `{ "error": "string", "fields": { [fieldName]: "Portuguese message" } }` on Zod failure
- `409` → `{ "error": "E-mail já cadastrado." }` on `P2002`
- `500` → `{ "error": "Erro interno do servidor." }` for anything unexpected

### 6.2 `GET/POST /api/auth/[...nextauth]`
Standard Auth.js v5 handlers re-exported from `lib/auth/config.ts`. Session strategy `jwt`, no DB session table.

## 7. File Layout

```
apps/web/
├── middleware.ts                                # matcher: ['/dashboard/:path*']
├── next.config.ts                               # (existing)
├── postcss.config.mjs                           # NEW — @tailwindcss/postcss
├── vitest.config.ts                             # NEW — node env, dotenv loader
├── .env.local.example                           # NEW — DATABASE_URL, AUTH_SECRET, AUTH_URL
├── src/
│   ├── app/
│   │   ├── globals.css                          # NEW — @import "tailwindcss"
│   │   ├── layout.tsx                           # imports globals.css
│   │   ├── page.tsx                             # session-aware redirect
│   │   ├── (auth)/
│   │   │   ├── layout.tsx                       # centered card shell
│   │   │   ├── login/page.tsx                   # client form
│   │   │   └── register/page.tsx                # client form
│   │   ├── (app)/
│   │   │   ├── layout.tsx                       # server layout + SignOutButton
│   │   │   └── dashboard/page.tsx               # "Bem-vindo, {name}" stub
│   │   └── api/
│   │       └── auth/
│   │           ├── [...nextauth]/route.ts       # re-exports handlers
│   │           └── register/route.ts            # POST handler
│   └── lib/
│       └── auth/
│           ├── authorize.ts                     # authorizeCredentials (testable)
│           ├── config.ts                        # NextAuth() config
│           ├── index.ts                         # barrel: auth, handlers, signIn, signOut
│           ├── password.ts                      # hash(plain), verify(plain, hash)
│           └── schemas.ts                       # registerSchema, loginSchema
└── __tests__/
    ├── unit/
    │   ├── password.test.ts
    │   └── schemas.test.ts
    └── integration/
        ├── register-route.test.ts
        └── credentials-authorize.test.ts
```

## 8. Module Responsibilities

### 8.1 `lib/auth/password.ts`
Pure helpers; no Prisma, no Next.
```ts
export async function hashPassword(plain: string): Promise<string>
export async function verifyPassword(plain: string, hash: string): Promise<boolean>
```
12 bcrypt rounds. Exists as its own module so it is unit-testable in isolation.

### 8.2 `lib/auth/schemas.ts`
```ts
export const registerSchema = z.object({...}).refine(...)
export const loginSchema = z.object({...})
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
```
Messages in Portuguese, colocated with the schema. Imported by both the client forms and the route handlers.

### 8.3 `lib/auth/authorize.ts`
Extracted as its own module so the integration test (§9.4) can exercise it without constructing a NextAuth instance.
```ts
import { loginSchema } from './schemas'
import { verifyPassword } from './password'
import { prisma } from '@healthquest/db'

export async function authorizeCredentials(raw: unknown) {
  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) return null
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  })
  if (!user) return null
  const ok = await verifyPassword(parsed.data.password, user.password)
  if (!ok) return null
  return { id: user.id, name: user.name, email: user.email }
}
```
Returns `null` on ANY failure (invalid schema, user not found, bad password). Never throws user-observable errors — Auth.js converts `null` to `CredentialsSignin`.

### 8.3b `lib/auth/config.ts`
```ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authorizeCredentials } from './authorize'

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({ authorize: authorizeCredentials }),
  ],
})
```

### 8.4 `lib/auth/index.ts`
Barrel re-exporting `{ auth, handlers, signIn, signOut }` from `./config` so consumers import from `@/lib/auth`.

### 8.5 `api/auth/register/route.ts`
Route handler:
1. Parse body (try/catch JSON).
2. `registerSchema.safeParse` → on failure return `400` with a `fields` map of Portuguese error messages (one per failing key).
3. Hash password.
4. `prisma.user.create({ data: { name, email: email.toLowerCase(), password: hash } })`.
5. Catch `P2002` → `409`.
6. Return `201 { id, name, email }`.

No auto-login here — the client calls `signIn()` after the `201`. Keeps the handler pure and easy to test.

### 8.6 `api/auth/[...nextauth]/route.ts`
```ts
export { GET, POST } from '@/lib/auth'
```

### 8.7 `middleware.ts`
```ts
export { auth as middleware } from '@/lib/auth'
export const config = { matcher: ['/dashboard/:path*'] }
```
Auth.js v5 ships an edge-compatible middleware adapter; using `auth` directly means unauthenticated requests are redirected to the configured `pages.signIn` with `callbackUrl` automatically.

### 8.8 `app/page.tsx`
Server component. `const session = await auth()`; `redirect(session ? '/dashboard' : '/login')`. Replaces the current placeholder that counts subjects — we lose the "0 specialties" smoke but gain a meaningful root route.

### 8.9 `(auth)/layout.tsx`
Simple centered card wrapper with Tailwind utility classes. No theming — just enough to look intentional.

### 8.10 `(auth)/login/page.tsx` & `(auth)/register/page.tsx`
Client components (`'use client'`). Plain controlled forms, no React Hook Form, no shadcn — keeping dependencies minimal. Submit handler:
- Register: `fetch('/api/auth/register', ...)` → on 201 call `signIn('credentials', ...)` → `router.push('/dashboard')`.
- Login: `signIn('credentials', { email, password, redirect: false, callbackUrl })` → on success `router.push(callbackUrl)`.
- Error state stored in local component state, rendered as a Portuguese message above the button.

### 8.11 `(app)/layout.tsx`
Server component. `const session = await auth(); if (!session) redirect('/login')` (defense-in-depth alongside middleware). Renders a minimal shell with children and a `<SignOutButton />` client component.

### 8.12 `(app)/dashboard/page.tsx`
Server component. `const session = await auth()` → `<h1>Bem-vindo, {session.user.name}</h1>`. No data fetching, no features. It exists to prove the round-trip.

## 9. Testing Strategy (TDD)

Tests are written first, fail, then the minimal implementation lands. Each test file below gets its own commit in the execution plan.

### 9.1 `password.test.ts` (unit)
- `hashPassword` returns a string different from the plaintext.
- Two hashes of the same plaintext are different (salt).
- `verifyPassword` returns `true` for a matching pair.
- `verifyPassword` returns `false` for a non-matching pair.

### 9.2 `schemas.test.ts` (unit)
`registerSchema`:
- Valid input parses.
- Rejects password < 8 chars.
- Rejects password missing a letter.
- Rejects password missing a digit.
- Rejects `password !== confirmPassword`.
- Rejects invalid email.
- Rejects empty name.

`loginSchema`:
- Valid input parses.
- Rejects invalid email.
- Rejects empty password.

### 9.3 `register-route.test.ts` (integration, real Docker Postgres)
- `201` on valid input; user persisted; stored password is NOT the plaintext and verifies via `verifyPassword`.
- `409` on duplicate email (second call with same email).
- `400` on missing fields / invalid password shape, with `fields` map populated.
- Email normalized to lowercase on insert.
- Cleanup: `afterEach` deletes users whose email starts with `__test_`.

### 9.4 `credentials-authorize.test.ts` (integration)
Exercises `authorizeCredentials` from `lib/auth/authorize.ts` directly (see §8.3).
- Returns user shape for correct email + password.
- Returns `null` for non-existent user.
- Returns `null` for wrong password.
- Returns `null` for schema-invalid input.
- Cleanup identical to §9.3.

### 9.5 Out of scope (deferred)
- Middleware redirect behavior (needs Next.js request simulation or Playwright).
- Form rendering / interaction tests (needs `@testing-library/react` + `jsdom`).
- `/register` → auto-login → `/dashboard` full round-trip (Playwright).

A manual smoke checklist lives in the implementation plan's Task 9 to cover these gaps until E2E exists.

## 10. Environment

### 10.1 New variables in `apps/web/.env.local.example`
```env
DATABASE_URL="postgresql://healthquest:healthquest@localhost:5432/healthquest_dev"
AUTH_SECRET="change-me-to-a-random-32-char-string"
AUTH_URL="http://localhost:3000"
```

### 10.2 Tests
`vitest.config.ts` loads `.env.local` via `dotenv/config` in `setupFiles` so `DATABASE_URL` and `AUTH_SECRET` are present. Mirrors the pattern already in `packages/db`.

## 11. Dependencies to Add (`apps/web`)

**Runtime**
- `next-auth@beta` (v5)
- `bcryptjs`
- `zod`
- `tailwindcss@^4`
- `@tailwindcss/postcss`

**Dev**
- `@types/bcryptjs`
- `vitest`
- `dotenv`

No React Hook Form, no shadcn/ui, no `@testing-library/*`, no `jsdom` in this step — keeps the dependency surface small and aligned with scope.

## 12. Security Checklist

- Password hashing via `bcryptjs` at 12 rounds — matches spec §6.
- Register route never echoes the hash.
- `authorize()` returns `null` on any failure — no timing or error-message side channels exposed to the client beyond Auth.js's generic `CredentialsSignin`.
- Email normalized to lowercase to prevent duplicate accounts via case variance.
- `AUTH_SECRET` mandatory; dev default in `.env.local.example` is clearly labeled as placeholder.
- JWT session — no session table means no DB row to accidentally leak; tradeoff is we cannot revoke a session server-side until token expiry. Acceptable for this phase.
- `isCorrect` exposure rule (spec §8) is unaffected — no question endpoints touched.

## 13. Open Questions (none blocking)

None. Every ambiguity raised during brainstorming has been resolved inline.

## 14. Summary

Step 2 delivers: registration endpoint, credentials-based login, JWT sessions, a middleware-protected dashboard stub, and TDD coverage for every pure helper, schema, and server-side endpoint. It deliberately defers styling/theming, E2E, and non-auth features so the security-sensitive surface gets full attention.
