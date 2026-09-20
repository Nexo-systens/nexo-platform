import type { ExecutiveDiagnosis } from "@/efos/application/executive-diagnosis";
import type { InterpretationBasis } from "@/efos/application/executive-diagnosis";
import type { Knowledge } from "@/efos/domain";
import type { KnowledgeStateResult } from "@/efos/application/knowledge-lifecycle";

import type { ExecutiveKnowledgeContext } from "./ExecutiveKnowledgeContext";

/**
 * Mission 149 — Knowledge-Conditioned Executive Recommendation
 * Validation.
 *
 * **Achado da auditoria obrigatória (Etapa 1/4/9)**: `validateExecutiveDiagnosis()`
 * (D-059, `efos/application/executive-diagnosis/ExecutiveDiagnosis.validator.ts`)
 * recebe **apenas** o `ExecutiveDiagnosis` — nenhum contexto — e por
 * isso NUNCA verificou, para nenhum dos 4 campos originais de
 * `InterpretationBasis` (`indicatorIds`/`evidenceIds`/`contextIds`/
 * `conflictIds`), se os ids citados realmente existem no
 * `ExecutiveFinancialContext`; era uma lacuna estrutural preexistente,
 * nunca causada por D-080. Esta missão fecha essa lacuna
 * especificamente para `knowledgeIds` (D-080, Mission 148), por
 * exigência explícita da Etapa 4 — nunca alterando a assinatura nem o
 * comportamento de `validateExecutiveDiagnosis()` (permanece
 * intencionalmente livre de contexto, D-059, Mission 115).
 *
 * **Por que 1 único mecanismo cobre TODOS os 4 riscos da Etapa 1
 * (E/F/G/H)**: `ExecutiveKnowledgeContext.knowledge` (D-075) já é a
 * saída de `selectRelevantKnowledge()` (D-074) — um `Knowledge` só
 * chega até ali depois de sobreviver a 3 critérios estruturais:
 * fronteira de empresa (`COMPANY_MISMATCH`), temporalidade
 * (`FUTURE_KNOWLEDGE`), e validade estrutural
 * (`STRUCTURALLY_INVALID`). Logo, `knowledgeId ∈
 * knowledgeContext.knowledge.map(k => k.id)` é, por construção, a
 * MESMA verificação de "empresa correta ∧ não é futuro ∧
 * estruturalmente válido ∧ passou pelo relevance filter" — nenhuma
 * segunda implementação desses 3 critérios é necessária ou desejável
 * (Etapa 2: não duplicar `KnowledgeRelevance`/`KnowledgeState`).
 * `knowledgeContext.states` sempre tem 1 entrada por item de
 * `knowledgeContext.knowledge` (D-078/D-079) — então qualquer
 * `knowledgeId` que passe nesta checagem tem, por construção, um
 * `KnowledgeStateResult` real disponível para consulta
 * (`traceKnowledgeReference()`, abaixo), nunca um estado inventado.
 *
 * Pura — nenhum acesso a Supabase/banco/relógio, nenhuma chamada de
 * IA, nenhum embedding/scoring/similaridade semântica (Etapa 15).
 */
export interface KnowledgeReferenceValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const BASIS_BEARING_FIELDS = [
  "interpretations",
  "hypotheses",
  "risks",
  "priorities",
  "possibleActions",
  "conflictInterpretations",
] as const;

/**
 * Valida que todo `knowledgeId` citado em qualquer `basis` de um
 * `ExecutiveDiagnosis` pertence realmente a
 * `knowledgeContext.knowledge` — nunca um id inventado
 * ("`fake-id`"), de outra empresa, futuro em relação a `asOf`, ou
 * excluído pelo filtro de relevância. `knowledgeContext` ausente
 * (`undefined`) significa que NENHUM Knowledge esteve disponível para
 * esta análise — qualquer `knowledgeId` citado nessas condições é,
 * por definição, inválido (Etapa 9: nunca tratar `knowledgeIds:
 * ["fake-id"]` como lineage válida).
 *
 * `knowledgeIds: []`/ausente continua sempre válido — uma
 * `Recommendation` fundamentada exclusivamente em Financial Truth
 * nunca é obrigada a citar Knowledge (Etapa 4 da missão, preservando o
 * mesmo princípio de "ausência de Knowledge nunca bloqueia a
 * análise", D-075/Etapa 7 da Mission 143).
 */
export function validateKnowledgeReferences(
  diagnosis: ExecutiveDiagnosis,
  knowledgeContext: ExecutiveKnowledgeContext | undefined
): KnowledgeReferenceValidationResult {
  const errors: string[] = [];
  const availableIds = new Set((knowledgeContext?.knowledge ?? []).map((k) => k.id));

  function checkBasis(basis: InterpretationBasis | undefined, label: string): void {
    for (const knowledgeId of basis?.knowledgeIds ?? []) {
      if (!availableIds.has(knowledgeId)) {
        errors.push(
          `${label} cita knowledgeId "${knowledgeId}" que não pertence a knowledgeContext.knowledge — nenhuma referência a Knowledge inexistente, de outra empresa, futuro em relação à análise, ou excluído pelo filtro de relevância é aceita como lineage válida.`
        );
      }
    }
  }

  checkBasis(diagnosis.executiveSummary?.basis, "executiveSummary");
  for (const field of BASIS_BEARING_FIELDS) {
    diagnosis[field].forEach((item, index) => checkBasis(item.basis, `${field}[${index}]`));
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Responde, para um único `knowledgeId` citado, as 3 perguntas que a
 * Etapa 3 da missão exige que o sistema consiga responder: qual
 * `Knowledge` fundamentou esta `Recommendation`, ele realmente
 * pertencia ao contexto analisado, e qual era seu estado histórico
 * naquele momento. Devolve `undefined` quando o id não pertence a
 * `knowledgeContext` (mesmo critério de `validateKnowledgeReferences()`,
 * nunca uma segunda regra divergente) — nunca lança exceção, nunca
 * inventa um `Knowledge`/`KnowledgeStateResult` parcial.
 */
export interface KnowledgeReferenceTrace {
  readonly knowledgeId: string;
  readonly knowledge: Knowledge;
  readonly state: KnowledgeStateResult;
}

export function traceKnowledgeReference(
  knowledgeId: string,
  knowledgeContext: ExecutiveKnowledgeContext
): KnowledgeReferenceTrace | undefined {
  const knowledge = knowledgeContext.knowledge.find((k) => k.id === knowledgeId);
  const state = knowledgeContext.states.find((s) => s.knowledgeId === knowledgeId);
  if (!knowledge || !state) return undefined;

  return { knowledgeId, knowledge, state };
}
