import {
  DefaultHistoricalExecutionService,
  type HistoricalExecution,
} from "@/efos/application/history";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { createClient } from "@/lib/supabase/server";

/**
 * Mission 204 — histórico canônico de análises de uma empresa (mais antiga
 * primeiro), pelo mesmo serviço que já alimenta `GET /api/efos/history`.
 * Leitura sob RLS da sessão atual; nenhuma escrita.
 */
export async function getExecutiveHistory(companyId: string): Promise<readonly HistoricalExecution[]> {
  const supabase = await createClient();
  const service = new DefaultHistoricalExecutionService(
    new SupabaseExecutionRepository(new SupabasePersistenceClient(supabase))
  );
  return service.getHistory(companyId);
}
