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
});

export type CsvRow = z.infer<typeof csvRowSchema>;
