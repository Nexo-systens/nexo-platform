import { decodeBasisReferences } from "@/efos/infrastructure/executive-ai";

/**
 * Aplica `decodeBasisReferences()` (`@/efos/infrastructure/executive-ai`,
 * Mission 135, D-068 — reaproveitado diretamente, nunca copiado) a todo
 * campo `basis` presente na saída bruta do modelo de Chat —
 * `factualClaims`/`analysis`/`hypotheses` (nunca `limitations`, que não
 * carrega `basis`, mesmo formato de `ExecutiveUncertainty`, D-059).
 * Mesmo precedente exato de `decodeModelDiagnosisBasisFields()`
 * (`executive-ai/basisTransport.ts`), adaptado apenas nos nomes de
 * campo — o DECODIFICADOR em si (`decodeBasisReferences()`) nunca é
 * duplicado.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ARRAY_FIELDS_WITH_BASIS = ["factualClaims", "analysis", "hypotheses"] as const;

export function decodeModelChatAnswerBasisFields(modelAnswer: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...modelAnswer };

  for (const field of ARRAY_FIELDS_WITH_BASIS) {
    if (Array.isArray(result[field])) {
      result[field] = (result[field] as readonly unknown[]).map((item) =>
        isPlainObject(item) ? { ...item, basis: decodeBasisReferences(item.basis) } : item
      );
    }
  }

  return result;
}
