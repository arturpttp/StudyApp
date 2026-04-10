# HealthQuest — Architecture Design
**Date:** 2026-04-10
**Status:** Approved

---

## 1. Overview

HealthQuest is a full-stack study platform for medical students and healthcare professionals. It offers a question bank (residency, Revalida, and competitive exams), personalised mock exams, and a spaced-repetition flashcard system.

---

## 2. Architecture

### 2.1 Monorepo (pnpm workspaces)

```
healthquest/
├── apps/
│   └── web/                        # Next.js 16.2.3 — UI + API routes
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/         # Login, register pages
│       │   │   ├── (app)/          # Protected app pages
│       │   │   └── api/v1/         # Next.js Route Handlers
│       │   ├── components/         # Shared React components
│       │   ├── lib/
│       │   │   ├── api/
│       │   │   │   └── generated/  # Kubb output (types + React Query hooks)
│       │   │   └── auth.ts         # Auth.js config
│       │   └── styles/
├── packages/
│   ├── db/                         # Prisma schema + @healthquest/db
│   │   ├── prisma/schema.prisma
│   │   └── src/index.ts
│   └── config/                     # Shared tsconfig, eslint, tailwind config
├── docker-compose.yml              # PostgreSQL service
├── pnpm-workspace.yaml
└── package.json
```

### 2.2 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.3 (App Router) |
| Package manager | pnpm workspaces |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS — `light`, `dark`, `code` themes on every component |
| Database | PostgreSQL via Docker |
| ORM | Prisma (`@healthquest/db` workspace package) |
| Auth | Auth.js v5 — `CredentialsProvider` (email + bcrypt), JWT session cookies |
| API typing | Zod → `zod-to-openapi` → `openapi.json` → Kubb → typed React Query hooks |
| Data fetching | React Server Components (initial loads) + TanStack Query v5 (client interactivity) |
| URL state | `nuqs` — filter state synced to query params |

### 2.3 Kubb Workflow

1. Route Handlers define request/response schemas with **Zod**
2. A `scripts/generate-openapi.ts` script uses `zod-to-openapi` to emit `openapi.json`
3. `pnpm kubb generate` reads the spec and writes typed fetch functions + React Query hooks to `apps/web/src/lib/api/generated/`
4. Client components import from generated — no hand-rolled fetch calls

---

## 3. Data Model

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id         String          @id @default(cuid())
  name       String
  email      String          @unique
  password   String          // bcryptjs hash, 12 rounds
  role       Role            @default(STUDENT)
  avatar     String?
  answers    AnswerHistory[]
  flashcards Flashcard[]
  exams      Exam[]
  createdAt  DateTime        @default(now())
}

model Question {
  id            String          @id @default(cuid())
  statement     String          // Markdown
  explanation   String?         // Markdown — revealed after answer
  difficulty    Difficulty
  status        Status          @default(ACTIVE)
  year          Int?
  subject       Subject         @relation(fields: [subjectId], references: [id])
  subjectId     String
  institution   Institution     @relation(fields: [institutionId], references: [id])
  institutionId String
  alternatives  Alternative[]
  answers       AnswerHistory[]
  examQuestions ExamQuestion[]
}

model Alternative {
  id         String          @id @default(cuid())
  text       String
  isCorrect  Boolean         // NEVER exposed in GET responses — server-only
  question   Question        @relation(fields: [questionId], references: [id])
  questionId String
  answers    AnswerHistory[]
}

model Subject {
  id        String     @id @default(cuid())
  name      String     @unique
  questions Question[]
}

model Institution {
  id        String     @id @default(cuid())
  name      String     @unique
  questions Question[]
}

model AnswerHistory {
  id            String      @id @default(cuid())
  user          User        @relation(fields: [userId], references: [id])
  userId        String
  question      Question    @relation(fields: [questionId], references: [id])
  questionId    String
  alternative   Alternative @relation(fields: [alternativeId], references: [id])
  alternativeId String
  isCorrect     Boolean
  responseTime  Int         // milliseconds
  createdAt     DateTime    @default(now())
}

model Flashcard {
  id         String    @id @default(cuid())
  user       User      @relation(fields: [userId], references: [id])
  userId     String
  front      String
  back       String
  lastReview DateTime?
  nextReview DateTime
  easeFactor Float     @default(2.5) // SM-2 algorithm
}

model Exam {
  id          String         @id @default(cuid())
  user        User           @relation(fields: [userId], references: [id])
  userId      String
  questions   ExamQuestion[]
  status      ExamStatus     @default(IN_PROGRESS)
  score       Float?         // set on finish (0.0–1.0)
  createdAt   DateTime       @default(now())
  finishedAt  DateTime?
}

model ExamQuestion {
  exam       Exam     @relation(fields: [examId], references: [id])
  examId     String
  question   Question @relation(fields: [questionId], references: [id])
  questionId String
  order      Int

  @@id([examId, questionId])
}

enum Role       { ADMIN STUDENT }
enum Difficulty { EASY MEDIUM HARD }
enum Status     { ACTIVE ARCHIVED }
enum ExamStatus { IN_PROGRESS FINISHED }
```

---

## 4. API Design (Route Handlers)

All routes under `apps/web/src/app/api/v1/`. Auth.js middleware guards every route except `/api/auth/*`. Every handler validates input with Zod before touching Prisma. Default page size: 20.

### 4.1 Questions

| Method | Route | Description |
|---|---|---|
| GET | `/api/v1/questions` | List with filters: `?page&limit&subjectId&institutionId&difficulty&year&unanswered` |
| GET | `/api/v1/questions/random` | Random question — optional `?difficulty` |
| GET | `/api/v1/questions/[id]` | Question detail — `isCorrect` omitted from response |
| POST | `/api/v1/questions/[id]/answer` | Submit `{ alternativeId }`, saves AnswerHistory, returns correctness + explanation |
| GET | `/api/v1/subjects` | All subjects |
| GET | `/api/v1/institutions` | All institutions |

### 4.2 Exams

| Method | Route | Description |
|---|---|---|
| POST | `/api/v1/exams/generate` | Create exam: `{ subjectId?, count, difficulty? }` |
| GET | `/api/v1/exams/[id]` | Fetch active exam questions |
| PATCH | `/api/v1/exams/[id]/finish` | Finalize exam — returns score + wrong answers |

### 4.3 Stats

| Method | Route | Description |
|---|---|---|
| GET | `/api/v1/stats/overview` | Total answered, % correct, current streak |
| GET | `/api/v1/stats/by-subject` | Per-subject accuracy (data for Radar Chart) |

### 4.4 Flashcards

| Method | Route | Description |
|---|---|---|
| GET | `/api/v1/flashcards` | Cards due: `WHERE nextReview <= NOW()` |
| POST | `/api/v1/flashcards` | Create card `{ front, back }` |
| PATCH | `/api/v1/flashcards/[id]/review` | SM-2 update: `{ rating: 1 | 2 | 3 }` → recalculate `easeFactor` + `nextReview` |

---

## 5. Frontend Architecture

### 5.1 Route Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
└── (app)/                       # middleware.ts protects this group
    ├── layout.tsx               # Shell: sidebar, nav, theme toggle
    ├── dashboard/page.tsx       # Weekly activity summary + quick-start shortcuts
    ├── questions/
    │   ├── page.tsx             # Question bank + filter sidebar
    │   └── [id]/page.tsx        # Zen Mode: timer, flag, answer + explanation reveal
    ├── exams/
    │   └── [id]/page.tsx        # Exam mode + finish report
    ├── flashcards/page.tsx      # Spaced-repetition review (flip card + SM-2 rating)
    └── stats/page.tsx           # Radar chart + overview metrics
```

### 5.2 Reusable Components

| Component | Purpose |
|---|---|
| `QuestionCard` | Renders statement + alternatives; hides correct answer until submission |
| `FilterSidebar` | Subject, institution, difficulty, year filters — state via `nuqs` |
| `DifficultyBadge` | Coloured label for EASY / MEDIUM / HARD |
| `PaginationControl` | Page navigation |
| `LoadingSkeleton` | Prevents CLS during data fetches |
| `ThemeToggle` | Cycles `light → dark → code`, persists to `localStorage` |
| `FlashcardReview` | Front/back flip animation + SM-2 rating buttons (Fácil / Médio / Difícil) |

### 5.3 Data Fetching Pattern

- **Server Components** call `@healthquest/db` directly for initial page renders — no network round-trip
- **Client Components** use Kubb-generated React Query hooks for mutations and interactive filtering
- Filter state lives in URL query params via `nuqs` — bookmarkable and shareable

### 5.4 Theming

Three themes required on every component: `light`, `dark`, `code` (monospace fonts, syntax-highlight-inspired palette). Theme class applied to `<html>` element, toggled via `ThemeToggle`, persisted to `localStorage`.

---

## 6. Auth Flow

Auth.js v5 with `CredentialsProvider`. Sessions stored as encrypted JWT cookies — no database session table required.

```
middleware.ts
  matcher: ['/(app)/(.*)']
  → redirects unauthenticated requests to /login
```

- **Register:** Custom route `POST /api/auth/register` → hash password (bcryptjs, 12 rounds) → create `User` → auto sign-in
- **Login:** `signIn('credentials', { email, password })` → validate → set session cookie
- **Server access:** `auth()` from `lib/auth.ts` in Server Components and Route Handlers
- **Client access:** `useSession()` from `next-auth/react`

`isCorrect` on `Alternative` is never returned by any GET endpoint. Correct answer validation occurs strictly server-side inside `POST /questions/[id]/answer`.

---

## 7. Infrastructure

### 7.1 Docker (development)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: healthquest
      POSTGRES_PASSWORD: healthquest
      POSTGRES_DB: healthquest_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 7.2 Environment Variables

```
# apps/web/.env.local
DATABASE_URL="postgresql://healthquest:healthquest@localhost:5432/healthquest_dev"
AUTH_SECRET="<random-32-char-string>"
AUTH_URL="http://localhost:3000"
```

---

## 8. Business Rules

- Default page size: 20 questions per request
- `isCorrect` never exposed in API responses — server-only validation
- Flashcard SM-2: `nextReview` filtered with `<= NOW()` on due cards
- Seed script must include at least 50 questions across multiple subjects and institutions

---

## 9. Development Sequence

1. **Infra setup** — Docker Compose + Prisma schema + `@healthquest/db` package + pnpm workspace config
2. **Auth** — Auth.js setup, register/login routes, middleware protection
3. **Seed** — 50+ test questions via `prisma/seed.ts`
4. **API core** — Questions endpoints with all filters + Kubb codegen pipeline
5. **Frontend base** — Question bank page consuming generated hooks
6. **Answer flow** — Submit answer, reveal explanation, save history
7. **Exams** — Generate + finish flow
8. **Flashcards** — SM-2 review loop
9. **Stats** — Aggregated queries + Radar Chart
