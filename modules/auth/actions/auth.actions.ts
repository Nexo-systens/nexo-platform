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

  const { error } = await signUpWithPassword(
    parsed.data,
    `${origin}/auth/confirm?next=/dashboard`
  );

  if (error) {
    const alreadyExists =
      error.code === "user_already_exists" || error.status === 422;

    return {
      status: "error",
      message: alreadyExists
        ? "Já existe uma conta com este e-mail."
        : "Não foi possível criar a conta. Tente novamente.",
    };
  }

  return {
    status: "success",
    message: "Conta criada. Verifique seu e-mail para confirmar o acesso.",
  };
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

  await requestPasswordReset(
    parsed.data.email,
    `${origin}/auth/confirm?next=/reset-password`
  );

  // Resposta sempre neutra: nunca revelar se o e-mail existe na base.
  return {
    status: "success",
    message:
      "Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes.",
  };
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
