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

const QuestionSchema = registry.register(
  "Question",
  z.object({
    id: z.string(),
    statement: z.string(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    year: z.number().int().nullable(),
    subject: SubjectSchema,
    institution: InstitutionSchema,
    alternatives: z.array(AlternativeSchema),
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
