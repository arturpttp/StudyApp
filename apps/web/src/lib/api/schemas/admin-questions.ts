import { z } from "zod";

const alternativeSchema = z.object({
  text: z.string().min(1, "Texto obrigatório."),
  isCorrect: z.boolean(),
  position: z.number().int().min(0),
});

export const createAdminQuestionBodySchema = z
  .object({
    statement: z.string().min(10, "Enunciado muito curto."),
    explanation: z.string().optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    year: z.number().int().min(1900).max(2100).optional(),
    subjectId: z.string().optional(),
    institutionId: z.string().min(1, "Instituição obrigatória."),
    topicIds: z.array(z.string()).default([]),
    newTopicNames: z.array(z.string().min(1)).default([]),
    alternatives: z.array(alternativeSchema).min(2).max(6),
  })
  .refine((data) => data.topicIds.length + data.newTopicNames.length >= 1, {
    message: "Pelo menos uma matéria é obrigatória.",
    path: ["topicIds"],
  })
  .refine(
    (data) => data.alternatives.filter((a) => a.isCorrect).length === 1,
    {
      message: "Exatamente uma alternativa deve estar marcada como correta.",
      path: ["alternatives"],
    },
  )
  .refine(
    (data) =>
      new Set(data.alternatives.map((a) => a.position)).size ===
      data.alternatives.length,
    { message: "Posições duplicadas.", path: ["alternatives"] },
  );

export type CreateAdminQuestionBody = z.infer<
  typeof createAdminQuestionBodySchema
>;
