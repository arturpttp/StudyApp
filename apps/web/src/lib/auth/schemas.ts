import { z } from "zod";

export const registerSchema = z
  .object({
    name: z
      .string({ error: "Nome é obrigatório." })
      .trim()
      .min(1, "Nome é obrigatório.")
      .max(120, "Nome muito longo."),
    email: z
      .string({ error: "E-mail é obrigatório." })
      .email("E-mail inválido."),
    password: z
      .string({ error: "Senha é obrigatória." })
      .min(8, "A senha deve ter pelo menos 8 caracteres.")
      .regex(/[A-Za-z]/, "A senha deve conter pelo menos uma letra.")
      .regex(/\d/, "A senha deve conter pelo menos um número."),
    confirmPassword: z.string({
      error: "Confirmação de senha é obrigatória.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .string({ error: "E-mail é obrigatório." })
    .email("E-mail inválido."),
  password: z
    .string({ error: "Senha é obrigatória." })
    .min(1, "Senha é obrigatória."),
});

export type LoginInput = z.infer<typeof loginSchema>;
