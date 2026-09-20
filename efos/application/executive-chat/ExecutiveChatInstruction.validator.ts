import { EXECUTIVE_CHAT_CONSTRAINT_CODES } from "./ExecutiveChatInstruction";
import type { ExecutiveChatInstruction } from "./ExecutiveChatInstruction";

export interface ExecutiveChatInstructionValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const AUTHORITY_MAY_FIELDS = [
  "mayAnswerQuestions",
  "mayInterpret",
  "mayFormulateHypotheses",
  "mayExplainExistingRecommendations",
  "mayReferenceKnowledge",
  "mayExpressUncertainty",
] as const;

const AUTHORITY_MUST_NOT_FIELDS = [
  "mustNotAlterFinancialTruth",
  "mustNotInventConfirmedFacts",
  "mustNotMakeDecisions",
  "mustNotExecuteActions",
  "mustNotProduceOutcomes",
  "mustNotCreateRecommendations",
  "mustNotSimulateScenarios",
  "mustNotFabricateForecasts",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Mesma checagem de `unknownsRemainUnknown()` em
 * `ExecutiveAIInstruction.validator.ts` (D-061, Mission 117) — aplicada
 * aqui porque `ExecutiveChatInstruction.context` é o MESMO tipo
 * `ExecutiveFinancialContext`, sujeito à mesma regra: nenhum indicador
 * ausente pode aparecer como disponível.
 */
function unknownsRemainUnknown(instruction: ExecutiveChatInstruction): boolean {
  const { unknowns, financialTruth } = instruction.context;
  return unknowns.every((unknown) => {
    const indicator = financialTruth.indicators.find((i) => i.name === unknown.subject);
    return !indicator || indicator.result.status === "unavailable";
  });
}

/**
 * Valida um `ExecutiveChatInstruction` contra as regras mínimas de
 * integridade da Mission 188 — mesmo espírito de
 * `validateExecutiveAIInstruction()` (D-061). Nunca lança exceção,
 * sempre devolve a lista completa de problemas encontrados.
 */
export function validateExecutiveChatInstruction(
  instruction: ExecutiveChatInstruction
): ExecutiveChatInstructionValidationResult {
  const errors: string[] = [];

  if (!instruction.context) {
    errors.push("ExecutiveChatInstruction.context é obrigatório — nenhuma instrução pode existir sem um ExecutiveFinancialContext real.");
    return { valid: false, errors };
  }

  if (typeof instruction.instructionId !== "string" || instruction.instructionId.trim().length === 0) {
    errors.push("ExecutiveChatInstruction.instructionId é obrigatório.");
  }

  if (typeof instruction.question?.text !== "string" || instruction.question.text.trim().length === 0) {
    errors.push("ExecutiveChatInstruction.question.text é obrigatório e não pode ser vazio.");
  }

  if (!Array.isArray(instruction.priorMessages)) {
    errors.push("ExecutiveChatInstruction.priorMessages é obrigatório (use [] quando não houver histórico).");
  }

  if (!instruction.objective?.statement) {
    errors.push("objective.statement é obrigatório e não pode ser vazio.");
  }

  if (!isPlainObject(instruction.authority)) {
    errors.push("authority é obrigatório.");
  } else {
    for (const field of AUTHORITY_MUST_NOT_FIELDS) {
      if (instruction.authority[field] !== true) {
        errors.push(`authority.${field} deve ser exatamente true — a autoridade do chat nunca pode permitir execução/decisão/recomendação/simulação/previsão fabricada.`);
      }
    }
    for (const field of AUTHORITY_MAY_FIELDS) {
      if (instruction.authority[field] !== true) {
        errors.push(`authority.${field} deve ser exatamente true — os limites de "pode" também são fixos e obrigatórios.`);
      }
    }
  }

  const presentCodes = new Set((instruction.constraints ?? []).map((c) => c.code));
  for (const requiredCode of EXECUTIVE_CHAT_CONSTRAINT_CODES) {
    if (!presentCodes.has(requiredCode)) {
      errors.push(`constraint obrigatória ausente: ${requiredCode} — nenhum constraint pode ser omitido.`);
    }
  }

  if (!isPlainObject(instruction.outputContract)) {
    errors.push("outputContract é obrigatório.");
  } else {
    if (instruction.outputContract.expectedShape !== "ExecutiveChatAnswer") {
      errors.push(`outputContract.expectedShape deve ser exatamente "ExecutiveChatAnswer" (obtido: "${instruction.outputContract.expectedShape}").`);
    }
    if (instruction.outputContract.untrustedUntilValidated !== true) {
      errors.push("outputContract.untrustedUntilValidated deve ser exatamente true.");
    }
  }

  if (!unknownsRemainUnknown(instruction)) {
    errors.push("um ou mais itens de context.unknowns aparecem como indicador 'available' em financialTruth — ausência nunca pode ser silenciosamente convertida em fato/zero.");
  }

  const foreignKnowledge = (instruction.knowledgeContext?.knowledge ?? []).filter(
    (knowledge) => knowledge.companyId !== instruction.context.identity.companyId
  );
  if (foreignKnowledge.length > 0) {
    errors.push(
      `knowledgeContext.knowledge contém Knowledge de empresa diferente de context.identity.companyId ("${instruction.context.identity.companyId}") — ids: ${foreignKnowledge.map((k) => `${k.id} (${k.companyId})`).join(", ")}.`
    );
  }

  const foreignEpisodes = (instruction.context.financialEpisodes ?? []).filter(
    (episode) => episode.companyId !== instruction.context.identity.companyId
  );
  if (foreignEpisodes.length > 0) {
    errors.push(
      `context.financialEpisodes contém episódio de empresa diferente de context.identity.companyId ("${instruction.context.identity.companyId}") — metricKeys: ${foreignEpisodes.map((e) => `${e.metricKey} (${e.companyId})`).join(", ")}.`
    );
  }

  return { valid: errors.length === 0, errors };
}
