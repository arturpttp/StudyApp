import { z } from "zod";

export const csvRowSchema = z.object({
  externalId: z.string().min(1),
  institution: z.string().min(1),
  subject: z.string().min(1),
  year: z
    .string()
    .regex(/^\d{4}$|^$/)
    .transform((v) => (v === "" ? null : Number(v))),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  statement: z.string().min(10),
  a: z.string().min(1),
  b: z.string().min(1),
  c: z.string().min(1),
  d: z.string().min(1),
  e: z.string().min(1),
  correct: z.enum(["a", "b", "c", "d", "e"]),
  explanation: z.string().min(10),
  topics: z
    .string()
    .min(1, "Pelo menos uma matéria é obrigatória.")
    .transform((v) =>
      v
        .split(";")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    )
    .refine((arr) => arr.length >= 1, {
      message: "Pelo menos uma matéria é obrigatória.",
    }),
});

export type CsvRow = z.infer<typeof csvRowSchema>;
