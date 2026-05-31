import { z } from "zod";

export const generateExamBodySchema = z.object({
  subjectId: z.string().min(1).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  count: z.number().int().min(5).max(100),
  timeLimit: z.number().int().min(5).max(600).nullable().optional(),
  topicIds: z.array(z.string()).optional().default([]),
  topicMatchMode: z.enum(["any", "all"]).optional().default("any"),
});

export type GenerateExamBody = z.infer<typeof generateExamBodySchema>;

export const patchExamQuestionBodySchema = z.object({
  alternativeId: z.string().min(1).nullable(),
});

export type PatchExamQuestionBody = z.infer<typeof patchExamQuestionBodySchema>;
