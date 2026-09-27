import { isUuid } from "@/lib/identifiers";
import { queryFailure } from "@/lib/supabase/query-error";
import { createClient } from "@/lib/supabase/server";
import type {
  CompanySize,
  CompanyStatus,
  CompanyTaxRegime,
  Database,
} from "@/types/database";
import type { CompanyListFilters } from "@/modules/companies/validators/company.schemas";

export type Company = Database["public"]["Tables"]["companies"]["Row"];

const PAGE_SIZE = 10;

const SORT_COLUMN_MAP: Record<CompanyListFilters["sort"], string> = {
  razao_social: "razao_social",
  created_at: "created_at",
  cnpj: "cnpj",
};

export interface CompanyListResult {
  companies: Company[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CompanyMutationInput {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: CompanyTaxRegime | null;
  cnae: string | null;
  segmento: string | null;
  porte: CompanySize | null;
  dataAbertura: string | null;
  observacoes: string | null;
}

// PostgREST exige que valores usados dentro de .or() sejam entre aspas
// duplas quando podem conter caracteres especiais (virgula, parenteses),
// senao o termo de busca do usuario pode quebrar a sintaxe do filtro.
function escapeOrFilterValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/**
 * Camada de servico do modulo Empresas (docs/06_BACKEND.md secao 2.4).
 * Unica camada que toca o Supabase; isolamento por usuario e garantido
 * pelo RLS de public.companies, nao por filtros manuais aqui.
 */
export async function listCompanies(
  filters: CompanyListFilters
): Promise<CompanyListResult> {
  const supabase = await createClient();

  let query = supabase
    .from("companies")
    .select("*", { count: "exact" })
    .is("deleted_at", null);

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.q) {
    const pattern = escapeOrFilterValue(`%${filters.q}%`);
    query = query.or(
      `razao_social.ilike.${pattern},nome_fantasia.ilike.${pattern},cnpj.ilike.${pattern}`
    );
  }

  const column = SORT_COLUMN_MAP[filters.sort];
  query = query.order(column, { ascending: filters.order === "asc" });

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    companies: data ?? [],
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}

// Mission 200 (D-128): um id malformado nunca chega ao Postgres — mesmo
// resultado de um id inexistente/não autorizado (`null`), sem oráculo.
export async function getCompanyById(id: string): Promise<Company | null> {
  if (!isUuid(id)) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCompany(
  userId: string,
  input: CompanyMutationInput
): Promise<Company> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .insert({
      user_id: userId,
      razao_social: input.razaoSocial,
      nome_fantasia: input.nomeFantasia,
      cnpj: input.cnpj,
      regime_tributario: input.regimeTributario,
      cnae: input.cnae,
      segmento: input.segmento,
      porte: input.porte,
      data_abertura: input.dataAbertura,
      observacoes: input.observacoes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCompany(
  id: string,
  input: CompanyMutationInput
): Promise<Company> {
  // Mesmo desfecho de um id inexistente (`.single()` sem linha lança).
  if (!isUuid(id)) throw new Error("Empresa não encontrada.");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .update({
      razao_social: input.razaoSocial,
      nome_fantasia: input.nomeFantasia,
      cnpj: input.cnpj,
      regime_tributario: input.regimeTributario,
      cnae: input.cnae,
      segmento: input.segmento,
      porte: input.porte,
      data_abertura: input.dataAbertura,
      observacoes: input.observacoes,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setCompanyStatus(
  id: string,
  status: CompanyStatus
): Promise<void> {
  // Mesmo desfecho de um id inexistente: nenhuma linha afetada.
  if (!isUuid(id)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

export async function softDeleteCompany(id: string): Promise<void> {
  if (!isUuid(id)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export type ClosedCompany = Pick<Company, "id" | "razao_social" | "cnpj" | "deleted_at">;

/**
 * Mission 202 (D-130) — empresas ENCERRADAS do usuário (`deleted_at`
 * preenchido), candidatas à exclusão definitiva. O RLS de `companies`
 * já restringe ao próprio dono.
 */
export async function listClosedCompanies(): Promise<ClosedCompany[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, razao_social, cnpj, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export interface CompanyCounts {
  total: number;
  active: number;
  archived: number;
}

/**
 * Usa apenas contagens (head: true, sem baixar linhas). O filtro
 * `deleted_at is null` casa com o indice parcial companies_active_idx
 * (user_id, status) criado na Missao 4; nenhum indice novo e necessario.
 */
export async function getCompanyCounts(): Promise<CompanyCounts> {
  const supabase = await createClient();

  const [totalResult, activeResult, archivedResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "active"),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "archived"),
  ]);

  // Mission 203: o erro carrega status HTTP/código (antes: `{"message":""}` anônimo).
  if (totalResult.error) throw queryFailure("getCompanyCounts.total", totalResult);
  if (activeResult.error) throw queryFailure("getCompanyCounts.active", activeResult);
  if (archivedResult.error) throw queryFailure("getCompanyCounts.archived", archivedResult);

  return {
    total: totalResult.count ?? 0,
    active: activeResult.count ?? 0,
    archived: archivedResult.count ?? 0,
  };
}
