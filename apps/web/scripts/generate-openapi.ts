import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// --- Shared component schemas ---

const SubjectSchema = registry.register(
  "Subject",
  z.object({ id: z.string(), name: z.string() }),
);

const InstitutionSchema = registry.register(
  "Institution",
  z.object({ id: z.string(), name: z.string() }),
);

const AlternativeSchema = registry.register(
  "Alternative",
  z.object({ id: z.string(), text: z.string(), position: z.number().int() }),
);

const TopicSchema = registry.register(
  "Topic",
  z.object({ id: z.string(), name: z.string() }),
);

const FlashcardSchema = registry.register(
  "Flashcard",
  z.object({
    id: z.string(),
    front: z.string(),
    back: z.string(),
    easeFactor: z.number(),
    interval: z.number().int(),
    repetitions: z.number().int(),
    lastReview: z.string().datetime().nullable(),
    nextReview: z.string().datetime(),
    questionId: z.string().nullable(),
    createdAt: z.string().datetime(),
    topics: z.array(TopicSchema),
  }),
);

const QuestionSchema = registry.register(
  "Question",
  z.object({
    id: z.string(),
    statement: z.string(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    year: z.number().int().nullable(),
    subject: SubjectSchema.nullable(),
    institution: InstitutionSchema,
    alternatives: z.array(AlternativeSchema),
    topics: z.array(TopicSchema),
  }),
);

const ErrorSchema = registry.register(
  "Error",
  z.object({
    error: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
);

// --- Route: GET /api/v1/subjects ---

registry.registerPath({
  method: "get",
  path: "/api/v1/subjects",
  summary: "Listar especialidades",
  responses: {
    200: {
      description: "Lista de especialidades",
      content: { "application/json": { schema: z.array(SubjectSchema) } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/topics ---

registry.registerPath({
  method: "get",
  path: "/api/v1/topics",
  summary: "Listar matérias",
  responses: {
    200: {
      description: "Lista de matérias",
      content: { "application/json": { schema: z.array(TopicSchema) } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/institutions ---

registry.registerPath({
  method: "get",
  path: "/api/v1/institutions",
  summary: "Listar instituições",
  responses: {
    200: {
      description: "Lista de instituições",
      content: { "application/json": { schema: z.array(InstitutionSchema) } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/questions ---

registry.registerPath({
  method: "get",
  path: "/api/v1/questions",
  summary: "Listar questões com filtros",
  request: {
    query: z.object({
      page: z.coerce.number().int().min(1).default(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
      subjectId: z.string().optional(),
      institutionId: z.string().optional(),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
      year: z.coerce.number().int().optional(),
      unanswered: z.enum(["true", "false"]).optional(),
      topicIds: z.array(z.string()).optional(),
      topicMatchMode: z.enum(["any", "all"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "Lista paginada de questões",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(QuestionSchema),
            total: z.number().int(),
            page: z.number().int(),
            limit: z.number().int(),
          }),
        },
      },
    },
    400: {
      description: "Parâmetros inválidos",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/questions/random ---

registry.registerPath({
  method: "get",
  path: "/api/v1/questions/random",
  summary: "Questão aleatória",
  request: {
    query: z.object({
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "Uma questão aleatória",
      content: { "application/json": { schema: QuestionSchema } },
    },
    404: {
      description: "Nenhuma questão encontrada",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/questions/{id} ---

registry.registerPath({
  method: "get",
  path: "/api/v1/questions/{id}",
  summary: "Detalhe da questão",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Detalhe da questão (sem isCorrect)",
      content: { "application/json": { schema: QuestionSchema } },
    },
    404: {
      description: "Questão não encontrada",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: POST /api/v1/questions/{id}/answer ---

registry.registerPath({
  method: "post",
  path: "/api/v1/questions/{id}/answer",
  summary: "Enviar resposta",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            alternativeId: z.string().min(1),
            responseTime: z.number().int().min(0).optional().default(0),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Resultado da resposta",
      content: {
        "application/json": {
          schema: z.object({
            isCorrect: z.boolean(),
            correctAlternativeId: z.string(),
            explanation: z.string().nullable(),
          }),
        },
      },
    },
    400: {
      description: "Dados inválidos",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Questão não encontrada",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Exam schemas ---

const ExamAlternativeSchema = registry.register(
  "ExamAlternative",
  z.object({ id: z.string(), text: z.string(), position: z.number().int() }),
);

const ExamQuestionActiveSchema = registry.register(
  "ExamQuestionActive",
  z.object({
    questionId: z.string(),
    order: z.number().int(),
    statement: z.string(),
    alternatives: z.array(ExamAlternativeSchema),
    selectedAlternativeId: z.string().nullable(),
  }),
);

const ExamQuestionReportSchema = registry.register(
  "ExamQuestionReport",
  z.object({
    questionId: z.string(),
    order: z.number().int(),
    statement: z.string(),
    explanation: z.string().nullable(),
    alternatives: z.array(ExamAlternativeSchema),
    selectedAlternativeId: z.string().nullable(),
    correctAlternativeId: z.string(),
    isCorrect: z.boolean(),
  }),
);

const ExamInProgressSchema = registry.register(
  "ExamInProgress",
  z.object({
    id: z.string(),
    status: z.literal("IN_PROGRESS"),
    timeLimit: z.number().int().nullable(),
    createdAt: z.string().datetime(),
    questions: z.array(ExamQuestionActiveSchema),
  }),
);

const ExamFinishedSchema = registry.register(
  "ExamFinished",
  z.object({
    id: z.string(),
    status: z.literal("FINISHED"),
    score: z.number(),
    timeLimit: z.number().int().nullable(),
    createdAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
    questions: z.array(ExamQuestionReportSchema),
  }),
);

// --- Route: POST /api/v1/exams/generate ---

registry.registerPath({
  method: "post",
  path: "/api/v1/exams/generate",
  summary: "Gerar simulado",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            subjectId: z.string().optional(),
            difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
            count: z.number().int().min(5).max(100),
            timeLimit: z.number().int().min(5).max(600).nullable().optional(),
            topicIds: z.array(z.string()).optional(),
            topicMatchMode: z.enum(["any", "all"]).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Simulado criado",
      content: {
        "application/json": { schema: z.object({ id: z.string() }) },
      },
    },
    400: {
      description: "Dados inválidos",
      content: { "application/json": { schema: ErrorSchema } },
    },
    422: {
      description: "Pool insuficiente",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/exams/{id} ---

registry.registerPath({
  method: "get",
  path: "/api/v1/exams/{id}",
  summary: "Buscar simulado (ativo ou finalizado)",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Estado do simulado",
      content: {
        "application/json": {
          schema: z.union([ExamInProgressSchema, ExamFinishedSchema]),
        },
      },
    },
    404: {
      description: "Simulado não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: PATCH /api/v1/exams/{id}/questions/{questionId} ---

registry.registerPath({
  method: "patch",
  path: "/api/v1/exams/{id}/questions/{questionId}",
  summary: "Atualizar seleção de alternativa",
  request: {
    params: z.object({ id: z.string(), questionId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            alternativeId: z.string().min(1).nullable(),
          }),
        },
      },
    },
  },
  responses: {
    204: { description: "Seleção salva" },
    400: {
      description: "Dados inválidos",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Simulado já finalizado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: PATCH /api/v1/exams/{id}/finish ---

registry.registerPath({
  method: "patch",
  path: "/api/v1/exams/{id}/finish",
  summary: "Finalizar simulado",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Relatório final",
      content: { "application/json": { schema: ExamFinishedSchema } },
    },
    404: {
      description: "Simulado não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Simulado já finalizado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: POST /api/v1/admin/questions ---
registry.registerPath({
  method: "post",
  path: "/api/v1/admin/questions",
  summary: "Cadastrar pergunta (admin)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            statement: z.string().min(10),
            explanation: z.string().optional(),
            difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
            year: z.number().int().optional(),
            subjectId: z.string().optional(),
            institutionId: z.string(),
            topicIds: z.array(z.string()),
            newTopicNames: z.array(z.string()),
            alternatives: z.array(
              z.object({
                text: z.string(),
                isCorrect: z.boolean(),
                position: z.number().int(),
              }),
            ),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Pergunta criada",
      content: { "application/json": { schema: z.object({ id: z.string() }) } },
    },
    400: {
      description: "Dados inválidos",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Acesso restrito",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Recurso não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/flashcards ---
registry.registerPath({
  method: "get",
  path: "/api/v1/flashcards",
  summary: "Listar flashcards",
  request: {
    query: z.object({
      dueOnly: z.enum(["true", "false"]).optional(),
      topicIds: z.array(z.string()).optional(),
    }),
  },
  responses: {
    200: {
      description: "Lista de flashcards do usuário",
      content: { "application/json": { schema: z.array(FlashcardSchema) } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: POST /api/v1/flashcards ---
registry.registerPath({
  method: "post",
  path: "/api/v1/flashcards",
  summary: "Criar flashcard",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            front: z.string().min(1),
            back: z.string().min(1),
            topicIds: z.array(z.string()).optional(),
            questionId: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Flashcard criado",
      content: { "application/json": { schema: z.object({ id: z.string() }) } },
    },
    400: {
      description: "Dados inválidos",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Recurso não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/flashcards/{id} ---
registry.registerPath({
  method: "get",
  path: "/api/v1/flashcards/{id}",
  summary: "Buscar flashcard",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Flashcard",
      content: { "application/json": { schema: FlashcardSchema } },
    },
    404: {
      description: "Flashcard não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: PATCH /api/v1/flashcards/{id} ---
registry.registerPath({
  method: "patch",
  path: "/api/v1/flashcards/{id}",
  summary: "Atualizar flashcard",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            front: z.string().min(1).optional(),
            back: z.string().min(1).optional(),
            topicIds: z.array(z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    204: { description: "Atualizado" },
    400: {
      description: "Dados inválidos",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: DELETE /api/v1/flashcards/{id} ---
registry.registerPath({
  method: "delete",
  path: "/api/v1/flashcards/{id}",
  summary: "Excluir flashcard",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: "Excluído" },
    404: {
      description: "Não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: PATCH /api/v1/flashcards/{id}/review ---
registry.registerPath({
  method: "patch",
  path: "/api/v1/flashcards/{id}/review",
  summary: "Revisar flashcard (SM-2)",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            rating: z.union([
              z.literal(0),
              z.literal(3),
              z.literal(4),
              z.literal(5),
            ]),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Estado pós-revisão",
      content: { "application/json": { schema: FlashcardSchema } },
    },
    400: {
      description: "Rating inválido",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const StatsOverviewSchema = registry.register(
  "StatsOverview",
  z.object({
    totalAnswered: z.number().int(),
    totalCorrect: z.number().int(),
    accuracyAll: z.number().int(),
    totalAnsweredWeek: z.number().int(),
    accuracyWeek: z.number().int(),
    currentStreak: z.number().int(),
  }),
);

const StatsTopicEntrySchema = registry.register(
  "StatsTopicEntry",
  z.object({
    topicId: z.string(),
    topicName: z.string(),
    answered: z.number().int(),
    correct: z.number().int(),
    accuracy: z.number().int(),
  }),
);

const StatsExamsSchema = registry.register(
  "StatsExams",
  z.object({
    totalFinished: z.number().int(),
    avgScore: z.number().int(),
    bestScore: z.number().int(),
    scores: z.array(
      z.object({
        examId: z.string(),
        date: z.string().datetime(),
        score: z.number().int(),
      }),
    ),
  }),
);

// --- Route: GET /api/v1/stats/overview ---
registry.registerPath({
  method: "get",
  path: "/api/v1/stats/overview",
  summary: "Overview de estudo",
  responses: {
    200: {
      description: "Resumo geral + semanal + streak",
      content: { "application/json": { schema: StatsOverviewSchema } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/stats/by-topic ---
registry.registerPath({
  method: "get",
  path: "/api/v1/stats/by-topic",
  summary: "Acurácia por matéria (top 8)",
  responses: {
    200: {
      description: "Lista de matérias com contagem + acurácia",
      content: { "application/json": { schema: z.array(StatsTopicEntrySchema) } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/stats/exams ---
registry.registerPath({
  method: "get",
  path: "/api/v1/stats/exams",
  summary: "Estatísticas dos simulados",
  responses: {
    200: {
      description: "KPIs + scores por data",
      content: { "application/json": { schema: StatsExamsSchema } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Generate ---

const generator = new OpenApiGeneratorV31(registry.definitions);
const doc = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "HealthQuest API",
    version: "1.0.0",
    description: "API para plataforma de estudos em saúde",
  },
  servers: [{ url: "http://localhost:3000" }],
});

const output = resolve(import.meta.dirname, "../openapi.json");
writeFileSync(output, JSON.stringify(doc, null, 2));
console.log(`OpenAPI spec written to ${output}`);
