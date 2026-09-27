import { isUuid } from "@/lib/identifiers";

/**
 * Mission 202 — Tenant-Safe Company Offboarding & Data Purge (D-130).
 *
 * Orquestração ÚNICA da purga definitiva de uma empresa encerrada.
 * Storage e banco não compartilham transação, então a ordem é a
 * semântica de segurança:
 *
 *   1. identificador válido (D-128) e confirmação presente;
 *   2. prévia: a empresa existe para ESTE usuário e já está encerrada;
 *   3. Storage: lista os objetos da empresa, recusa qualquer caminho
 *      fora do prefixo exato `company/{companyId}/`, remove pela
 *      Storage API e confirma que o prefixo ficou vazio;
 *   4. banco: purga transacional (`purge_closed_company`), que também
 *      recusa se ainda houver objeto no prefixo;
 *   5. verificação: a prévia não encontra mais a empresa.
 *
 * Falha no Storage → o banco NÃO é purgado; a empresa continua
 * encerrada e a operação pode ser repetida. Falha no banco depois do
 * Storage → os dados estruturados continuam, a empresa continua
 * encerrada, e repetir a operação completa a purga (a listagem vazia
 * vira um no-op). Nunca se finge atomicidade entre os dois serviços.
 *
 * As portas são injetadas: o server action usa o cliente Supabase da
 * sessão do usuário (nunca `service_role`); os testes usam falhas
 * simuladas e o Supabase local real.
 *
 * Mission 202B (D-131): a MESMA orquestração serve às duas autoridades
 * do ciclo de vida — o dono (portas da sessão do dono) e o operador de
 * offboarding (portas do operador). Quando a prévia informa
 * `registered: false` (autoridade do operador sem solicitação
 * registrada), nada é tocado.
 */

export const COMPANY_PURGE_RESOURCES = [
  "storage_objects",
  "documents",
  "executions",
  "executive_diagnoses",
  "diagnosis_reviews",
  "decisions",
  "decision_execution_events",
  "decision_outcomes",
  "financial_observations",
  "learning_records",
  "knowledge_records",
  "knowledge_evaluations",
] as const;

export type CompanyPurgeResource = (typeof COMPANY_PURGE_RESOURCES)[number];

export type CompanyPurgePreview =
  | { readonly found: false }
  | {
      readonly found: true;
      readonly closed: boolean;
      /** Só na autoridade do operador (D-131): existe solicitação de encerramento registrada. */
      readonly registered?: boolean;
      readonly confirmation: string;
      readonly counts: Readonly<Record<CompanyPurgeResource, number>>;
    };

export type PurgeDatabaseRefusal =
  | "not_found"
  | "not_closed"
  | "not_registered"
  | "confirmation_mismatch"
  | "storage_not_empty"
  | "blocked_by_external_reference";

export type PurgeDatabaseResult =
  | { readonly ok: true; readonly deleted: Readonly<Record<string, number>> }
  | { readonly ok: false; readonly reason: PurgeDatabaseRefusal };

export interface CompanyOffboardingPorts {
  preview(companyId: string): Promise<CompanyPurgePreview>;
  listStorageObjects(companyId: string): Promise<readonly string[]>;
  removeStorageObjects(paths: readonly string[]): Promise<void>;
  purgeDatabase(companyId: string, confirmation: string): Promise<PurgeDatabaseResult>;
}

export type CompanyPurgeFailure =
  | PurgeDatabaseRefusal
  | "unsafe_storage_path"
  | "storage_failed"
  | "storage_incomplete"
  | "database_failed"
  | "verification_failed";

export type CompanyPurgeOutcome =
  | {
      readonly ok: true;
      readonly storageObjectsRemoved: number;
      readonly deleted: Readonly<Record<string, number>>;
    }
  | { readonly ok: false; readonly reason: CompanyPurgeFailure };

/** Um caminho só é apagável se estiver no prefixo EXATO da empresa, sem segmentos ambíguos. */
export function isCompanyStoragePath(companyId: string, path: unknown): path is string {
  if (typeof path !== "string" || !isUuid(companyId)) return false;
  const prefix = `company/${companyId}/`;
  if (!path.startsWith(prefix) || path.length === prefix.length) return false;
  if (path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export async function previewCompanyPurge(
  ports: Pick<CompanyOffboardingPorts, "preview">,
  companyId: unknown
): Promise<CompanyPurgePreview> {
  if (!isUuid(companyId)) return { found: false };
  return ports.preview(companyId);
}

export async function runCompanyPurge(
  ports: CompanyOffboardingPorts,
  input: { readonly companyId: unknown; readonly confirmation: unknown }
): Promise<CompanyPurgeOutcome> {
  const { companyId, confirmation } = input;

  if (!isUuid(companyId)) return { ok: false, reason: "not_found" };
  if (typeof confirmation !== "string" || confirmation.length === 0) {
    return { ok: false, reason: "confirmation_mismatch" };
  }

  const preview = await ports.preview(companyId);
  if (!preview.found) return { ok: false, reason: "not_found" };
  if (!preview.closed) return { ok: false, reason: "not_closed" };
  if (preview.registered === false) return { ok: false, reason: "not_registered" };
  if (confirmation !== preview.confirmation) return { ok: false, reason: "confirmation_mismatch" };

  let paths: readonly string[];
  try {
    paths = await ports.listStorageObjects(companyId);
  } catch {
    return { ok: false, reason: "storage_failed" };
  }

  if (!paths.every((path) => isCompanyStoragePath(companyId, path))) {
    return { ok: false, reason: "unsafe_storage_path" };
  }

  if (paths.length > 0) {
    try {
      await ports.removeStorageObjects(paths);
    } catch {
      return { ok: false, reason: "storage_failed" };
    }
  }

  let remaining: readonly string[];
  try {
    remaining = await ports.listStorageObjects(companyId);
  } catch {
    return { ok: false, reason: "storage_failed" };
  }
  if (remaining.length > 0) return { ok: false, reason: "storage_incomplete" };

  let purge: PurgeDatabaseResult;
  try {
    purge = await ports.purgeDatabase(companyId, confirmation);
  } catch {
    return { ok: false, reason: "database_failed" };
  }
  if (!purge.ok) return { ok: false, reason: purge.reason };

  const after = await ports.preview(companyId);
  if (after.found) return { ok: false, reason: "verification_failed" };

  return { ok: true, storageObjectsRemoved: paths.length, deleted: purge.deleted };
}

const PURGE_REFUSALS: readonly PurgeDatabaseRefusal[] = [
  "not_found",
  "not_closed",
  "not_registered",
  "confirmation_mismatch",
  "storage_not_empty",
  "blocked_by_external_reference",
];

/** Lê o JSON devolvido por `preview_company_purge`; qualquer forma inesperada vira "não encontrada". */
export function parseCompanyPurgePreview(raw: unknown): CompanyPurgePreview {
  if (typeof raw !== "object" || raw === null) return { found: false };
  const value = raw as { found?: unknown; closed?: unknown; registered?: unknown; confirmation?: unknown; counts?: unknown };
  if (value.found !== true || typeof value.closed !== "boolean" || typeof value.confirmation !== "string") {
    return { found: false };
  }
  const rawCounts = (typeof value.counts === "object" && value.counts !== null ? value.counts : {}) as Record<string, unknown>;
  const counts = Object.fromEntries(
    COMPANY_PURGE_RESOURCES.map((resource) => {
      const count = Number(rawCounts[resource] ?? 0);
      return [resource, Number.isFinite(count) ? count : 0];
    })
  ) as Record<CompanyPurgeResource, number>;
  return typeof value.registered === "boolean"
    ? { found: true, closed: value.closed, registered: value.registered, confirmation: value.confirmation, counts }
    : { found: true, closed: value.closed, confirmation: value.confirmation, counts };
}

/** Lê o JSON devolvido por `purge_closed_company`; forma inesperada é tratada como falha do banco. */
export function parsePurgeDatabaseResult(raw: unknown): PurgeDatabaseResult {
  if (typeof raw !== "object" || raw === null) throw new Error("unexpected purge result");
  const value = raw as { ok?: unknown; reason?: unknown; deleted?: unknown };
  if (value.ok === true && typeof value.deleted === "object" && value.deleted !== null) {
    return { ok: true, deleted: value.deleted as Record<string, number> };
  }
  if (value.ok === false && PURGE_REFUSALS.includes(value.reason as PurgeDatabaseRefusal)) {
    return { ok: false, reason: value.reason as PurgeDatabaseRefusal };
  }
  throw new Error("unexpected purge result");
}

/** Rótulos dos recursos da prévia (dono e operador). */
export const COMPANY_PURGE_RESOURCE_LABELS: Readonly<Record<CompanyPurgeResource, string>> = {
  storage_objects: "Arquivos armazenados",
  documents: "Documentos",
  executions: "Análises executadas",
  executive_diagnoses: "Diagnósticos executivos",
  diagnosis_reviews: "Revisões de diagnóstico",
  decisions: "Decisões",
  decision_execution_events: "Acompanhamentos de decisão",
  decision_outcomes: "Resultados de decisão",
  financial_observations: "Observações financeiras",
  learning_records: "Aprendizados",
  knowledge_records: "Conhecimentos",
  knowledge_evaluations: "Avaliações de conhecimento",
};

/** Só metadados do erro no servidor — nunca IDs de empresa, nomes de arquivo ou dados. */
export function logOffboardingUnexpected(stage: string, error: unknown): void {
  const detail = typeof error === "object" && error !== null ? (error as { name?: unknown; code?: unknown }) : {};
  console.error(
    `[offboarding:${stage}] falha inesperada (D-130)`,
    JSON.stringify({
      name: typeof detail.name === "string" ? detail.name : null,
      code: typeof detail.code === "string" ? detail.code : null,
    })
  );
}

/** Mensagens para o usuário — nunca texto interno do banco ou do Storage. */
export const COMPANY_PURGE_FAILURE_MESSAGES: Readonly<Record<CompanyPurgeFailure, string>> = {
  not_found: "Empresa não encontrada ou sem acesso.",
  not_closed: "A empresa precisa estar encerrada antes da exclusão definitiva.",
  not_registered: "A solicitação de encerramento desta empresa ainda não foi registrada.",
  confirmation_mismatch: "A confirmação não confere. Digite exatamente a frase indicada.",
  storage_not_empty: "Ainda há arquivos desta empresa no armazenamento. Tente novamente.",
  blocked_by_external_reference:
    "A exclusão foi interrompida porque outra empresa referencia dados desta. Nada foi apagado do banco; contate o suporte.",
  unsafe_storage_path: "Foi encontrado um arquivo fora do espaço desta empresa. Nada foi apagado; contate o suporte.",
  storage_failed: "Não foi possível remover os arquivos. Nada foi apagado do banco; tente novamente.",
  storage_incomplete: "Alguns arquivos não foram removidos. Nada foi apagado do banco; tente novamente.",
  database_failed:
    "Os arquivos foram removidos, mas a exclusão dos dados falhou. A empresa continua encerrada; tente novamente.",
  verification_failed: "A exclusão não pôde ser confirmada. Contate o suporte.",
};
