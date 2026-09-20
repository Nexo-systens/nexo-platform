import type { ExecutiveDiagnosis, InterpretationBasis } from "@/efos/application/executive-diagnosis";

import type { ExecutiveFinancialContext } from "./ExecutiveFinancialContext";

/**
 * Mission 163 — Executive Basis Traceability. Fecha o elo que a
 * Mission 149 (D-081) deixou explicitamente documentado como lacuna
 * preexistente, e que a Mission 162 reconfirmou ainda aberta:
 * `validateKnowledgeReferences()` (D-081) só verifica `knowledgeIds` —
 * nenhum validator existente jamais checou se `indicatorIds`/
 * `evidenceIds`/`contextIds` citados em `basis` realmente existem no
 * `ExecutiveFinancialContext` usado na análise.
 *
 * **Achado da auditoria obrigatória (Etapa 1)**: `Indicator.id`/
 * `Evidence.id`/`Context.id` (D-002/D-004) são TODOS derivados
 * deterministicamente a partir de `financialModelId` (`buildIndicatorId()`/
 * `buildEvidenceId()`/`buildContextId()`, cada Engine mapper) —
 * que por sua vez é derivado deterministicamente de `companyId`
 * (`buildFinancialModelId()`, D-001). Isso significa que os 3 ids já
 * carregam fronteira de empresa embutida na própria string — nunca
 * colidem entre empresas diferentes, mesmo sem checagem adicional.
 * A mesma estratégia de CONTENÇÃO já usada por `validateKnowledgeReferences()`
 * (D-081) para `knowledgeIds` contra `knowledgeContext.knowledge` é,
 * portanto, estruturalmente suficiente e correta aqui: um id só é
 * válido se pertencer de fato aos arrays já presentes no
 * `ExecutiveFinancialContext` recebido — nenhuma segunda fonte de
 * verdade, nenhum registro/índice novo.
 *
 * **`conflictIds` é um caso à parte (Etapa 2 — inventário)**:
 * `ExecutiveConflict` (`ExecutiveFinancialContext.ts`, Mission 114)
 * **não tem nenhum campo `id`** — e `conflicts` é sempre `[]` em
 * `buildExecutiveFinancialContext()` hoje (detecção de conflito nunca
 * implementada, GAP conhecido desde a Mission 113/114). Não existe,
 * portanto, NENHUM `conflictId` estruturalmente válido possível hoje —
 * qualquer `conflictIds` não-vazio é, por definição, uma referência a
 * algo que não pode existir. Esta função rejeita qualquer `conflictIds`
 * não-vazio pelo mesmo motivo, nunca por analogia de contenção (não há
 * container com o que comparar).
 *
 * Pura — nunca acessa Supabase/banco/relógio, nenhuma IA, nenhum
 * embedding/scoring/similaridade semântica. Reaproveita integralmente
 * `VALIDATION_FAILED` (`executeExecutiveAnalysis.ts`, Mission 116) —
 * nenhum código de erro novo.
 */
export interface FinancialContextReferenceValidationResult {
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

export function validateExecutiveFinancialContextReferences(
  diagnosis: ExecutiveDiagnosis,
  context: ExecutiveFinancialContext
): FinancialContextReferenceValidationResult {
  const errors: string[] = [];

  const availableIndicatorIds = new Set(context.financialTruth.indicators.map((i) => i.id));
  const availableEvidenceIds = new Set(context.evidence.map((e) => e.id));
  const availableContextIds = new Set(context.deterministicIntelligence.contexts.map((c) => c.id));

  function checkBasis(basis: InterpretationBasis | undefined, label: string): void {
    for (const indicatorId of basis?.indicatorIds ?? []) {
      if (!availableIndicatorIds.has(indicatorId)) {
        errors.push(
          `${label} cita indicatorId "${indicatorId}" que não pertence a context.financialTruth.indicators — nenhuma referência a Indicator inexistente ou de outra empresa/execução é aceita como lineage válida.`
        );
      }
    }
    for (const evidenceId of basis?.evidenceIds ?? []) {
      if (!availableEvidenceIds.has(evidenceId)) {
        errors.push(
          `${label} cita evidenceId "${evidenceId}" que não pertence a context.evidence — nenhuma referência a Evidence inexistente ou de outra empresa/execução é aceita como lineage válida.`
        );
      }
    }
    for (const contextId of basis?.contextIds ?? []) {
      if (!availableContextIds.has(contextId)) {
        errors.push(
          `${label} cita contextId "${contextId}" que não pertence a context.deterministicIntelligence.contexts — nenhuma referência a Context inexistente ou de outra empresa/execução é aceita como lineage válida.`
        );
      }
    }
    if ((basis?.conflictIds?.length ?? 0) > 0) {
      errors.push(
        `${label} cita conflictIds (${basis!.conflictIds!.join(", ")}) — nenhum ExecutiveConflict tem identidade própria hoje (conflicts é sempre [] em buildExecutiveFinancialContext(), detecção de conflito nunca implementada, GAP conhecido desde a Mission 114) — nenhum conflictId pode ser válido enquanto isso não mudar.`
      );
    }
  }

  checkBasis(diagnosis.executiveSummary?.basis, "executiveSummary");
  for (const field of BASIS_BEARING_FIELDS) {
    diagnosis[field].forEach((item, index) => checkBasis(item.basis, `${field}[${index}]`));
  }

  return { valid: errors.length === 0, errors };
}
