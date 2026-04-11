# lib/auth — Rules & Conventions

## Extract Framework Callbacks for Testability

When a framework (Auth.js, route handlers, server actions) wants an inline callback, **extract it to its own module** and import it back. The framework wrapper becomes a two-line composition; the logic is a plain async function you can unit- or integration-test without constructing the framework.

Example — `authorize.ts` + `config.ts`:

```ts
// authorize.ts  ← testable in isolation
export async function authorizeCredentials(raw: unknown) { ... }

// config.ts  ← trivial wiring
import { authorizeCredentials } from './authorize'
export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [Credentials({ authorize: authorizeCredentials })],
})
```

If you find yourself writing `authorize: async (raw) => { /* 20 lines */ }` inline, stop and extract.

## Shared Zod Schemas for Form + Route

Every endpoint that accepts a request body has a Zod schema in `schemas.ts`. The same schema is imported by:

1. The route handler (`safeParse` → 400 with `{ fields }` map on failure).
2. The client form (for client-side validation and typed submission).

Rules:

- Error messages are colocated inside the schema (second arg to `.string()`, `.min()`, etc.) and written in **Portuguese**.
- Export an inferred type alongside each schema: `export type RegisterInput = z.infer<typeof registerSchema>`.
- Never duplicate validation rules between the form and the route — the schema is the single source of truth.

## Email Normalization at Boundaries

Email uniqueness must survive case variance (`User@X.com` vs `user@x.com`). Normalize with `.toLowerCase()` at **every boundary that reads or writes** the email:

- Register handler: lowercase before `prisma.user.create`.
- `authorizeCredentials`: lowercase before `prisma.user.findUnique`.
- Any future password-reset or email-change flow: lowercase on both lookup and write.

Don't rely on "the user will always type it the same way." They won't.

## Password Handling

- Hashing lives in `password.ts` as pure helpers (`hashPassword`, `verifyPassword`). No Prisma, no Next.js imports — unit-testable without a DB.
- Always `bcryptjs` at **12 rounds**. Changing the cost factor is a breaking change for existing hashes; don't do it without a migration plan.
- Route handlers and server responses **never** echo the password hash. Return explicit field lists (`{ id, name, email }`), never `user` spreads.

## `authorize()` Returns `null`, Never Throws

On ANY failure path in `authorizeCredentials` (schema invalid, user not found, bad password), return `null`. Don't throw, don't return distinct error codes. Auth.js converts `null` into a generic `CredentialsSignin` error, which is the correct behavior — we don't want to leak "email exists but password wrong" vs "email doesn't exist" to callers.
