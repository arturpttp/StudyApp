import { z } from "zod";

const topicIdsSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  });

export const flashcardsQuerySchema = z.object({
  dueOnly: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  topicIds: topicIdsSchema,
});

export type FlashcardsQuery = z.infer<typeof flashcardsQuerySchema>;

export const createFlashcardBodySchema = z.object({
  front: z.string().min(1, "Front é obrigatório."),
  back: z.string().min(1, "Back é obrigatório."),
  topicIds: z.array(z.string()).default([]),
  questionId: z.string().optional(),
});

export type CreateFlashcardBody = z.infer<typeof createFlashcardBodySchema>;

export const updateFlashcardBodySchema = z.object({
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  topicIds: z.array(z.string()).optional(),
});

export type UpdateFlashcardBody = z.infer<typeof updateFlashcardBodySchema>;

export const reviewFlashcardBodySchema = z.object({
  rating: z.union([
    z.literal(0),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
});

export type ReviewFlashcardBody = z.infer<typeof reviewFlashcardBodySchema>;
