import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";
import type { ExecutiveKnowledgeContext } from "@/efos/application/executive-knowledge-context";

import {
  EXECUTIVE_CHAT_AUTHORITY,
  EXECUTIVE_CHAT_CONSTRAINTS,
  EXECUTIVE_CHAT_OBJECTIVE,
  EXECUTIVE_CHAT_OUTPUT_CONTRACT,
  type ExecutiveChatInstruction,
  type ExecutiveChatPriorMessage,
  type ExecutiveChatQuestion,
} from "./ExecutiveChatInstruction";

/**
 * Constrói um `ExecutiveChatInstruction` (Mission 188) — mesmo
 * precedente de `buildExecutiveAIInstruction()` (D-061): função pura,
 * determinística, sem I/O. `context`/`knowledgeContext` nunca são
 * transformados — atribuídos por referência direta, exatamente como
 * `buildExecutiveAIInstruction()` já garante para Executive Diagnosis.
 * `instructionId` é recebido como parâmetro (nunca `crypto.randomUUID()`
 * interno). `priorMessages` tem padrão `[]` — "nenhuma mensagem
 * anterior ainda" é um estado normal de início de conversa, nunca a
 * ausência de um conceito (por isso não é opcional como
 * `knowledgeContext`).
 */
export function buildExecutiveChatInstruction(
  context: ExecutiveFinancialContext,
  instructionId: string,
  question: ExecutiveChatQuestion,
  knowledgeContext?: ExecutiveKnowledgeContext,
  priorMessages: readonly ExecutiveChatPriorMessage[] = []
): ExecutiveChatInstruction {
  return {
    instructionId,
    context,
    ...(knowledgeContext ? { knowledgeContext } : {}),
    question,
    priorMessages,
    objective: EXECUTIVE_CHAT_OBJECTIVE,
    authority: EXECUTIVE_CHAT_AUTHORITY,
    outputContract: EXECUTIVE_CHAT_OUTPUT_CONTRACT,
    constraints: EXECUTIVE_CHAT_CONSTRAINTS,
  };
}
