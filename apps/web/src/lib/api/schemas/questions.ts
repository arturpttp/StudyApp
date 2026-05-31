import { z } from "zod";

const topicIdsSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  });

export const questionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  subjectId: z.string().optional(),
  institutionId: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  year: z.coerce.number().int().optional(),
  unanswered: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  topicIds: topicIdsSchema,
  topicMatchMode: z.enum(["any", "all"]).optional().default("any"),
});

export type QuestionsQuery = z.infer<typeof questionsQuerySchema>;

export const randomQuerySchema = z.object({
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
});

export type RandomQuery = z.infer<typeof randomQuerySchema>;

export const answerBodySchema = z.object({
  alternativeId: z.string().min(1, "alternativeId é obrigatório."),
  responseTime: z.number().int().min(0).optional().default(0),
});

export type AnswerBody = z.infer<typeof answerBodySchema>;
