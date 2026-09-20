import { EXECUTIVE_AI_CONSTRAINT_CODES } from "./ExecutiveAIInstruction";
import type { ExecutiveAIInstruction } from "./ExecutiveAIInstruction";

export interface ExecutiveAIInstructionValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Palavras cujo aparecimento no `objective.statement` indicaria uma
 * instrução pedindo decisão/execução/aprovação — nunca permitido
 * (Etapa 6/15, Cenário B). Checagem case-insensitive, substring
 * simples — suficiente para o vocabulário fechado que
 * `EXECUTIVE_AI_OBJECTIVE` usa; não é um parser de linguagem natural.
 */
const FORBIDDEN_OBJECTIVE_WORDS = [
  "make the decision",
  "decide",
  "execute",
  "approve",
  "reject the",
  "modify the financial data",
];

const AUTHORITY_MAY_FIELDS = [
  "mayInterpret",
  "mayFormulateHypotheses",
  "mayAssessInferredRisk",
  "mayPrioritize",
  "maySuggestPossibleActions",
  "mayAskQuestions",
  "mayExpressUncertainty",
  "mayInterpretConflicts",
] as const;

const AUTHORITY_MUST_NOT_FIELDS = [
  "mustNotAlterFinancialTruth",
  "mustNotInventConfirmedFacts",
  "mustNotMakeDecisions",
  "mustNotExecuteActions",
  "mustNotProduceOutcomes",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Confirma que `context.unknowns` permanece consistente com
 * `context.financialTruth.indicators` — todo indicador citado como
 * `Unknown` (`subject === indicator.name`) precisa continuar
 * `unavailable`. Se um indicador que era `Unknown` aparecer
 * `available` com um valor, algo na cadeia converteu ausência em fato
 * (ex.: `0`) — exatamente o que a Etapa 10 proíbe. Esta é a checagem
 * concreta por trás do Cenário F ("Unknown convertido em zero").
 */
function unknownsRemainUnknown(instruction: ExecutiveAIInstruction): boolean {
  const { unknowns, financialTruth } = instruction.context;
  return unknowns.every((unknown) => {
    const indicator = financialTruth.indicators.find((i) => i.name === unknown.subject);
    return !indicator || indicator.result.status === "unavailable";
  });
}

/**
 * Valida um `ExecutiveAIInstruction` contra as regras mínimas de
 * integridade da Mission 117 (Etapa 15) — nunca lança exceção, sempre
 * devolve a lista completa de problemas encontrados.
 */
export function validateExecutiveAIInstruction(
  instruction: ExecutiveAIInstruction
): ExecutiveAIInstructionValidationResult {
  const errors: string[] = [];

  // Cenário A — contexto ausente.
  if (!instruction.context) {
    errors.push("ExecutiveAIInstruction.context é obrigatório — nenhuma instrução pode existir sem um ExecutiveFinancialContext real.");
    return { valid: false, errors };
  }

  if (typeof instruction.instructionId !== "string" || instruction.instructionId.trim().length === 0) {
    errors.push("ExecutiveAIInstruction.instructionId é obrigatório.");
  }

  // Cenário B — objetivo pede decisão/execução.
  const objectiveStatement = (instruction.objective?.statement ?? "").toLowerCase();
  const forbiddenWordFound = FORBIDDEN_OBJECTIVE_WORDS.find((word) => objectiveStatement.includes(word));
  if (forbiddenWordFound) {
    errors.push(`objective.statement contém linguagem proibida ("${forbiddenWordFound}") — o objetivo nunca pode pedir decisão/execução/aprovação.`);
  }
  if (!objectiveStatement) {
    errors.push("objective.statement é obrigatório e não pode ser vazio.");
  }

  // Cenário C — autoridade permite execução (ou omite qualquer limite "must not").
  if (!isPlainObject(instruction.authority)) {
    errors.push("authority é obrigatório.");
  } else {
    for (const field of AUTHORITY_MUST_NOT_FIELDS) {
      if (instruction.authority[field] !== true) {
        errors.push(`authority.${field} deve ser exatamente true — a autoridade da IA nunca pode permitir execução/decisão/alteração de fato/produção de outcome.`);
      }
    }
    for (const field of AUTHORITY_MAY_FIELDS) {
      if (instruction.authority[field] !== true) {
        errors.push(`authority.${field} deve ser exatamente true — os limites de "pode" também são fixos e obrigatórios (D-059/Mission 117).`);
      }
    }
  }

  // Cenário D — constraint DO_NOT_INVENT_FACTS (ou qualquer outro dos 8) removida.
  const presentCodes = new Set((instruction.constraints ?? []).map((c) => c.code));
  for (const requiredCode of EXECUTIVE_AI_CONSTRAINT_CODES) {
    if (!presentCodes.has(requiredCode)) {
      errors.push(`constraint obrigatória ausente: ${requiredCode} — os 8 constraints são sempre exigidos, nenhum pode ser omitido.`);
    }
  }

  // Cenário E — output contract diferente de ExecutiveDiagnosis.
  if (!isPlainObject(instruction.outputContract)) {
    errors.push("outputContract é obrigatório.");
  } else {
    if (instruction.outputContract.expectedShape !== "ExecutiveDiagnosis") {
      errors.push(`outputContract.expectedShape deve ser exatamente "ExecutiveDiagnosis" (obtido: "${instruction.outputContract.expectedShape}") — nenhum formato paralelo de diagnóstico é permitido.`);
    }
    if (instruction.outputContract.untrustedUntilValidated !== true) {
      errors.push("outputContract.untrustedUntilValidated deve ser exatamente true — a saída da IA é sempre untrusted até validação.");
    }
  }

  // Cenário F — Unknown convertido em zero (inconsistência entre unknowns e financialTruth).
  if (!unknownsRemainUnknown(instruction)) {
    errors.push("um ou mais itens de context.unknowns aparecem como indicador 'available' em financialTruth — ausência nunca pode ser silenciosamente convertida em fato/zero.");
  }

  // Mission 162 — Company-Boundary Integrity Validation. `knowledgeContext.knowledge`
  // já deveria pertencer inteiramente à mesma empresa de `context`
  // (garantido por composição, `selectRelevantKnowledge()`/D-074, sempre
  // que `knowledgeContext` foi construído corretamente a partir do
  // `RelevanceContext.companyId` certo) — mas nada impedia estruturalmente
  // um chamador de parear um `ExecutiveKnowledgeContext` de uma empresa
  // com o `context` (Financial Truth) de OUTRA. Esta é a última barreira
  // antes de `context`/`knowledgeContext` chegarem a um
  // `ExecutiveAIProvider` real — o mesmo tipo de checagem que
  // `buildExecutiveFinancialContext()` (Mission 162) já aplica entre os
  // agregados que compõem `context` isoladamente.
  const foreignKnowledge = (instruction.knowledgeContext?.knowledge ?? []).filter(
    (knowledge) => knowledge.companyId !== instruction.context.identity.companyId
  );
  if (foreignKnowledge.length > 0) {
    errors.push(
      `knowledgeContext.knowledge contém Knowledge de empresa diferente de context.identity.companyId ("${instruction.context.identity.companyId}") — ids: ${foreignKnowledge.map((k) => `${k.id} (${k.companyId})`).join(", ")} — nunca combinar Knowledge de uma empresa com Financial Truth de outra na mesma instrução.`
    );
  }

  // Mission 172 — Integrate Financial Episode Intelligence into
  // ExecutiveFinancialContext. Mesmo padrão do `foreignKnowledge`
  // acima: `context.financialEpisodes`, quando presente, deveria
  // pertencer inteiramente à mesma empresa de `context.identity`
  // (garantido por composição, `buildFinancialEpisodeIntelligence()`,
  // sempre que chamado corretamente) — última barreira antes de um
  // `ExecutiveAIProvider` real, mesmo espírito de defesa em
  // profundidade já aplicado a `knowledgeContext.knowledge`.
  const foreignEpisodes = (instruction.context.financialEpisodes ?? []).filter(
    (episode) => episode.companyId !== instruction.context.identity.companyId
  );
  if (foreignEpisodes.length > 0) {
    errors.push(
      `context.financialEpisodes contém episódio de empresa diferente de context.identity.companyId ("${instruction.context.identity.companyId}") — metricKeys: ${foreignEpisodes.map((e) => `${e.metricKey} (${e.companyId})`).join(", ")} — nunca combinar episódios financeiros de uma empresa com Financial Truth de outra na mesma instrução.`
    );
  }

  return { valid: errors.length === 0, errors };
}
