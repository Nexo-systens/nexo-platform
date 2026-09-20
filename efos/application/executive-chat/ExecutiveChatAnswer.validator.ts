import type { InterpretationBasis } from "@/efos/application/executive-diagnosis";

import {
  EXECUTIVE_CHAT_COMPARISON_ACTION_TYPES,
  EXECUTIVE_CHAT_NAVIGATION_ACTION_TYPES,
  EXECUTIVE_CHAT_SCENARIO_ACTION_TYPES,
  MAX_EXECUTIVE_CHAT_PROPOSED_ACTIONS,
  type ExecutiveChatResolvedAction,
} from "./ExecutiveChatActionProposal";
import { EXECUTIVE_CHAT_GROUNDING_STATUSES, type ExecutiveChatAnswer } from "./ExecutiveChatAnswer.types";

export interface ExecutiveChatAnswerValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Campos que, se presentes num `ExecutiveChatAnswer` recebido de fora
 * (antes de qualquer validação de tipo em runtime), indicariam uma
 * tentativa de produzir Decision/Outcome/Execution/Financial Truth/
 * Recommendation/Scenario como se fosse saída do chat — nenhum desses
 * é um campo do contrato (Seções 14/15). Mesmo princípio defensivo de
 * `FORBIDDEN_AUTHORITY_KEYS` em `ExecutiveDiagnosis.validator.ts`
 * (D-059), estendido com o vocabulário específico que a Seção 14/15
 * desta missão proíbe explicitamente: `recommendation(s)` e
 * `scenario(s)`.
 */
const FORBIDDEN_AUTHORITY_KEYS = [
  "decision",
  "decisions",
  "outcome",
  "outcomes",
  "execution",
  "executions",
  "financialTruth",
  "indicators",
  "resources",
  "financialEvents",
  "recommendation",
  "recommendations",
  "scenario",
  "scenarios",
  "learning",
  "learningRecords",
  "knowledge",
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNonZero(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value !== 0;
}

/** Mission 190 — mesma checagem de magnitude, reaproveitada para as 2 alternativas de uma comparação (nunca uma segunda função). */
function describeAssumptionIssues(assumption: { readonly kind: string }, label: string): readonly string[] {
  if (assumption.kind === "operating_cost_change") {
    const amount = (assumption as { operatingExpensesDelta?: { amount?: unknown } }).operatingExpensesDelta?.amount;
    return isFiniteNonZero(amount) ? [] : [`${label} com operatingExpensesDelta.amount inválido — deve ser um número finito e não-zero.`];
  }
  if (assumption.kind === "collection_period_change") {
    const deltaDays = (assumption as { collectionPeriodDeltaDays?: unknown }).collectionPeriodDeltaDays;
    return isFiniteNonZero(deltaDays) ? [] : [`${label} com collectionPeriodDeltaDays inválido — deve ser um número finito e não-zero.`];
  }
  return [`${label} com assumption.kind fora do vocabulário fechado: "${assumption.kind}".`];
}

/**
 * Mission 189/190. Valida a forma JÁ RESOLVIDA
 * (`ExecutiveChatResolvedAction`) — nunca a forma bruta do provider
 * (essa é responsabilidade exclusiva de
 * `resolveExecutiveChatActionProposal()`, chamada antes desta
 * validação, dentro do adapter de infraestrutura). Esta é a última
 * defesa antes de `proposedActions` se tornar parte de um
 * `ExecutiveChatAnswer` confiável — mesmo espírito de "nunca confiar
 * apenas no formato prometido pelo provider" já aplicado a `basis`/
 * `boundaries`.
 */
function describeActionValidationIssues(action: ExecutiveChatResolvedAction, index: number): readonly string[] {
  const issues: string[] = [];
  const label = `proposedActions[${index}]`;

  if (!isNonEmptyString(action.reason)) {
    issues.push(`${label} sem reason.`);
  }

  if (action.kind === "navigation") {
    if (!(EXECUTIVE_CHAT_NAVIGATION_ACTION_TYPES as readonly string[]).includes(action.type)) {
      issues.push(`${label} com type de navegação fora do vocabulário fechado: "${action.type}".`);
    }
    return issues;
  }

  if (action.kind === "comparison") {
    if (!(EXECUTIVE_CHAT_COMPARISON_ACTION_TYPES as readonly string[]).includes(action.type)) {
      issues.push(`${label} com type de comparação fora do vocabulário fechado: "${action.type}".`);
    }
    issues.push(...describeAssumptionIssues(action.alternativeA, `${label}.alternativeA`));
    issues.push(...describeAssumptionIssues(action.alternativeB, `${label}.alternativeB`));
    return issues;
  }

  if (!(EXECUTIVE_CHAT_SCENARIO_ACTION_TYPES as readonly string[]).includes(action.type)) {
    issues.push(`${label} com type de cenário fora do vocabulário fechado: "${action.type}".`);
  }
  issues.push(...describeAssumptionIssues(action.assumption, `${label}.assumption`));

  return issues;
}

function basisIsEmpty(basis: InterpretationBasis | undefined): boolean {
  if (!basis) return true;
  return (
    (!basis.indicatorIds || basis.indicatorIds.length === 0) &&
    (!basis.evidenceIds || basis.evidenceIds.length === 0) &&
    (!basis.contextIds || basis.contextIds.length === 0) &&
    (!basis.conflictIds || basis.conflictIds.length === 0) &&
    (!basis.knowledgeIds || basis.knowledgeIds.length === 0)
  );
}

/**
 * Valida um `ExecutiveChatAnswer` contra as regras mínimas de
 * integridade da Mission 188 — mesmo espírito de
 * `validateExecutiveDiagnosis()` (D-059): nunca julga conteúdo
 * semântico ("esta resposta faz sentido?"), apenas a estrutura que
 * separa fato/análise/hipótese/limitação e impede autoridade proibida.
 * Função pura, nunca lança exceção, devolve a lista completa de
 * problemas (nunca para no primeiro erro).
 */
export function validateExecutiveChatAnswer(answer: ExecutiveChatAnswer): ExecutiveChatAnswerValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(answer.id)) {
    errors.push("ExecutiveChatAnswer.id é obrigatório e não pode ser vazio.");
  }
  if (!isNonEmptyString(answer.basedOn?.companyId)) {
    errors.push("ExecutiveChatAnswer.basedOn.companyId é obrigatório.");
  }
  if (!isNonEmptyString(answer.basedOn?.generatedAt)) {
    errors.push("ExecutiveChatAnswer.basedOn.generatedAt é obrigatório.");
  }
  if (!isNonEmptyString(answer.answer)) {
    errors.push("ExecutiveChatAnswer.answer é obrigatório e não pode ser vazio.");
  }

  if (!EXECUTIVE_CHAT_GROUNDING_STATUSES.includes(answer.groundingStatus)) {
    errors.push(
      `ExecutiveChatAnswer.groundingStatus inválido: "${answer.groundingStatus}" — deve ser um de ${EXECUTIVE_CHAT_GROUNDING_STATUSES.join(", ")}.`
    );
  }

  if (typeof answer.requiresScenarioSimulation !== "boolean") {
    errors.push("ExecutiveChatAnswer.requiresScenarioSimulation é obrigatório e deve ser boolean.");
  }

  answer.factualClaims.forEach((claim, index) => {
    if (!isNonEmptyString(claim.statement)) {
      errors.push(`factualClaims[${index}] sem statement.`);
    }
    if (basisIsEmpty(claim.basis)) {
      errors.push(`factualClaims[${index}] ("${claim.statement}") sem basis — todo fato citado precisa apontar para elementos reais do contexto.`);
    }
  });

  answer.analysis.forEach((item, index) => {
    if (!isNonEmptyString(item.statement)) {
      errors.push(`analysis[${index}] sem statement.`);
    }
    if (basisIsEmpty(item.basis)) {
      errors.push(`analysis[${index}] ("${item.statement}") sem basis.`);
    }
  });

  answer.hypotheses.forEach((hypothesis, index) => {
    if (basisIsEmpty(hypothesis.basis)) {
      errors.push(`hypotheses[${index}] ("${hypothesis.statement}") sem basis.`);
    }
    if (!isNonEmptyString(hypothesis.validationNeeded)) {
      errors.push(
        `hypotheses[${index}] ("${hypothesis.statement}") sem validationNeeded — uma hipótese sem possibilidade de validação seria apresentada como fato implicitamente.`
      );
    }
  });

  answer.limitations.forEach((limitation, index) => {
    if (!isNonEmptyString(limitation.statement)) {
      errors.push(`limitations[${index}] sem statement.`);
    }
    if (!isNonEmptyString(limitation.reason)) {
      errors.push(`limitations[${index}] ("${limitation.statement}") sem reason.`);
    }
  });

  // Seção 31 — uma resposta UNSUPPORTED nunca pode carregar um "fato"
  // ao mesmo tempo (contradição estrutural: se há base factual real, a
  // resposta é ao menos PARTIAL) e precisa declarar ao menos 1
  // limitação explicando por que não pode concluir — nunca "UNSUPPORTED"
  // silencioso, sem motivo.
  if (answer.groundingStatus === "UNSUPPORTED") {
    if (answer.factualClaims.length > 0) {
      errors.push(
        "groundingStatus é UNSUPPORTED mas factualClaims não está vazio — uma resposta sem fundamentação real não pode citar fatos confirmados."
      );
    }
    if (answer.limitations.length === 0) {
      errors.push(
        "groundingStatus é UNSUPPORTED mas nenhuma limitation foi declarada — a ausência de fundamentação deve sempre ser explicada, nunca silenciosa."
      );
    }
  }

  if (typeof answer.boundaries !== "object" || answer.boundaries === null) {
    errors.push("ExecutiveChatAnswer.boundaries é obrigatório.");
  } else if (
    answer.boundaries.doesNotChangeFinancialTruth !== true ||
    answer.boundaries.doesNotMakeDecisions !== true ||
    answer.boundaries.doesNotExecuteActions !== true ||
    answer.boundaries.doesNotCreateRecommendations !== true ||
    answer.boundaries.doesNotSimulateScenarios !== true ||
    answer.boundaries.containsFactualClaims !== true ||
    answer.boundaries.containsAnalysis !== true ||
    answer.boundaries.containsHypotheses !== true
  ) {
    errors.push("boundaries deve afirmar explicitamente os 8 limites arquiteturais fixos (use EXECUTIVE_CHAT_BOUNDARIES).");
  }

  const presentForbiddenKeys = FORBIDDEN_AUTHORITY_KEYS.filter(
    (key) => key in (answer as unknown as Record<string, unknown>)
  );
  if (presentForbiddenKeys.length > 0) {
    errors.push(
      `ExecutiveChatAnswer contém campo(s) de autoridade proibida: ${presentForbiddenKeys.join(", ")} — o chat nunca pode produzir Decision/Outcome/Execution/Recommendation/Scenario/Learning/Knowledge como saída própria.`
    );
  }

  // Mission 189 — proposedActions é opcional (aditivo, D-104); ausência
  // nunca é um erro. Quando presente: nunca mais que
  // MAX_EXECUTIVE_CHAT_PROPOSED_ACTIONS (Seção 37 — nunca spam), e cada
  // item deve ser estruturalmente íntegro.
  if (answer.proposedActions !== undefined) {
    if (answer.proposedActions.length > MAX_EXECUTIVE_CHAT_PROPOSED_ACTIONS) {
      errors.push(
        `proposedActions tem ${answer.proposedActions.length} itens — o máximo permitido é ${MAX_EXECUTIVE_CHAT_PROPOSED_ACTIONS} (Seção 37, nunca spam de ações).`
      );
    }
    answer.proposedActions.forEach((action, index) => {
      errors.push(...describeActionValidationIssues(action, index));
    });
  }

  const seenIds = new Map<string, string>();
  const idBearingFields = ["factualClaims", "analysis", "hypotheses", "limitations"] as const;
  for (const field of idBearingFields) {
    for (const item of answer[field] as readonly { readonly id?: string }[]) {
      if (!isNonEmptyString(item.id)) continue;
      const previousField = seenIds.get(item.id);
      if (previousField && previousField !== field) {
        errors.push(
          `id "${item.id}" duplicado entre categorias diferentes ("${previousField}" e "${field}") — cada id citável de um ExecutiveChatAnswer deve ser único entre as 4 categorias.`
        );
      } else if (!previousField) {
        seenIds.set(item.id, field);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
