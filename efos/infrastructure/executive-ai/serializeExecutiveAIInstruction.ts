import type { ExecutiveAIInstruction } from "@/efos/application/executive-ai-instruction";

/**
 * Payload JSON-safe de uma `ExecutiveAIInstruction` (Mission 118,
 * Etapa 5). `Record<string, unknown>` deliberado — o formato exato de
 * "payload de provider" não é o mesmo tipo que `ExecutiveAIInstruction`
 * (que é a estrutura de aplicação, não o formato de rede); este tipo
 * existe só para deixar explícito, no próprio sistema de tipos, que o
 * valor devolvido já passou por serialização.
 */
export type ExecutiveAIInstructionPayload = Readonly<Record<string, unknown>>;

/**
 * Transforma uma `ExecutiveAIInstruction` (Mission 117, D-061) no
 * payload enviado a um provider de IA real (Mission 118, Etapa 5).
 *
 * **Nenhum campo é somado, removido, arredondado ou reclassificado.**
 * `instruction` já é dado plano — toda a árvore (`context.financialTruth`,
 * `context.evidence`, `context.deterministicIntelligence`,
 * `context.historicalIntelligence`, `context.sourceTraceability`,
 * `context.unknowns`, `context.conflicts`, `knowledgeContext`,
 * `objective`, `authority`, `outputContract`, `constraints`) já é
 * composta exclusivamente por `interface`s de dado (nunca classes com
 * método/estado oculto) — a serialização é, por construção, uma cópia
 * estrutural fiel via `JSON.parse(JSON.stringify(...))`, nunca uma
 * reescrita campo a campo que arriscaria divergir silenciosamente do
 * contrato real conforme `ExecutiveAIInstruction`/`ExecutiveFinancialContext`
 * evoluem.
 *
 * **Garantias preservadas por construção** (nunca por heurística):
 * um `Indicator` com `result.status === "unavailable"` continua sem
 * nenhum `value` no payload (`IndicatorResult`, D-052, não tem outro
 * shape para esse estado) — `UNKNOWN` nunca vira `0`/`false`.
 * `ExecutiveConflict.status` é sempre `"preserved"` no contrato de
 * origem (D-058) — nunca reescrito para `"resolved"` aqui. Campos
 * opcionais ausentes (`historicalIntelligence`, `knowledgeContext`,
 * `contextId`, `analysisId`, `relatedId`) simplesmente não aparecem no
 * JSON — nunca substituídos por `null`/valor inventado.
 *
 * **Mission 143 — Knowledge Injection into Executive Analysis
 * (D-075)**: `context` (Financial Truth) e `knowledgeContext`
 * (Historical Knowledge), quando presente, permanecem sempre 2 chaves
 * de topo SEPARADAS no JSON resultante — esta função nunca funde os
 * dois blocos, nem por acidente (cada um é um sub-objeto próprio da
 * árvore `instruction`, copiado estruturalmente como está).
 */
export function serializeExecutiveAIInstruction(
  instruction: ExecutiveAIInstruction
): ExecutiveAIInstructionPayload {
  return JSON.parse(JSON.stringify(instruction)) as ExecutiveAIInstructionPayload;
}
