# HealthQuest — Documentação de Especificação Técnica

## 1. Visão Geral

O **HealthQuest** é uma plataforma full-stack para estudantes e profissionais da saúde. Oferece banco de questões (Residência, Revalida, Concursos), simulados personalizados e sistema de flashcards com repetição espaçada (SM-2).

---

## 2. Arquitetura

### 2.1 Monorepo (pnpm workspaces)

```
healthquest/
├── apps/
│   └── web/                        # Next.js 16.2.3 — UI + API Routes
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/         # Páginas de login e cadastro
│       │   │   ├── (app)/          # Páginas protegidas
│       │   │   └── api/v1/         # Route Handlers (API REST)
│       │   ├── components/         # Componentes React reutilizáveis
│       │   ├── lib/
│       │   │   ├── api/
│       │   │   │   └── generated/  # Saída do Kubb (tipos + hooks React Query)
│       │   │   └── auth.ts         # Configuração Auth.js
│       │   └── styles/
├── packages/
│   ├── db/                         # Prisma schema + pacote @healthquest/db
│   │   ├── prisma/schema.prisma
│   │   └── src/index.ts
│   └── config/                     # tsconfig, eslint e tailwind compartilhados
├── docker-compose.yml              # Serviço PostgreSQL
├── pnpm-workspace.yaml
└── package.json
```

### 2.2 Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.2.3 (App Router) |
| Gerenciador de pacotes | pnpm workspaces |
| Linguagem | TypeScript (strict) |
| Estilização | Tailwind CSS — temas `light`, `dark`, `code` em todos os componentes |
| Banco de dados | PostgreSQL via Docker |
| ORM | Prisma (pacote `@healthquest/db`) |
| Autenticação | Auth.js v5 — `CredentialsProvider` (email + bcrypt), cookies JWT |
| Tipagem de rotas | Zod → `zod-to-openapi` → `openapi.json` → Kubb → hooks React Query tipados |
| Busca de dados | React Server Components (carregamento inicial) + TanStack Query v5 (interatividade) |
| Estado de URL | `nuqs` — filtros sincronizados com query params |

### 2.3 Fluxo do Kubb

1. Route Handlers definem schemas de request/response com **Zod**
2. Script `scripts/generate-openapi.ts` usa `zod-to-openapi` para gerar `openapi.json`
3. `pnpm kubb generate` lê o spec e escreve funções de fetch tipadas + hooks React Query em `apps/web/src/lib/api/generated/`
4. Componentes client importam do gerado — nenhuma chamada fetch manual

---

## 3. Modelo de Dados

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
  password   String          // hash bcryptjs, 12 rounds
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
  explanation   String?         // Markdown — revelado após resposta
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
  isCorrect  Boolean         // NUNCA exposto em respostas GET — somente servidor
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
  responseTime  Int         // milissegundos
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
  easeFactor Float     @default(2.5) // algoritmo SM-2
}

model Exam {
  id          String       @id @default(cuid())
  user        User         @relation(fields: [userId], references: [id])
  userId      String
  questions   ExamQuestion[]
  status      ExamStatus   @default(IN_PROGRESS)
  score       Float?       // set on finish (0.0–1.0)
  createdAt   DateTime     @default(now())
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

## 4. API (Route Handlers)

Todas as rotas em `apps/web/src/app/api/v1/`. Auth.js protege todas exceto `/api/auth/*`. Toda entrada validada com Zod antes de tocar o Prisma. Limite padrão: 20 por página.

### 4.1 Questões

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/questions` | Listagem com filtros: `?page&limit&subjectId&institutionId&difficulty&year&unanswered` |
| GET | `/api/v1/questions/random` | Questão aleatória — `?difficulty` opcional |
| GET | `/api/v1/questions/[id]` | Detalhe da questão — `isCorrect` omitido |
| POST | `/api/v1/questions/[id]/answer` | Envia `{ alternativeId }`, salva histórico, retorna acerto + explicação |
| GET | `/api/v1/subjects` | Todas as especialidades |
| GET | `/api/v1/institutions` | Todas as instituições |

### 4.2 Simulados

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/exams/generate` | Cria simulado: `{ subjectId?, count, difficulty? }` |
| GET | `/api/v1/exams/[id]` | Busca questões do simulado ativo |
| PATCH | `/api/v1/exams/[id]/finish` | Finaliza simulado — retorna pontuação + erros |

### 4.3 Estatísticas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/stats/overview` | Total respondido, % de acertos, sequência atual |
| GET | `/api/v1/stats/by-subject` | Acurácia por especialidade (dados para Radar Chart) |

### 4.4 Flashcards

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/flashcards` | Cards pendentes: `WHERE nextReview <= NOW()` |
| POST | `/api/v1/flashcards` | Cria card `{ front, back }` |
| PATCH | `/api/v1/flashcards/[id]/review` | Atualiza SM-2: `{ rating: 1 \| 2 \| 3 }` → recalcula `easeFactor` + `nextReview` |

---

## 5. Frontend

### 5.1 Estrutura de Rotas

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
└── (app)/                       # middleware.ts protege este grupo
    ├── layout.tsx               # Shell: sidebar, nav, alternador de tema
    ├── dashboard/page.tsx       # Resumo semanal + atalhos
    ├── questions/
    │   ├── page.tsx             # Banco de questões + filtros laterais
    │   └── [id]/page.tsx        # Modo Zen: timer, marcador, resposta + explicação
    ├── exams/
    │   └── [id]/page.tsx        # Modo simulado + relatório final
    ├── flashcards/page.tsx      # Revisão com repetição espaçada
    └── stats/page.tsx           # Radar Chart + métricas gerais
```

### 5.2 Componentes Reutilizáveis

| Componente | Função |
|---|---|
| `QuestionCard` | Renderiza enunciado + alternativas; oculta resposta correta até envio |
| `FilterSidebar` | Filtros por especialidade, instituição, dificuldade, ano — estado via `nuqs` |
| `DifficultyBadge` | Label colorida: EASY / MEDIUM / HARD |
| `PaginationControl` | Navegação entre páginas |
| `LoadingSkeleton` | Evita CLS durante fetches |
| `ThemeToggle` | Alterna `light → dark → code`, persiste em `localStorage` |
| `FlashcardReview` | Animação de flip + botões SM-2 (Fácil / Médio / Difícil) |

### 5.3 Padrão de Busca de Dados

- **Server Components** acessam `@healthquest/db` diretamente para renderização inicial
- **Client Components** usam hooks React Query gerados pelo Kubb para mutations e filtragem interativa
- Estado de filtros na URL via `nuqs` — links compartilháveis e navegáveis pelo histórico

### 5.4 Temas

Três temas obrigatórios em todos os componentes: `light`, `dark`, `code` (fontes monoespaçadas, paleta inspirada em syntax highlighting). Classe de tema aplicada em `<html>`, alternada pelo `ThemeToggle`, persistida em `localStorage`.

---

## 6. Autenticação

Auth.js v5 com `CredentialsProvider`. Sessões em cookies JWT criptografados — sem tabela de sessão no banco.

```
middleware.ts
  matcher: ['/(app)/(.*)']
  → redireciona não autenticados para /login
```

- **Cadastro:** `POST /api/auth/register` → hash da senha (bcryptjs, 12 rounds) → criar `User` → login automático
- **Login:** `signIn('credentials', { email, password })` → validar → setar cookie de sessão
- **Acesso server-side:** `auth()` de `lib/auth.ts` em Server Components e Route Handlers
- **Acesso client-side:** `useSession()` de `next-auth/react`

`isCorrect` em `Alternative` nunca é retornado por GET. Validação da resposta ocorre estritamente no servidor dentro de `POST /questions/[id]/answer`.

---

## 7. Infraestrutura

### 7.1 Docker (desenvolvimento)

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

### 7.2 Variáveis de Ambiente

```env
# apps/web/.env.local
DATABASE_URL="postgresql://healthquest:healthquest@localhost:5432/healthquest_dev"
AUTH_SECRET="<string-aleatória-32-chars>"
AUTH_URL="http://localhost:3000"
```

---

## 8. Regras de Negócio

- Limite padrão de 20 questões por requisição
- `isCorrect` nunca exposto nas respostas da API — validação exclusivamente no servidor
- Flashcards SM-2: filtrar por `nextReview <= NOW()` para cards pendentes
- Script de seed deve incluir pelo menos 50 questões distribuídas entre múltiplas especialidades e instituições

---

## 9. Sequência de Desenvolvimento

1. **Infra** — Docker Compose + schema Prisma + pacote `@healthquest/db` + configuração pnpm workspace
2. **Auth** — Auth.js, rotas de cadastro/login, proteção por middleware
3. **Seed** — 50+ questões de teste via `prisma/seed.ts`
4. **API core** — Endpoints de questões com todos os filtros + pipeline Kubb
4.5. **API docs** — OpenAPI spec via `zod-to-openapi` + Scalar UI interativa em `/api-docs`
5. **Frontend base** — Página de banco de questões consumindo hooks gerados
6. **Fluxo de resposta** — Enviar resposta, revelar explicação, salvar histórico
6.5. **Estado persistente de resposta** — Ao abrir uma questão já respondida, exibir a alternativa escolhida, o gabarito e a explicação em estado bloqueado (sem permitir nova seleção ou envio). Um botão **Resetar** limpa o estado da UI e libera nova tentativa — a tentativa anterior permanece no `AnswerHistory`, e a nova tentativa é salva como linha adicional. Fonte de verdade: última linha de `AnswerHistory` do par `(userId, questionId)`.
7. **Simulados** — Fluxo de geração e finalização
8. **Flashcards** — Loop de revisão SM-2
9. **Estatísticas** — Queries agregadas + Radar Chart
