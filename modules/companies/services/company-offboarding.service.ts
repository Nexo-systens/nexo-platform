import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseCompanyPurgePreview,
  parsePurgeDatabaseResult,
  type CompanyOffboardingPorts,
} from "@/modules/companies/lib/company-offboarding";
import { STORAGE_BUCKET } from "@/modules/documents/constants";
import type { Database } from "@/types/database";

const STORAGE_REMOVE_BATCH = 100;

/**
 * Mission 202 (D-130) — liga as portas de `runCompanyPurge()` a um
 * cliente Supabase com a SESSÃO DO PRÓPRIO USUÁRIO. Nenhuma chave
 * privilegiada: a prévia e a listagem rodam sob RLS, a remoção de
 * arquivos usa a Storage API (policy `documents_storage_delete_closed_company`)
 * e a purga do banco é a função `purge_closed_company`, que valida a
 * posse com `auth.uid()`.
 *
 * `remove()` da Storage API não devolve erro quando o RLS recusa um
 * objeto — por isso `runCompanyPurge()` sempre relista o prefixo antes
 * de purgar o banco.
 */
export function createCompanyOffboardingPorts(supabase: SupabaseClient<Database>): CompanyOffboardingPorts {
  return {
    async preview(companyId) {
      const { data, error } = await supabase.rpc("preview_company_purge", { p_company_id: companyId });
      if (error) throw error;
      return parseCompanyPurgePreview(data);
    },

    async listStorageObjects(companyId) {
      const { data, error } = await supabase.rpc("list_closed_company_storage_objects", {
        p_company_id: companyId,
      });
      if (error) throw error;
      return Array.isArray(data) ? data.filter((name): name is string => typeof name === "string") : [];
    },

    async removeStorageObjects(paths) {
      for (let start = 0; start < paths.length; start += STORAGE_REMOVE_BATCH) {
        const batch = paths.slice(start, start + STORAGE_REMOVE_BATCH);
        const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(batch);
        if (error) throw error;
      }
    },

    async purgeDatabase(companyId, confirmation) {
      const { data, error } = await supabase.rpc("purge_closed_company", {
        p_company_id: companyId,
        p_confirmation: confirmation,
      });
      if (error) throw error;
      return parsePurgeDatabaseResult(data);
    },
  };
}
