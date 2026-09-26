/**
 * Mission 200 — Canonical External Identifier Validation (D-128).
 *
 * Todo identificador de recurso da NEXO (`companies.id`,
 * `documents.id`, `executions.execution_id`, `decisions.id`, ...) é uma
 * coluna `uuid` do Postgres. Um valor que não é um UUID textual faz o
 * Postgres rejeitar a consulta inteira (SQLSTATE 22P02) — antes desta
 * fronteira, isso virava exceção não tratada e HTTP 500 sem corpo.
 *
 * Forma canônica: 32 dígitos hexadecimais em 8-4-4-4-12, sem
 * restrição de versão/variante. Não é `z.uuid()` de propósito: IDs
 * determinísticos da NEXO (`deriveKnowledgeId()`, recortes de SHA-256)
 * são UUIDs válidos para o Postgres mas não carregam versão RFC 4122.
 *
 * Um identificador malformado é um erro de SINTAXE do chamador, nunca
 * informação sobre existência: quem valida é o próprio formato, não o
 * banco — por isso ele pode ser rejeitado antes de qualquer consulta
 * sem criar um oráculo de enumeração.
 */
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID.test(value);
}

export function allUuids(...values: readonly unknown[]): boolean {
  return values.every(isUuid);
}
