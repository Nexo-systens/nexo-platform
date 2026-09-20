import { createClient } from "@/lib/supabase/server";

/**
 * Mission 195 — Founding Company Production Onboarding & First
 * Executive Value, Seção 35/36. Contagem simples de execuções já
 * persistidas de uma empresa (`public.executions`, Migration 006) —
 * o único sinal barato e canônico de "esta empresa já teve uma
 * análise financeira concluída alguma vez", usado por
 * `resolveActivationState()` (`modules/activation/`) para decidir se a
 * empresa já passou da fase de ativação/onboarding para o estado
 * maduro (Seção 39: "a company with existing analyses must NOT be
 * thrown back into onboarding"). Mesmo padrão de `count`/`head: true`
 * já usado por `countDocumentsByCompany`
 * (`modules/documents/services/document.service.ts`) — isolamento por
 * empresa/usuário garantido pelo mesmo RLS de `public.executions`
 * (`executions_select_own`, Migration 006), nenhum filtro manual
 * adicional. Nunca lê o conteúdo de nenhuma execução (`execution`/
 * `report` jsonb) — apenas quantas linhas existem.
 */
export async function countExecutionsByCompany(companyId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("executions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (error) throw error;
  return count ?? 0;
}
