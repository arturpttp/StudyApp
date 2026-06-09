# Export (PDF + JSON) — Design

**Date:** 2026-05-31
**Status:** Approved (pending spec review)

## Summary

Implements step 10 of the HealthQuest development sequence — client-side export of three datasets: exam reports, stats snapshots (both PDF + JSON), and answer history (JSON only). PDFs generated in the browser with jsPDF; charts captured as PNG via html2canvas. One new endpoint serves the answer history; everything else uses data already on the relevant page.

## Goals

1. From `/exams/[id]` (when status FINISHED), download the report as PDF or JSON.
2. From `/stats`, download the stats snapshot as PDF or JSON, and the answer-history log as JSON.
3. PDFs styled enough to be presentable; JSONs versioned for forward compatibility.
4. No backend processing for PDF/JSON generation; minimal new server code (one read endpoint).

## Non-Goals (deferred)

- **PDF of answer history** — long temporal logs make poor PDFs.
- **Import of exported JSON** (round-trip).
- **Flashcard exports** — deferred until `FlashcardReview` log exists.
- **Filtered exports** (e.g., "stats from last 30 days").
- **Async/server-side PDF for huge datasets** — not needed at the user volumes expected.
- **Custom PDF branding** (logos, fonts per user).
- **Bundled zip download** ("export tudo de uma vez").

## Data Model

No schema changes. The new endpoint reads from existing tables (`AnswerHistory`, `Question`, `Alternative`, `Exam`).

## API

### New: `GET /api/v1/history/answers`

Requires auth. Scoped to `userId = session.user.id`.

Response: `Array<AnswerHistoryEntry>` ordered by `createdAt desc`:

```ts
{
  id: string,
  createdAt: string,           // ISO datetime
  isCorrect: boolean,
  responseTime: number,
  question: {
    id: string,
    statement: string,
    difficulty: "EASY" | "MEDIUM" | "HARD",
  },
  alternative: {
    id: string,
    text: string,
    position: number,
  },
  examId: string | null,       // present if the answer came from an exam finish
}
```

- No pagination — answer history is downloaded as one file. Realistic ceiling thousands of rows; acceptable single-query.
- The `examId` is derived: query `ExamQuestion` for rows matching `(userId, questionId)` and `selectedAlternativeId === alternativeId`; pick the most recently `finishedAt`. For MVP, simpler heuristic: `examId` only set when an `Exam` references this `AnswerHistory` row directly. Since the current schema does not have an FK from `AnswerHistory` to `Exam`, **scope the field out** — return `examId: null` always. Documented as future enhancement.

Updated response after that simplification:

```ts
{
  id: string,
  createdAt: string,
  isCorrect: boolean,
  responseTime: number,
  question: { id, statement, difficulty },
  alternative: { id, text, position },
}
```

(`examId` removed.)

## Pure modules (`apps/web/src/lib/export/`)

| File | Export | Signature / purpose |
|---|---|---|
| `download.ts` | `downloadBlob(blob: Blob, filename: string): void` | Creates `<a>` with `URL.createObjectURL`, triggers click, revokes URL. |
| `filename.ts` | `formatExportFilename(prefix: string, ext: "pdf" \| "json", now: Date): string` | Returns `prefix-YYYYMMDD-HHmm.ext` with UTC time padded. |
| `capture.ts` | `captureElementAsPng(el: HTMLElement): Promise<string>` | Wraps `html2canvas`, returns `dataURL` ready for `jsPDF.addImage`. |
| `exam-json.ts` | `buildExamJson(exam: ExamReportData): string` | Returns serialized JSON with envelope (below). |
| `stats-json.ts` | `buildStatsJson(overview, byTopic, exams): string` | Same envelope, type `"stats-snapshot"`. |
| `history-json.ts` | `buildHistoryJson(answers): string` | Same envelope, type `"answer-history"`. |
| `exam-pdf.ts` | `buildExamPdf(exam: ExamReportData): Blob` | jsPDF: header + KPI block + per-question section. |
| `stats-pdf.ts` | `buildStatsPdf(overview, byTopic, exams, charts: { radar?: string; line?: string }): Blob` | jsPDF: KPIs + tables + optional chart images. |

### JSON envelope

All exports share:

```ts
{
  exportType: "exam-report" | "stats-snapshot" | "answer-history",
  version: 1,
  generatedAt: string,         // ISO
  data: <type-specific payload>,
}
```

Justification: a `version` field lets us evolve the schema without breaking downstream tools or users with archived files.

### `ExamReportData` shape (input to exam exports)

```ts
{
  id: string,
  status: "FINISHED",
  score: number,               // 0–100, integer
  createdAt: string,
  finishedAt: string,
  questions: Array<{
    questionId: string,
    order: number,
    statement: string,
    explanation: string | null,
    alternatives: { id, text, position }[],
    selectedAlternativeId: string | null,
    correctAlternativeId: string,
    isCorrect: boolean,
  }>,
}
```

Same shape the `/exams/[id]` page already builds for `ExamReport` rendering — reuse the page's existing data prep, lift into a helper `buildExamReportData(exam)` so it can feed both the React component and the exporter.

### PDF layouts

**Exam PDF** (A4 portrait, jsPDF unit `pt`):
1. Header: "Relatório de Simulado", date generated, exam id (short).
2. Summary block: pontuação, total, acertos, duração.
3. For each question:
   - "Questão N" + statement.
   - Alternatives list with letter prefix; correct one marked `[✓]`; user-selected (if wrong) marked `[✗]`.
   - Explanation paragraph if present.
   - Page break if needed (jsPDF auto-paging via `splitTextToSize` + manual `addPage` checks).

**Stats PDF** (A4 portrait):
1. Header: "Snapshot de Estatísticas", date.
2. KPI block (Respondidas / Acerto / Streak / Semana).
3. Section "Acurácia por matéria": optional radar image (if present in `charts.radar`), followed by table `Matéria | Respondidas | Acertos | %`.
4. Section "Simulados": KPI line (Total / Média / Melhor), then optional line chart image, then table `Data | Pontuação`.

Both PDFs use a single body font (jsPDF Helvetica is built-in; no font upload needed).

## UI

### Exam page (`apps/web/src/app/(app)/exams/[id]/page.tsx`)

When `exam.status === "FINISHED"`, mount a new client component `ExportExamButtons` next to or below the existing report header. Renders two buttons:

```
[ Baixar PDF ] [ Baixar JSON ]
```

Both consume the same `ExamReportData` (passed as prop from the server page).

### Stats page (`apps/web/src/app/(app)/stats/page.tsx`)

Mount a new client component `ExportStatsButtons` near the top header. Renders three buttons in a row:

```
[ Stats PDF ] [ Stats JSON ] [ Histórico JSON ]
```

`ExportStatsButtons` holds:
- Refs (via `useRef`) for the radar and line containers, passed down to `TopicRadar` and `ExamScoreLine`.
- On "Stats PDF" click: capture both refs (if present and non-empty data) to PNG, build PDF, download.
- On "Stats JSON" click: serialize and download.
- On "Histórico JSON" click: fetch `/api/v1/history/answers`, then build and download.

The chart components (`TopicRadar`, `ExamScoreLine`) gain an optional `containerRef?: Ref<HTMLDivElement>` prop forwarded to the outer wrapper `<div>`.

### Buttons styling

Reuse the existing `Button` component (`variant="outline"` for the secondary feel). All wrapped in a `flex flex-wrap gap-2` container. Disabled state shows spinner-style text ("Gerando...") while async work runs.

### Empty-state handling

- Exam page: buttons only shown when status FINISHED.
- Stats page:
  - "Stats PDF" / "Stats JSON" disabled if `overview.totalAnswered === 0` (nothing to export).
  - "Histórico JSON" disabled if `overview.totalAnswered === 0`.

## OpenAPI / Kubb

Register one new route in `apps/web/scripts/generate-openapi.ts`:

```ts
const AnswerHistoryEntrySchema = registry.register(
  "AnswerHistoryEntry",
  z.object({
    id: z.string(),
    createdAt: z.string().datetime(),
    isCorrect: z.boolean(),
    responseTime: z.number().int(),
    question: z.object({
      id: z.string(),
      statement: z.string(),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    }),
    alternative: z.object({
      id: z.string(),
      text: z.string(),
      position: z.number().int(),
    }),
  }),
);

// GET /api/v1/history/answers
```

Regenerate Kubb hook (used by `ExportStatsButtons` for the history fetch).

## Dependencies

Add to `apps/web/package.json`:

```json
"jspdf": "^3.0.0",
"html2canvas": "^1.4.1"
```

## Tests

### Unit (pure)
- `__tests__/unit/export-filename.test.ts` — `formatExportFilename` with fixed `now`: prefix simples, padding (e.g., month=`07`), extension preserved.
- `__tests__/unit/export-exam-json.test.ts` — envelope shape (`exportType: "exam-report"`, `version: 1`, ISO `generatedAt`, payload mirror), deterministic with given input.
- `__tests__/unit/export-stats-json.test.ts` — same checks for stats envelope.
- `__tests__/unit/export-history-json.test.ts` — same for history envelope.

### Integration (real Postgres, prefix `__test_export_`)
- `history-answers.test.ts` — GET returns user's answers sorted desc, includes nested question/alternative, 401 unauthenticated, cross-user isolation, empty array for new user.

### Manual smoke
Generate one of each export and verify file opens correctly in OS viewer.

## Risks & open questions

- **html2canvas + recharts SVG:** captures may render off on Firefox due to CSS variables in SVG. Tested workaround: ensure the container has the resolved color (we already use CSS vars). If broken, fallback is to serialize the SVG directly via `XMLSerializer` + canvas — documented as a follow-up.
- **Long exam reports:** PDF auto-paging in jsPDF needs explicit `addPage()` checks every section. Helper `withPageBreak(doc, y, needed)` ensures `y + needed < pageHeight` else `addPage`. Implementation detail in `exam-pdf.ts`.
- **`generatedAt` in JSON:** non-deterministic, complicates testing. Solution: `buildXJson` takes optional `now` arg defaulting to `new Date()`. Tests pass a fixed date.
- **Endpoint cost:** answer history grows linearly. At thousands of rows the JSON download is fine; at hundreds of thousands, response time and payload could be issues. Not expected in MVP.
- **PNG quality:** html2canvas defaults to 1× device pixel ratio. Set `scale: 2` for a sharper export. Increases PNG size; acceptable.

## Out of scope (future iterations)

- Bidirectional sync (import).
- Bundled "exportar tudo" zip.
- Server-side puppeteer for higher-fidelity PDFs.
- Localized date formatting beyond pt-BR.
- Email-the-export workflow.
- E2E test of PDF binary integrity (not worth the brittleness).
