import type { ExecutiveChatInstruction } from "@/efos/application/executive-chat";

/**
 * Mesmo precedente de `serializeExecutiveAIInstruction()`
 * (`executive-ai`, Mission 118): cópia estrutural fiel via
 * `JSON.parse(JSON.stringify(...))`, nunca uma reescrita campo a campo.
 * `context`/`knowledgeContext` permanecem 2 chaves de topo separadas de
 * `question`/`priorMessages` — nunca fundidas.
 */
export type ExecutiveChatInstructionPayload = Readonly<Record<string, unknown>>;

export function serializeExecutiveChatInstruction(instruction: ExecutiveChatInstruction): ExecutiveChatInstructionPayload {
  return JSON.parse(JSON.stringify(instruction)) as ExecutiveChatInstructionPayload;
}
