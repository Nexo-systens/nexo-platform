import { createClient } from "@/lib/supabase/server";
import type { SignupInput } from "@/modules/auth/validators/auth.schemas";

/**
 * Camada de servico do modulo Auth (docs/06_BACKEND.md secao 2.4): encapsula
 * toda chamada ao Supabase Auth. Server Actions nunca chamam o Supabase
 * diretamente, sempre atraves deste service.
 */

export async function signInWithPassword(email: string, password: string) {
  const supabase = await createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(
  input: Pick<SignupInput, "email" | "password" | "fullName">,
  emailRedirectTo: string
) {
  const supabase = await createClient();
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName },
      emailRedirectTo,
    },
  });
}

export async function signOut() {
  const supabase = await createClient();
  return supabase.auth.signOut();
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  const supabase = await createClient();
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function updatePassword(password: string) {
  const supabase = await createClient();
  return supabase.auth.updateUser({ password });
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
