import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";
import type { ExecutiveKnowledgeContext } from "@/efos/application/executive-knowledge-context";
import { EXECUTIVE_AI_ERROR_CODES, type ExecutiveAIError } from "@/efos/application/executive-ai";
import type { Result } from "@/efos/application/shared";

import { buildExecutiveChatInstruction } from "./ExecutiveChatInstruction.builder";
import { validateExecutiveChatInstruction } from "./ExecutiveChatInstruction.validator";
import type { ExecutiveChatPriorMessage, ExecutiveChatQuestion } from "./ExecutiveChatInstruction";
import type { ExecutiveChatProvider } from "./ExecutiveChatProvider";
import type { ExecutiveChatAnswer } from "./ExecutiveChatAnswer.types";
import { validateExecutiveChatAnswer } from "./ExecutiveChatAnswer.validator";
import { validateExecutiveChatKnowledgeReferences } from "./validateExecutiveChatKnowledgeReferences";
import { validateExecutiveChatFinancialContextReferences } from "./validateExecutiveChatFinancialContextReferences";

export type ExecutiveChatResult = Result<ExecutiveChatAnswer, ExecutiveAIError>;

const CHAT_ANSWER_ARRAY_FIELDS = ["factualClaims", "analysis", "hypotheses", "limitations"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isExecutiveAIErrorLike(value: unknown): value is ExecutiveAIError {
  return (
    isPlainObject(value) &&
    typeof value.code === "string" &&
    (EXECUTIVE_AI_ERROR_CODES as readonly string[]).includes(value.code) &&
    typeof value.message === "string"
  );
}

/**
 * Checagem estrutural mínima antes de `validateExecutiveChatAnswer()`
 * — mesmo precedente de `looksLikeExecutiveDiagnosis()`
 * (`executeExecutiveAnalysis.ts`, Mission 130).
 */
function looksLikeExecutiveChatAnswer(value: unknown): value is ExecutiveChatAnswer {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.answer !== "string") return false;
  if (typeof value.groundingStatus !== "string") return false;
  if (typeof value.requiresScenarioSimulation !== "boolean") return false;
  if (!isPlainObject(value.basedOn)) return false;
  if (!isPlainObject(value.boundaries)) return false;
  // Mission 189 — proposedActions é opcional (D-104): só precisa ser um
  // array QUANDO presente, nunca exigido.
  if (value.proposedActions !== undefined && !Array.isArray(value.proposedActions)) return false;
  return CHAT_ANSWER_ARRAY_FIELDS.every((field) => Array.isArray(value[field]));
}

function describeMinimalShapeIssues(value: unknown): readonly string[] {
  if (!isPlainObject(value)) return ["<resposta do provider não é um objeto>"];

  const issues: string[] = [];
  if (typeof value.id !== "string") issues.push("id");
  if (typeof value.answer !== "string") issues.push("answer");
  if (typeof value.groundingStatus !== "string") issues.push("groundingStatus");
  if (typeof value.requiresScenarioSimulation !== "boolean") issues.push("requiresScenarioSimulation");
  if (!isPlainObject(value.basedOn)) issues.push("basedOn");
  if (!isPlainObject(value.boundaries)) issues.push("boundaries");
  for (const field of CHAT_ANSWER_ARRAY_FIELDS) {
    if (!Array.isArray(value[field])) issues.push(field);
  }
  if (value.proposedActions !== undefined && !Array.isArray(value.proposedActions)) {
    issues.push("proposedActions");
  }
  return issues;
}

/**
 * Ponto de composição único e obrigatório entre um pergunta executiva
 * e o resto do EFOS (Mission 188) — mesmo precedente de
 * `executeExecutiveAnalysis()` (Mission 116/117): **(1)** constrói a
 * `ExecutiveChatInstruction` (puro, sem I/O); **(2)** valida a
 * instrução; **(3)** chama `provider.converse({instruction})`;
 * **(4)** recebe `ExecutiveAIResponse` (UNTRUSTED); **(5)** valida a
 * resposta (`looksLikeExecutiveChatAnswer()` + `validateExecutiveChatAnswer()`,
 * mais `validateExecutiveChatKnowledgeReferences()`/
 * `validateExecutiveChatFinancialContextReferences()` — nenhuma
 * referência a Indicator/Evidence/Context/Knowledge inexistente ou de
 * outra empresa é aceita como lineage válida, mesmo padrão de D-081/
 * Mission 163); **(6)** converte para um `ExecutiveChatAnswer`
 * confiável, **desacoplado por valor** (`structuredClone`);
 * **(7)** devolve `Result<ExecutiveChatAnswer, ExecutiveAIError>`,
 * nunca lança exceção.
 *
 * **Proibido em qualquer código de produção**: `return
 * response.output as ExecutiveChatAnswer` — este é o único lugar
 * autorizado a produzir um `ExecutiveChatAnswer` a partir de uma
 * resposta de provider.
 */
export async function executeExecutiveChatAnalysis(
  provider: ExecutiveChatProvider,
  context: ExecutiveFinancialContext,
  instructionId: string,
  question: ExecutiveChatQuestion,
  knowledgeContext?: ExecutiveKnowledgeContext,
  priorMessages?: readonly ExecutiveChatPriorMessage[]
): Promise<ExecutiveChatResult> {
  const instruction = buildExecutiveChatInstruction(context, instructionId, question, knowledgeContext, priorMessages);
  const instructionValidation = validateExecutiveChatInstruction(instruction);

  if (!instructionValidation.valid) {
    return {
      success: false,
      error: { code: "INVALID_INSTRUCTION", message: instructionValidation.errors.join("; ") },
    };
  }

  try {
    const response = await provider.converse({ instruction });

    if (!looksLikeExecutiveChatAnswer(response.output)) {
      const issues = describeMinimalShapeIssues(response.output);
      const stopReasonNote = response.stopReason ? ` stop_reason do provider: "${response.stopReason}".` : "";
      return {
        success: false,
        error: {
          code: "INVALID_PROVIDER_RESPONSE",
          message: `A resposta do provider "${response.providerName}" não tem a forma mínima de um ExecutiveChatAnswer. Campos ausentes/inválidos: ${issues.join(", ")}.${stopReasonNote}`,
          providerName: response.providerName,
        },
      };
    }

    const validation = validateExecutiveChatAnswer(response.output);
    if (!validation.valid) {
      return {
        success: false,
        error: { code: "VALIDATION_FAILED", message: validation.errors.join("; "), providerName: response.providerName },
      };
    }

    const knowledgeReferenceValidation = validateExecutiveChatKnowledgeReferences(response.output, knowledgeContext);
    if (!knowledgeReferenceValidation.valid) {
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: knowledgeReferenceValidation.errors.join("; "),
          providerName: response.providerName,
        },
      };
    }

    const financialContextReferenceValidation = validateExecutiveChatFinancialContextReferences(response.output, context);
    if (!financialContextReferenceValidation.valid) {
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: financialContextReferenceValidation.errors.join("; "),
          providerName: response.providerName,
        },
      };
    }

    const trusted: ExecutiveChatAnswer = structuredClone(response.output);
    return { success: true, value: trusted };
  } catch (caught) {
    if (isExecutiveAIErrorLike(caught)) {
      return { success: false, error: caught };
    }

    return {
      success: false,
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message: `Provider "${provider.providerName}" falhou ao processar a solicitação.`,
        providerName: provider.providerName,
      },
    };
  }
}
