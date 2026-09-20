import type { IndicatorsAggregate, Period } from "@/efos/domain";

import { EVIDENCE_ENGINE_MESSAGES } from "./evidence.constants";
import type { EvidenceEngineInput } from "./evidence.types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * `IndicatorsAggregate` nao carrega `period` no seu proprio nivel —
 * cada `Indicator` individual carrega o seu (todos identicos dentro da
 * mesma execucao, `indicators.mapper.ts`). Mission 166 (D-087) —
 * reaproveitada tambem por `evidence.temporal.builder.ts`.
 */
export function periodOf(indicators: IndicatorsAggregate): Period | undefined {
  return indicators.indicators[0]?.period;
}

/**
 * Validador do Evidence Engine. Responsavel exclusivamente por
 * validacao estrutural e de consistencia entre os tres agregados de
 * entrada (FinancialModelAggregate, IndicatorsAggregate,
 * FinancialKnowledgeGraphAggregate) — nunca valida regra de negocio.
 */
export function validateEvidenceEngineInput(
  input: EvidenceEngineInput
): ValidationResult {
  const errors: string[] = [];

  if (!input.companyId) {
    errors.push(EVIDENCE_ENGINE_MESSAGES.missingCompanyId);
  }

  if (!input.financialModel) {
    errors.push(EVIDENCE_ENGINE_MESSAGES.missingFinancialModel);
  } else if (!input.financialModel.root) {
    errors.push(EVIDENCE_ENGINE_MESSAGES.missingFinancialModelRoot);
  } else if (
    input.companyId &&
    input.financialModel.root.companyId !== input.companyId
  ) {
    errors.push(EVIDENCE_ENGINE_MESSAGES.financialModelCompanyMismatch);
  }

  if (!input.indicators) {
    errors.push(EVIDENCE_ENGINE_MESSAGES.missingIndicators);
  } else {
    if (input.companyId && input.indicators.companyId !== input.companyId) {
      errors.push(EVIDENCE_ENGINE_MESSAGES.indicatorsCompanyMismatch);
    }

    if (
      input.financialModel?.root &&
      input.indicators.financialModelId !== input.financialModel.root.id
    ) {
      errors.push(EVIDENCE_ENGINE_MESSAGES.indicatorsFinancialModelMismatch);
    }
  }

  if (!input.financialKnowledgeGraph) {
    errors.push(EVIDENCE_ENGINE_MESSAGES.missingFinancialKnowledgeGraph);
  } else {
    if (
      input.companyId &&
      input.financialKnowledgeGraph.companyId !== input.companyId
    ) {
      errors.push(EVIDENCE_ENGINE_MESSAGES.graphCompanyMismatch);
    }

    if (
      input.financialModel?.root &&
      input.financialKnowledgeGraph.financialModelId !==
        input.financialModel.root.id
    ) {
      errors.push(EVIDENCE_ENGINE_MESSAGES.graphFinancialModelMismatch);
    }
  }

  // Mission 166 — Temporal Evidence Detection (D-087). `priorPeriods`
  // e aditivo e opcional (Etapa "Historical Input Contract" da Mission
  // 166A) — quando ausente, nenhuma checagem abaixo executa e o
  // comportamento e identico ao de antes desta missao. Um unico erro
  // por categoria de violacao, mesmo que multiplos periodos violem a
  // mesma regra — evita uma lista de erros redundante.
  if (input.priorPeriods && input.priorPeriods.length > 0) {
    let companyMismatch = false;
    let financialModelMismatch = false;
    let duplicate = false;
    let notStrictlyOrdered = false;
    let overlap = false;

    for (const prior of input.priorPeriods) {
      if (
        input.companyId &&
        (prior.financialModel.root.companyId !== input.companyId ||
          prior.indicators.companyId !== input.companyId)
      ) {
        companyMismatch = true;
      }
      if (
        input.financialModel?.root &&
        prior.financialModel.root.id !== input.financialModel.root.id
      ) {
        financialModelMismatch = true;
      }
      if (prior.indicators.financialModelId !== prior.financialModel.root.id) {
        financialModelMismatch = true;
      }
    }

    for (let i = 1; i < input.priorPeriods.length; i++) {
      const previous = periodOf(input.priorPeriods[i - 1].indicators);
      const current = periodOf(input.priorPeriods[i].indicators);
      if (!previous || !current) continue;

      const previousStart = new Date(previous.startDate).getTime();
      const previousEnd = new Date(previous.endDate).getTime();
      const currentStart = new Date(current.startDate).getTime();

      if (currentStart === previousStart) {
        duplicate = true;
      } else if (currentStart < previousStart) {
        notStrictlyOrdered = true;
      }
      if (currentStart < previousEnd) {
        overlap = true;
      }
    }

    const currentPeriod = input.indicators ? periodOf(input.indicators) : undefined;
    if (currentPeriod && input.priorPeriods.length > 0) {
      const lastPrior = periodOf(
        input.priorPeriods[input.priorPeriods.length - 1].indicators
      );
      if (lastPrior) {
        const lastPriorEnd = new Date(lastPrior.endDate).getTime();
        const currentPeriodStart = new Date(currentPeriod.startDate).getTime();
        if (currentPeriodStart < lastPriorEnd) {
          overlap = true;
        }
      }
    }

    if (companyMismatch) {
      errors.push(EVIDENCE_ENGINE_MESSAGES.priorPeriodsCompanyMismatch);
    }
    if (financialModelMismatch) {
      errors.push(EVIDENCE_ENGINE_MESSAGES.priorPeriodsFinancialModelMismatch);
    }
    if (duplicate) {
      errors.push(EVIDENCE_ENGINE_MESSAGES.priorPeriodsDuplicate);
    }
    if (notStrictlyOrdered) {
      errors.push(EVIDENCE_ENGINE_MESSAGES.priorPeriodsNotStrictlyOrdered);
    }
    if (overlap) {
      errors.push(EVIDENCE_ENGINE_MESSAGES.priorPeriodsOverlap);
    }
  }

  return { valid: errors.length === 0, errors };
}
