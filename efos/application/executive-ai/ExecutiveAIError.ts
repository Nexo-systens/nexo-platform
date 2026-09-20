/**
 * Vocabulário fechado de falha de um `ExecutiveAIProvider` (Mission
 * 116). `"PROVIDER_UNAVAILABLE"`/`"PROVIDER_TIMEOUT"` — falhas de
 * infraestrutura do provider em si (rede, indisponibilidade,
 * excedeu o tempo). `"INVALID_INSTRUCTION"` (Mission 117) —
 * `buildExecutiveAIInstruction()` produziu uma instrução que
 * `validateExecutiveAIInstruction()` rejeitou **antes** de qualquer
 * chamada ao provider (ex.: contexto ausente, objetivo pedindo
 * decisão) — nunca deveria ocorrer em uso normal (a instrução é
 * sempre construída a partir das constantes fixas do módulo), mas
 * representável para o caso de uma instrução malformada chegar por
 * outro caminho. `"INVALID_PROVIDER_RESPONSE"` — a resposta não tem
 * sequer a forma mínima esperada (não é um objeto, faltam campos
 * estruturais). `"VALIDATION_FAILED"` — a resposta tem a forma certa,
 * mas `validateExecutiveDiagnosis()` (D-059) rejeitou o conteúdo (ex.:
 * interpretação sem `basis`, ou um campo de autoridade proibida como
 * `decision`/`outcome`/`financialTruth` presente).
 */
export const EXECUTIVE_AI_ERROR_CODES = [
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "INVALID_INSTRUCTION",
  "INVALID_PROVIDER_RESPONSE",
  "VALIDATION_FAILED",
] as const;

export type ExecutiveAIErrorCode = (typeof EXECUTIVE_AI_ERROR_CODES)[number];

/**
 * Erro tipado e seguro para apresentação — `message` nunca é um stack
 * trace bruto, nunca contém API key/credencial, nunca serializa um
 * objeto de SDK interno do provider. Um provider real (futuro,
 * implementado fora desta missão) é responsável por traduzir
 * qualquer exceção de sua própria SDK para este formato antes dela
 * cruzar a fronteira do EFOS Core.
 */
export interface ExecutiveAIError {
  readonly code: ExecutiveAIErrorCode;
  readonly message: string;
  readonly providerName?: string;
  /**
   * Mission 133 — campos puramente diagnósticos, nunca usados para
   * decidir `code`/confiabilidade (essa decisão continua exclusiva do
   * vocabulário fechado acima) e nunca contendo API key/credencial/
   * header de autorização — `mapAnthropicErrorToExecutiveAIError()`
   * (Etapa 3) só encaminha `status`/`type`/`message` que o próprio SDK
   * Anthropic já trata como seguros para apresentação (a mensagem de
   * erro da API nunca ecoa a chave usada na requisição), mais uma
   * passagem de sanitização própria como defesa em profundidade.
   * Existem para que uma falha sem classificação específica (ex.: a
   * `PROVIDER_UNAVAILABLE` genérica da Mission 132, `code`/`status`
   * desconhecidos) se torne autoexplicável sem exigir uma nova chamada
   * só para diagnosticar.
   */
  readonly rawErrorClass?: string;
  readonly rawErrorMessage?: string;
  readonly httpStatus?: number;
  readonly errorType?: string;
}
