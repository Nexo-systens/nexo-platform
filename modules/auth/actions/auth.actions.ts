"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/modules/auth/validators/auth.schemas";
import {
  requestPasswordReset,
  signInWithPassword,
  signOut as signOutService,
  signUpWithPassword,
  updatePassword as updatePasswordService,
} from "@/modules/auth/services/auth.service";
import type { AuthActionState } from "@/modules/auth/types";
import {
  classifyPasswordResetError,
  classifySignupError,
  logSuppressedAuthOutcome,
  PASSWORD_RESET_NEUTRAL_MESSAGE,
  PUBLIC_AUTH_MIN_DURATION_MS,
  SIGNUP_NEUTRAL_MESSAGE,
  withMinimumDuration,
} from "@/modules/auth/lib/public-auth-responses";

async function getOrigin() {
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await signInWithPassword(
    parsed.data.email,
    parsed.data.password
  );

  if (error) {
    return { status: "error", message: "E-mail ou senha incorretos." };
  }

  redirect("/dashboard");
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const origin = await getOrigin();

  // Mission 200 (D-127): a resposta nunca depende de o e-mail já ter
  // conta — nem pela mensagem, nem pelo status, nem (dentro do piso)
  // pelo tempo de resposta.
  const { error } = await withMinimumDuration(PUBLIC_AUTH_MIN_DURATION_MS, () =>
    signUpWithPassword(parsed.data, `${origin}/auth/confirm?next=/dashboard`)
  );

  const outcome = classifySignupError(error);
  if (outcome.kind === "actionable") {
    return { status: "error", message: outcome.message };
  }

  if (error) logSuppressedAuthOutcome("signup", error);

  return { status: "success", message: SIGNUP_NEUTRAL_MESSAGE };
}

export async function logout(): Promise<never> {
  await signOutService();
  redirect("/login");
}

export async function forgotPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const origin = await getOrigin();

  // Mission 200 (D-127): mesma resposta com ou sem conta; só erros que
  // independem da existência (formato, limite por IP, serviço
  // inalcançável) são exibidos — o resto é registrado no servidor.
  const { error } = await withMinimumDuration(PUBLIC_AUTH_MIN_DURATION_MS, () =>
    requestPasswordReset(parsed.data.email, `${origin}/auth/confirm?next=/reset-password`)
  );

  const outcome = classifyPasswordResetError(error);
  if (outcome.kind === "actionable") {
    return { status: "error", message: outcome.message };
  }

  if (error) logSuppressedAuthOutcome("password_reset", error);

  return { status: "success", message: PASSWORD_RESET_NEUTRAL_MESSAGE };
}

export async function resetPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await updatePasswordService(parsed.data.password);

  if (error) {
    return {
      status: "error",
      message:
        "Não foi possível atualizar a senha. Solicite um novo link de recuperação.",
    };
  }

  redirect("/login?reset=success");
}
