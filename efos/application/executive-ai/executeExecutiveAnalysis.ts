import type { ExecutiveDiagnosis } from "@/efos/application/executive-diagnosis";
import { validateExecutiveDiagnosis } from "@/efos/application/executive-diagnosis";
import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";
import { validateExecutiveFinancialContextReferences } from "@/efos/application/executive-context";
import type { ExecutiveKnowledgeContext } from "@/efos/application/executive-knowledge-context";
import { validateKnowledgeReferences } from "@/efos/application/executive-knowledge-context";
import {
  buildExecutiveAIInstruction,
  validateExecutiveAIInstruction,
} from "@/efos/application/executive-ai-instruction";
import type { Result } from "@/efos/application/shared";

import {
  EXECUTIVE_AI_ERROR_CODES,
  type ExecutiveAIError,
} from "./ExecutiveAIError";
import type { ExecutiveAIProvider } from "./ExecutiveAIProvider";

export type ExecutiveAIResult = Result<ExecutiveDiagnosis, ExecutiveAIError>;

const DIAGNOSIS_ARRAY_FIELDS = [
  "interpretations",
  "hypotheses",
  "risks",
  "priorities",
  "possibleActions",
  "questions",
  "uncertainties",
  "conflictInterpretations",
] as const;

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
 * Checagem estrutural mínima antes de `validateExecutiveDiagnosis()`
 * (D-059) — o validator da Mission 115 assume um `ExecutiveDiagnosis`
 * já bem-formado em TypeScript (itera `diagnosis.interpretations`
 * etc. diretamente); uma resposta externa genuinamente malformada
 * (`output` não é nem objeto, ou tem `interpretations` como string em
 * vez de array) lançaria uma exceção não tratada em vez de produzir
 * um erro `INVALID_PROVIDER_RESPONSE` limpo. Esta função nunca
 * verifica conteúdo semântico — só a forma mínima (campos presentes,
 * arrays são arrays) — antes de repassar ao validator real.
 */
function looksLikeExecutiveDiagnosis(value: unknown): value is ExecutiveDiagnosis {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (!isPlainObject(value.basedOn)) return false;
  if (!isPlainObject(value.executiveSummary)) return false;
  if (!isPlainObject(value.boundaries)) return false;
  return DIAGNOSIS_ARRAY_FIELDS.every((field) => Array.isArray(value[field]));
}

/**
 * Mission 130 — descreve, sem revalidar nada, exatamente quais campos
 * mínimos `looksLikeExecutiveDiagnosis()` já rejeitou, para que uma
 * falha `INVALID_PROVIDER_RESPONSE` seja autoexplicável (achado da
 * Mission 129: a mensagem genérica anterior não permitiu diagnosticar
 * a causa real sem uma segunda chamada ao provider). Nunca usada para
 * decidir `valid`/`invalid` — é chamada só depois que
 * `looksLikeExecutiveDiagnosis()` já retornou `false`, puramente para
 * relatar o motivo.
 */
function describeMinimalShapeIssues(value: unknown): readonly string[] {
  if (!isPlainObject(value)) return ["<resposta do provider não é um objeto>"];

  const issues: string[] = [];
  if (typeof value.id !== "string") issues.push("id");
  if (!isPlainObject(value.basedOn)) issues.push("basedOn");
  if (!isPlainObject(value.executiveSummary)) issues.push("executiveSummary");
  if (!isPlainObject(value.boundaries)) issues.push("boundaries");
  for (const field of DIAGNOSIS_ARRAY_FIELDS) {
    if (!Array.isArray(value[field])) issues.push(field);
  }
  return issues;
}

/**
 * Ponto de composição único e obrigatório entre um `ExecutiveFinancialContext`
 * e o resto do EFOS (Mission 116, Etapa 13; revisado pela Mission 117,
 * Etapa 17, para incluir a construção/validação da instrução).
 * Responsabilidade completa: **(1)** recebe `ExecutiveFinancialContext`
 * e `instructionId`; **(2)** constrói a `ExecutiveAIInstruction`
 * (`buildExecutiveAIInstruction()`, puro, sem I/O); **(3)** valida a
 * instrução (`validateExecutiveAIInstruction()`) — nunca chama o
 * provider com uma instrução inválida; **(4)** chama
 * `provider.analyze({instruction})`; **(5)** recebe
 * `ExecutiveAIResponse` (UNTRUSTED); **(6)** valida a resposta
 * (`looksLikeExecutiveDiagnosis()` + `validateExecutiveDiagnosis()`,
 * D-059, mais `validateKnowledgeReferences()`, D-081/Mission 149 —
 * garante que todo `knowledgeId` citado em `basis` realmente pertence
 * a `knowledgeContext.knowledge`); **(7)** converte para um `ExecutiveDiagnosis` confiável,
 * **desacoplado por valor** da resposta externa original
 * (`structuredClone`, nunca a mesma referência); **(8)** devolve
 * `Result<ExecutiveDiagnosis, ExecutiveAIError>`, nunca lança exceção.
 *
 * **Proibido em qualquer código de produção**: `return
 * aiResponse.output as ExecutiveDiagnosis` — este é o único lugar
 * autorizado a produzir um `ExecutiveDiagnosis` a partir de uma
 * resposta de provider, e mesmo aqui, apenas depois de validação
 * completa.
 *
 * `knowledgeContext?` (Mission 143 — Knowledge Injection into
 * Executive Analysis, D-075) — repassado, sem transformação, a
 * `buildExecutiveAIInstruction()`. Opcional: sua ausência produz
 * exatamente o mesmo comportamento de antes desta missão (Etapa 7 —
 * ausência de `Knowledge` nunca bloqueia a análise).
 */
export async function executeExecutiveAnalysis(
  provider: ExecutiveAIProvider,
  context: ExecutiveFinancialContext,
  instructionId: string,
  knowledgeContext?: ExecutiveKnowledgeContext
): Promise<ExecutiveAIResult> {
  const instruction = buildExecutiveAIInstruction(context, instructionId, knowledgeContext);
  const instructionValidation = validateExecutiveAIInstruction(instruction);

  if (!instructionValidation.valid) {
    return {
      success: false,
      error: {
        code: "INVALID_INSTRUCTION",
        message: instructionValidation.errors.join("; "),
      },
    };
  }

  try {
    const response = await provider.analyze({ instruction });

    if (!looksLikeExecutiveDiagnosis(response.output)) {
      const issues = describeMinimalShapeIssues(response.output);
      const stopReasonNote = response.stopReason ? ` stop_reason do provider: "${response.stopReason}".` : "";
      return {
        success: false,
        error: {
          code: "INVALID_PROVIDER_RESPONSE",
          message: `A resposta do provider "${response.providerName}" não tem a forma mínima de um ExecutiveDiagnosis. Campos ausentes/inválidos: ${issues.join(", ")}.${stopReasonNote}`,
          providerName: response.providerName,
        },
      };
    }

    const validation = validateExecutiveDiagnosis(response.output);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: validation.errors.join("; "),
          providerName: response.providerName,
        },
      };
    }

    // Mission 149 — Knowledge-Conditioned Executive Recommendation
    // Validation. `validateExecutiveDiagnosis()` (D-059) nunca recebe
    // contexto — nunca verificou, para nenhum campo de `basis`, se os
    // ids citados existem de fato. `validateKnowledgeReferences()`
    // (D-081) fecha essa lacuna especificamente para `knowledgeIds`
    // (D-080): rejeita qualquer citação a um Knowledge que não esteja
    // em `knowledgeContext.knowledge` — que, por construção
    // (`selectRelevantKnowledge()`, D-074), já garante empresa
    // correta, não-futuro, e validade estrutural. Reusa o mesmo código
    // de erro `VALIDATION_FAILED` (mesma categoria: conteúdo rejeitado
    // depois de já ter a forma certa) — nenhum código novo necessário.
    const knowledgeReferenceValidation = validateKnowledgeReferences(response.output, knowledgeContext);
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

    // Mission 163 — Executive Basis Traceability. Fecha a lacuna
    // irmã da acima, explicitamente reconhecida desde a Mission 149 e
    // reconfirmada pela Mission 162: nenhum validator jamais checou
    // `indicatorIds`/`evidenceIds`/`contextIds` contra o
    // `ExecutiveFinancialContext` real da análise. Mesma estratégia de
    // contenção de `validateKnowledgeReferences()` (D-081), mesmo
    // código de erro `VALIDATION_FAILED` — nenhuma segunda categoria de
    // erro necessária.
    const financialContextReferenceValidation = validateExecutiveFinancialContextReferences(response.output, context);
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

    const trusted: ExecutiveDiagnosis = structuredClone(response.output);
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
