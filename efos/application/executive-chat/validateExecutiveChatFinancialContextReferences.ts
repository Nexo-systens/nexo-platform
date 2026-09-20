import type { InterpretationBasis } from "@/efos/application/executive-diagnosis";
import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";

import type { ExecutiveChatAnswer } from "./ExecutiveChatAnswer.types";

/**
 * Mesmo mecanismo de `validateExecutiveFinancialContextReferences()`
 * (`executive-context/`, Mission 163, D-081-adjacent) aplicado a
 * `ExecutiveChatAnswer` — campos diferentes (`factualClaims`/
 * `analysis`/`hypotheses`, nunca os 6 arrays de `ExecutiveDiagnosis`),
 * mesma estratégia de contenção: um id só é válido se pertencer de
 * fato aos arrays já presentes no `ExecutiveFinancialContext` recebido.
 * `limitations` nunca carrega `basis` (mesmo formato de
 * `ExecutiveUncertainty`, D-059) — nunca verificado aqui.
 */
export interface ChatFinancialContextReferenceValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const BASIS_BEARING_FIELDS = ["factualClaims", "analysis", "hypotheses"] as const;

export function validateExecutiveChatFinancialContextReferences(
  answer: ExecutiveChatAnswer,
  context: ExecutiveFinancialContext
): ChatFinancialContextReferenceValidationResult {
  const errors: string[] = [];

  const availableIndicatorIds = new Set(context.financialTruth.indicators.map((i) => i.id));
  const availableEvidenceIds = new Set(context.evidence.map((e) => e.id));
  const availableContextIds = new Set(context.deterministicIntelligence.contexts.map((c) => c.id));

  function checkBasis(basis: InterpretationBasis | undefined, label: string): void {
    for (const indicatorId of basis?.indicatorIds ?? []) {
      if (!availableIndicatorIds.has(indicatorId)) {
        errors.push(`${label} cita indicatorId "${indicatorId}" que não pertence a context.financialTruth.indicators.`);
      }
    }
    for (const evidenceId of basis?.evidenceIds ?? []) {
      if (!availableEvidenceIds.has(evidenceId)) {
        errors.push(`${label} cita evidenceId "${evidenceId}" que não pertence a context.evidence.`);
      }
    }
    for (const contextId of basis?.contextIds ?? []) {
      if (!availableContextIds.has(contextId)) {
        errors.push(`${label} cita contextId "${contextId}" que não pertence a context.deterministicIntelligence.contexts.`);
      }
    }
    if ((basis?.conflictIds?.length ?? 0) > 0) {
      errors.push(
        `${label} cita conflictIds (${basis!.conflictIds!.join(", ")}) — nenhum ExecutiveConflict tem identidade própria hoje (conflicts é sempre [] em buildExecutiveFinancialContext()).`
      );
    }
  }

  for (const field of BASIS_BEARING_FIELDS) {
    answer[field].forEach((item, index) => checkBasis(item.basis, `${field}[${index}]`));
  }

  return { valid: errors.length === 0, errors };
}
