# Simulados — Design Document

**Data:** 2026-04-17
**Escopo:** SPECS.md §9 passo 7 — "Simulados: Fluxo de geração e finalização"

---

## 1. Visão Geral

Fluxo completo de simulados personalizados: criar, responder (uma questão por vez com navegação livre), finalizar, revisar relatório. Respostas persistem no servidor enquanto o simulado está em andamento e entram no `AnswerHistory` ao finalizar.

### Paradigma escolhido

- **Uma questão por página**, com navegação livre (anterior / próxima / palette).
- **Gabarito só no relatório final** — durante o simulado, o usuário não sabe se acertou.
- **Respostas em draft no servidor** por questão: cada clique em alternativa dispara `PATCH` que grava `selectedAlternativeId`. Fechar a aba e voltar restaura tudo.
- **Timer opcional** configurado na criação; se ativado, countdown regressivo que ao zerar auto-finaliza.
- **Múltiplos simulados em andamento** permitidos simultaneamente.
- **Respostas integradas ao `AnswerHistory`** ao finalizar: uma questão respondida em simulado aparece como "já respondida" no banco de questões.

### Jornada do usuário

1. Entra em `/exams`. Vê formulário "Novo simulado" no topo + lista de simulados anteriores.
2. Configura: especialidade (opcional), dificuldade (opcional), quantidade (5–100), toggle "Com tempo limitado" + minutos (5–600).
3. Clica "Gerar". Backend cria `Exam` + N `ExamQuestion`. Redirect pra `/exams/[id]`.
4. Em `/exams/[id]`, vê: timer no topo, questão atual com alternativas (sem gabarito), Anterior/Próxima, contador "3/10", palette numerada com estado visual, botão "Finalizar Simulado".
5. Seleciona alternativa → otimista local + `PATCH` salva. Pode voltar e trocar.
6. Clica Finalizar → se há em-branco, confirma → `PATCH /finish`.
7. Mesma URL `/exams/[id]` renderiza o relatório: card de resumo + lista expansível.

---

## 2. Modelo de Dados (Prisma)

Duas mudanças, uma migração.

```prisma
model Exam {
  id          String         @id @default(cuid())
  user        User           @relation(fields: [userId], references: [id])
  userId      String
  questions   ExamQuestion[]
  status      ExamStatus     @default(IN_PROGRESS)
  score       Float?
  timeLimit   Int?           // minutos; null = sem limite
  createdAt   DateTime       @default(now())
  finishedAt  DateTime?
}

model ExamQuestion {
  exam                  Exam          @relation(fields: [examId], references: [id])
  examId                String
  question              Question      @relation(fields: [questionId], references: [id])
  questionId            String
  order                 Int
  selectedAlternativeId String?
  selectedAlternative   Alternative?  @relation(fields: [selectedAlternativeId], references: [id])

  @@id([examId, questionId])
}
```

- `timeLimit: Int?` — em minutos, nullable (`null` = stopwatch).
- `selectedAlternativeId: String?` — null enquanto não respondido, id quando marcado, volta a null se desmarcar.
- `score` permanece `Float?` (null enquanto `IN_PROGRESS`, 0.0–1.0 quando `FINISHED`).
- `finishedAt` permanece `null` até finalizar.
- `Alternative` ganha a relação reversa (`examSelections: ExamQuestion[]`) gerada pelo Prisma.

---

## 3. API

Base: `apps/web/src/app/api/v1/exams/`. Todas retornam o envelope padrão do `apps/web/CLAUDE.md` (`{ error, fields? }`).

### POST `/api/v1/exams/generate`

**Body (Zod):**
```ts
{
  subjectId?: string,
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD',
  count: number,         // 5–100
  timeLimit?: number | null  // 5–600 min, null/omit = sem limite
}
```

**Lógica:** filtra `Question` por `status: ACTIVE` + filtros opcionais. Se pool < `count` → 422 `{ error: "Não há questões suficientes para os filtros escolhidos." }`. Senão embaralha, pega N, cria `Exam` + N `ExamQuestion` em transação.

**Response:** `{ id: string }` (201).

### GET `/api/v1/exams/[id]`

**Auth:** checa `userId` da sessão. 404 se não é do usuário ou não existe.

**Response (shape discriminado por `status`):**

`IN_PROGRESS`:
```ts
{
  id, status: 'IN_PROGRESS', timeLimit, createdAt,
  questions: [{
    questionId, order, statement,
    alternatives: [{ id, text, position }],  // sem isCorrect
    selectedAlternativeId  // string | null
  }]
}
```

`FINISHED`:
```ts
{
  id, status: 'FINISHED', score, timeLimit, createdAt, finishedAt,
  questions: [{
    questionId, order, statement, explanation,
    alternatives: [{ id, text, position }],
    selectedAlternativeId, correctAlternativeId, isCorrect
  }]
}
```

### PATCH `/api/v1/exams/[id]/questions/[questionId]`

**Body:** `{ alternativeId: string | null }` (null = desmarcar).

**Validação:** dono, exam `IN_PROGRESS`, alternativa pertence à questão (se não-null).

**Response:** 204. Erros: 409 se finalizado, 400 se alternativa inválida, 404 se exam/questão não encontrados.

### PATCH `/api/v1/exams/[id]/finish`

**Body:** vazio.

**Lógica (transação):**
1. Lê todas as `ExamQuestion` + `Question.alternatives`.
2. Para cada uma: `isCorrect = selectedAlternativeId && alternatives.find(a => a.isCorrect).id === selectedAlternativeId`.
3. Para cada `ExamQuestion` com `selectedAlternativeId !== null`, cria linha em `AnswerHistory` com `responseTime = 0`. Não trackeamos tempo por questão no simulado; stats futuras terão que tratar zero como "resposta em simulado" (ou filtrar). Documentar no CLAUDE.md do módulo.
4. `score = corretas / total` (não-respondidas contam como erradas).
5. Atualiza `status='FINISHED'`, `finishedAt=now()`, `score`.

**Response:** mesmo shape do GET em estado `FINISHED`. 409 se já finalizado.

---

## 4. Rotas e Páginas

Novas rotas em `apps/web/src/app/(app)/exams/`:

```
exams/
├── page.tsx                  # Server Component — lista + NewExamForm inline
└── [id]/
    └── page.tsx              # Server Component — despacha ExamRunner ou ExamReport
```

### `/exams/page.tsx` (Server Component)
- `await auth()` (defense-in-depth).
- Carrega `prisma.exam.findMany({ where: { userId }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] })` (em andamento no topo).
- Renderiza `<NewExamForm subjects={...} />` + lista de `<ExamCard exam={...} />`.

### `/exams/[id]/page.tsx` (Server Component)
- `await auth()` + carrega exam com inclusões completas. `notFound()` se não existe ou não é do usuário.
- Se `status === 'IN_PROGRESS'` → `<ExamRunner exam={...} />`.
- Se `status === 'FINISHED'` → `<ExamReport exam={...} />`.

---

## 5. Componentes

Em `apps/web/src/components/exams/`:

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `NewExamForm` | client | Form de criação. Hook `usePostApiV1ExamsGenerate`. Select de especialidade, select de dificuldade, input numérico de quantidade, toggle + input de minutos. On success → `router.push('/exams/{id}')`. |
| `ExamCard` | server | Item da lista. Título, data, status (badge), score ou progresso, botão "Continuar" ou "Ver relatório". |
| `ExamRunner` | client | Orquestrador do modo ativo. Estado local de `currentIndex` e `selections`. Timer, palette, navegação, finish. |
| `ExamTimer` | client | Stopwatch ou countdown baseado em `createdAt` + `timeLimit` do server. Dispara `onExpire`. |
| `ExamQuestionPalette` | client | Grid de botõezinhos numerados. Estado por questão: respondida (cheio) / em branco (vazio) / atual (borda destacada). Clique → muda índice. |
| `ExamQuestionPanel` | client | Enunciado + alternativas da questão atual. Reutiliza `AlternativeRow` com nova fase `"exam-active"` (nunca revela gabarito). |
| `FinishExamDialog` | client | Modal de confirmação quando há em-branco. Usado só no finish manual; timer força direto sem dialog. |
| `ExamReport` | server | Card de resumo (score, %, tempo total, data). |
| `ExamReportItem` | client | Item expansível do relatório. Cabeçalho sempre visível; corpo (enunciado + `AlternativeRow` fase revealed + explicação) colapsado por padrão. |

### Reutilizações

- `AlternativeRow` ganha uma nova fase `"exam-active"` — renderiza seleção sem resultado. Preserva toda a máquina de estado existente; só adiciona o novo ramo.
- `DifficultyBadge` usado em `ExamCard` e `ExamReportItem`.

---

## 6. Fluxo de dados do `ExamRunner`

**Estado local:**
```ts
const [currentIndex, setCurrentIndex] = useState(0);
const [selections, setSelections] = useState<Record<string, string|null>>(
  // inicializado dos ExamQuestion.selectedAlternativeId vindos do server
);
const [isFinishing, setIsFinishing] = useState(false);
```

**Seleção:** clique → update otimista + `mutation.mutate({ id, questionId, data: { alternativeId } })`. Falha → reverte + toast.

**Navegação:** Anterior/Próxima/palette só mudam `currentIndex`. Sem fetch.

**Timer:** derivado de `exam.createdAt` (server-authoritative). `elapsed = now - createdAt` (stopwatch) ou `remaining = (createdAt + timeLimit) - now` (countdown). Sobrevive a reload.

**Finalizar:**
1. Conta em-branco em `selections`. Se > 0 → `FinishExamDialog`. Senão direto.
2. Confirmado → `usePatchApiV1ExamsIdFinish`. Sucesso → `router.refresh()` (URL não muda).
3. Timer zerou → mesma mutation, sem dialog.

**Race conditions:**
- Cliques rápidos (A→B→C): mutations disparam em paralelo. Último a chegar no server ganha no DB. UI mostra o estado otimista local, que já é o desejado. Se uma das intermediárias falhar, o revert só aplica se a request com erro for a mais recente (compara contra `selections` atual antes de reverter).
- Timer vs finish manual: transação do backend resolve — primeiro ganha, segundo recebe 409, client trata como "já finalizado" + refresh.

---

## 7. Tratamento de Erros e Edge Cases

| Cenário | Server | UI |
|---|---|---|
| Pool < count no generate | 422 | Inline no form |
| Exam não é do usuário / não existe | 404 | `notFound()` |
| PATCH question em exam FINISHED | 409 | Toast + revert otimista |
| PATCH finish em exam FINISHED | 409 | `router.refresh()` (mostra relatório) |
| Alternativa não pertence à questão | 400 | Toast |
| Body inválido | 400 + `fields` | Inline no form |

**Notáveis:**
- Não-respondidas contam como erro no score mas **não geram linha em `AnswerHistory`** (campo `alternativeId` é NOT NULL).
- Finalização sem nenhuma resposta: score 0.0, zero linhas em `AnswerHistory`, relatório renderiza normalmente.
- Múltiplas abas do mesmo exam: último write ganha; sem locking no MVP.

**Deliberadamente fora de escopo:**
- Retry de exam finalizado (cria novo).
- Cancelar/deletar exam em andamento.
- Export PDF/JSON (SPECS §9 passo 10 — projeto separado).
- Notificações de timer.

---

## 8. Estratégia de Testes (TDD)

### Integração (`apps/web/__tests__/integration/`)

| Arquivo | Cobre |
|---|---|
| `exams-generate.test.ts` | Happy path, Zod inválido, pool insuficiente (422), filtros aplicados. |
| `exams-get.test.ts` | IN_PROGRESS shape (sem gabarito), FINISHED shape (com tudo), 404 cross-user, 404 inexistente. |
| `exams-patch-question.test.ts` | Salva selection, desmarca com null, 409 em FINISHED, 400 alternativa inválida, 404 cross-user. |
| `exams-finish.test.ts` | Score correto (todas certas/mix/todas erradas/com nulls), AnswerHistory criado só pras respondidas, status/finishedAt setados, 409 se já finalizado. |

### Unitários (`apps/web/__tests__/unit/`)

| Arquivo | Cobre |
|---|---|
| `exam-schemas.test.ts` | Zod: `generateExamSchema` (ranges), `finishExamSchema`. |
| `exam-score.test.ts` | Função pura de cálculo de score (edge cases). |

### Regressão
- Smoke: responder questão no banco → simulado com mesma questão → `getPreviousAnswer` retorna a do simulado (última por `createdAt`).

### Fora de escopo
- Componentes React (projeto não tem `@testing-library/react`). Validação via `pnpm dev` no browser.

---

## 9. Ordem de Implementação

1. Migração Prisma (`timeLimit`, `selectedAlternativeId`).
2. Testes + implementação POST `/generate`.
3. Testes + implementação GET `/[id]`.
4. Testes + implementação PATCH `/[id]/questions/[qid]`.
5. Testes + implementação PATCH `/[id]/finish`.
6. Regen Kubb (openapi + hooks).
7. `AlternativeRow` ganha fase `"exam-active"`.
8. `NewExamForm` + página `/exams`.
9. `ExamRunner` + filhos (timer, palette, panel, dialog) + página `/exams/[id]` roteando.
10. `ExamReport` + `ExamReportItem` (mesma página).
11. Smoke test end-to-end no browser (criar → responder → navegar → finalizar → revisar).
