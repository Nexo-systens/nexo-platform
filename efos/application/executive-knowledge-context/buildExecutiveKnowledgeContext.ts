import type { Knowledge } from "@/efos/domain";
import { selectRelevantKnowledge, type RelevanceContext } from "@/efos/application/knowledge-relevance";
import { deriveKnowledgeState, type TimestampedKnowledgeEvaluation } from "@/efos/application/knowledge-lifecycle";

import type { ExecutiveKnowledgeContext } from "./ExecutiveKnowledgeContext";

const EMPTY_EVALUATIONS_BY_KNOWLEDGE: ReadonlyMap<string, readonly TimestampedKnowledgeEvaluation[]> = new Map();

/**
 * `buildExecutiveKnowledgeContext()` (Mission 143 — Knowledge
 * Injection into Executive Analysis, D-075; estendida pela Mission 147
 * — Knowledge-Aware Executive Intelligence, D-079). Único ponto de
 * composição autorizado a transformar `Knowledge[]` bruto num
 * `ExecutiveKnowledgeContext` pronto para uma `ExecutiveAIInstruction`
 * (Etapa 4 da Mission 143).
 *
 * Pipeline obrigatório, reaproveitado byte-a-byte — **nunca
 * duplicado**: `selectRelevantKnowledge()` (Mission 142, D-074) já
 * implementa company filtering (`COMPANY_MISMATCH`), temporal
 * filtering (`FUTURE_KNOWLEDGE`) e structural validation
 * (`STRUCTURALLY_INVALID`) — esta função nunca reimplementa nenhum
 * desses 3 critérios, apenas projeta o resultado já filtrado
 * (`selection.selected`/`selection.outcome`) para o formato de
 * contexto que `buildExecutiveAIInstruction()` (Mission 117,
 * estendida pela Mission 143) espera.
 *
 * `evaluationsByKnowledge` (Mission 147, Etapa 3/4 — parâmetro
 * ADITIVO opcional, mesmo padrão de `knowledgeContext?` em
 * `buildExecutiveAIInstruction()`, Mission 143): mapa de `knowledgeId
 * → TimestampedKnowledgeEvaluation[]` (mesmo formato produzido por
 * `getKnowledgeEvaluationsGroupedByKnowledge()`, `modules/decisions/services/`,
 * Mission 146). Para cada `Knowledge` selecionado, `deriveKnowledgeState()`
 * (D-078) é chamada — **única fonte de verdade para o estado
 * agregado**, nunca recalculado aqui (Etapa 4 da Mission 147: proibido
 * recalcular supporting/contradicting/mixed/weakened/insufficient no
 * adapter). Quando omitido, o comportamento é idêntico ao de antes
 * desta missão para o conteúdo de `knowledge`/`selectionOutcome` — cada
 * `Knowledge` simplesmente recebe `state: "EMERGING"` (honesto: nenhuma
 * avaliação conhecida), nunca um erro, nunca um estado fabricado.
 * `context.asOf` (o mesmo `RelevanceContext.asOf` já usado para
 * filtrar `Knowledge`) é reaproveitado como o corte temporal de
 * `deriveKnowledgeState()` — mesmo instante de análise, nunca 2
 * relógios divergentes.
 *
 * Pura — nunca acessa Supabase/`createClient`, nunca chama IA, nunca
 * lê o relógio do sistema (`context.asOf`, quando necessário, é
 * sempre resolvido pelo chamador — mesmo princípio de toda função pura
 * desta série de missões).
 */
export function buildExecutiveKnowledgeContext(
  knowledgeRecords: readonly Knowledge[],
  context: RelevanceContext,
  evaluationsByKnowledge: ReadonlyMap<string, readonly TimestampedKnowledgeEvaluation[]> = EMPTY_EVALUATIONS_BY_KNOWLEDGE
): ExecutiveKnowledgeContext {
  const selection = selectRelevantKnowledge(knowledgeRecords, context);
  const states = selection.selected.map((knowledge) =>
    deriveKnowledgeState(knowledge, evaluationsByKnowledge.get(knowledge.id) ?? [], context.asOf)
  );

  return {
    knowledge: selection.selected,
    selectionOutcome: selection.outcome,
    states,
  };
}
