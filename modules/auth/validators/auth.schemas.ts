import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, { error: "A senha deve ter pelo menos 8 caracteres." })
  .regex(/[a-zA-Z]/, { error: "A senha deve conter ao menos uma letra." })
  .regex(/[0-9]/, { error: "A senha deve conter ao menos um número." });

export const loginSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }),
  password: z.string().min(1, { error: "Informe sua senha." }),
});

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { error: "Informe seu nome completo." }),
    email: z.email({ error: "Informe um e-mail válido." }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
