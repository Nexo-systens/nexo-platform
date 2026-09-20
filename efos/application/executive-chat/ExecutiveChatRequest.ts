import type { ExecutiveChatInstruction } from "./ExecutiveChatInstruction";

/**
 * Requisição enviada a um `ExecutiveChatProvider` (Mission 188) — mesmo
 * precedente estrutural de `ExecutiveAIRequest` (D-061): carrega
 * **exclusivamente** `instruction: ExecutiveChatInstruction`, nunca
 * `context`/`question` soltos (a instrução é a unidade canônica
 * entregue ao provider). Deliberadamente **nunca** contém:
 * `Decision`/`Outcome`/`Recommendation`/`Scenario` (nenhum desses
 * conceitos é sequer representável neste tipo), cliente de banco/
 * Supabase, estado de UI/React.
 */
export interface ExecutiveChatRequest {
  readonly instruction: ExecutiveChatInstruction;
  readonly requestId?: string;
  readonly requestedAt?: string;
}
