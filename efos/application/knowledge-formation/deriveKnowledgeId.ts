import { createHash } from "node:crypto";

/**
 * Deriva o `id` de um `Knowledge` deterministicamente a partir do seu
 * conteúdo (`companyId`+`category`+`learningRecordIds` ordenados) —
 * nunca `randomUUID()` (Mission 141, Etapa 10 — Idempotência). Mesmo
 * princípio de D-001 (`FinancialModel.id` determinístico a partir de
 * `companyId`, "torna a regra estrutural em vez de convencional"):
 * reexecutar a formação de conhecimento com o MESMO conjunto de
 * `LearningRecord`s produz sempre o mesmo `id` — a camada de
 * persistência (`modules/decisions/services/knowledge-persistence.service.ts`)
 * trata uma colisão de `id` como "já existe", nunca como uma
 * duplicata silenciosa nem como um erro.
 *
 * Formato: hash SHA-256 do conteúdo, os primeiros 32 caracteres
 * hexadecimais reformatados como UUID (8-4-4-4-12) — sintaticamente
 * válido para a coluna `uuid` do Postgres, mas nunca gerado por
 * `gen_random_uuid()`/`crypto.randomUUID()`. `learningRecordIds` é
 * ordenado antes do hash para que a ORDEM de entrada nunca afete o
 * resultado — só o CONJUNTO de registros de origem importa.
 */
export function deriveKnowledgeId(
  companyId: string,
  category: string,
  learningRecordIds: readonly string[]
): string {
  const canonical = `${companyId}::${category}::${[...learningRecordIds].sort().join(",")}`;
  const hex = createHash("sha256").update(canonical).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
