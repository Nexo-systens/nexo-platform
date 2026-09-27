import type { SupabaseClient } from "@supabase/supabase-js";

import { parsePurgeDatabaseResult, type CompanyOffboardingPorts } from "@/modules/companies/lib/company-offboarding";
import {
  parseOffboardingRegistrationResult,
  parseOperatorPurgePreview,
  type OffboardingRegistrationPort,
  type OperatorPurgePreview,
} from "@/modules/companies/lib/operator-offboarding";
import { removeDocumentStorageObjects } from "@/modules/companies/services/company-offboarding.service";
import type { Database } from "@/types/database";

/**
 * Mission 202B (D-131) — portas da autoridade de offboarding do
 * operador, sempre com a SESSÃO DO PRÓPRIO OPERADOR. Nenhuma chave
 * privilegiada: cada RPC confere `is_offboarding_operator()` no banco,
 * e a remoção de arquivos usa a Storage API sob a policy do operador,
 * que só vale dentro da remoção em lote (sem download nem listagem).
 */

export async function isOffboardingOperator(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_offboarding_operator");
  if (error) throw error;
  return data === true;
}

export async function previewForOperator(
  supabase: SupabaseClient<Database>,
  companyId: string
): Promise<OperatorPurgePreview> {
  const { data, error } = await supabase.rpc("operator_preview_company_purge", { p_company_id: companyId });
  if (error) throw error;
  return parseOperatorPurgePreview(data);
}

export function createOffboardingRegistrationPort(supabase: SupabaseClient<Database>): OffboardingRegistrationPort {
  return {
    async register(companyId, reference, confirmation) {
      const { data, error } = await supabase.rpc("operator_register_offboarding", {
        p_company_id: companyId,
        p_reference: reference,
        p_confirmation: confirmation,
      });
      if (error) throw error;
      return parseOffboardingRegistrationResult(data);
    },
  };
}

export function createOperatorOffboardingPorts(supabase: SupabaseClient<Database>): CompanyOffboardingPorts {
  return {
    async preview(companyId) {
      const preview = await previewForOperator(supabase, companyId);
      if (!preview.found) return { found: false };
      return {
        found: true,
        closed: preview.closed,
        registered: preview.registered,
        confirmation: preview.confirmation,
        counts: preview.counts,
      };
    },

    async listStorageObjects(companyId) {
      const { data, error } = await supabase.rpc("operator_list_offboarding_storage_objects", {
        p_company_id: companyId,
      });
      if (error) throw error;
      return Array.isArray(data) ? data.filter((name): name is string => typeof name === "string") : [];
    },

    async removeStorageObjects(paths) {
      await removeDocumentStorageObjects(supabase, paths);
    },

    async purgeDatabase(companyId, confirmation) {
      const { data, error } = await supabase.rpc("operator_purge_closed_company", {
        p_company_id: companyId,
        p_confirmation: confirmation,
      });
      if (error) throw error;
      return parsePurgeDatabaseResult(data);
    },
  };
}
