import type { ExecutiveChatPriorMessage } from "@/efos/application/executive-chat";

/**
 * Mission 188 — limites simples e explícitos (Seção 38, "oversized
 * question if existing conventions support limits"). Nenhuma métrica
 * de custo/token complexa é construída aqui (Seção 29 — "do not
 * prematurely build complex metering") — apenas um teto honesto para
 * evitar uma requisição desproporcional, documentado como decisão
 * inicial, não uma medição real de produção ainda.
 */
export const MAX_QUESTION_LENGTH = 2000;
export const MAX_PRIOR_MESSAGES = 20;
export const MAX_PRIOR_MESSAGE_LENGTH = 4000;

export type ValidateChatQuestionResult = { readonly valid: true; readonly text: string } | { readonly valid: false; readonly error: string };

/**
 * Extraída da Server Action (`executive-chat.actions.ts`) para um
 * módulo puro e testável diretamente — mesmo padrão já estabelecido
 * por `selectCurrentFinancialExecution.ts`/`buildOutcome.ts` em
 * `modules/decisions/lib/`: arquivos `"use server"` só podem exportar
 * funções assíncronas, então esta lógica pura (síncrona, sem I/O)
 * nunca poderia ser testada diretamente de dentro da Server Action.
 */
export function validateChatQuestion(rawQuestion: string): ValidateChatQuestionResult {
  const text = rawQuestion.trim();
  if (text.length === 0) {
    return { valid: false, error: "Digite uma pergunta antes de enviar." };
  }
  if (text.length > MAX_QUESTION_LENGTH) {
    return { valid: false, error: `A pergunta excede o limite de ${MAX_QUESTION_LENGTH} caracteres.` };
  }
  return { valid: true, text };
}

/**
 * Sanitiza o histórico session-local enviado pelo client (Seção 21/22
 * — nunca canônico, apenas dado de conversa). Mantém apenas as últimas
 * `MAX_PRIOR_MESSAGES` mensagens, descarta qualquer item com `role`
 * fora do vocabulário fechado ou conteúdo vazio, e trunca cada
 * conteúdo em `MAX_PRIOR_MESSAGE_LENGTH` caracteres — nunca confia no
 * client para respeitar esses limites sozinho.
 */
export function sanitizePriorMessages(raw: readonly { readonly role: string; readonly content: string }[] | undefined): readonly ExecutiveChatPriorMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(-MAX_PRIOR_MESSAGES)
    .filter((message): message is { role: "user" | "assistant"; content: string } => {
      return (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.trim().length > 0;
    })
    .map((message) => ({ role: message.role, content: message.content.trim().slice(0, MAX_PRIOR_MESSAGE_LENGTH) }));
}
