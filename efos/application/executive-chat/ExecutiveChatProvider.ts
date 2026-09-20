import type { ExecutiveAIResponse } from "@/efos/application/executive-ai";

import type { ExecutiveChatRequest } from "./ExecutiveChatRequest";

/**
 * Porta (Ports & Adapters) para um provedor de IA conversacional
 * (Mission 188) — sibling deliberado de `ExecutiveAIProvider`
 * (D-060/Mission 116), nunca uma generalização dele: `ExecutiveAIProvider.analyze()`
 * é estruturalmente amarrado a `ExecutiveAIRequest` (que carrega
 * `instruction: ExecutiveAIInstruction`, cujo `outputContract` é um
 * literal fixo `"ExecutiveDiagnosis"`) — generalizar esse contrato para
 * aceitar um segundo formato de instrução tocaria 20+ missões de
 * código de produção já endurecido (`executeExecutiveAnalysis()`,
 * `AnthropicExecutiveAIProvider`, todo o pipeline de 2 stages) por um
 * ganho nenhum, já que os dois formatos de saída (`ExecutiveDiagnosis`
 * vs. `ExecutiveChatAnswer`) são estruturalmente diferentes e nunca
 * intercambiáveis. Ver `docs/DECISIONS.md`, D-103.
 *
 * A resposta (`ExecutiveAIResponse`) É reaproveitada, sem nenhuma
 * modificação — seu shape (`{providerName, model?, output: unknown,
 * receivedAt, stopReason?}`) já não carrega nada específico de
 * Diagnosis; `output: unknown` já é, por construção, o mesmo
 * envelope UNTRUSTED que qualquer resposta de IA precisa. Reaproveitar
 * este tipo, em vez de duplicá-lo como `ExecutiveChatResponse`, é
 * exatamente o tipo de reuso que a missão pede (Seção 6) — apenas o
 * lado da REQUISIÇÃO (`instruction`) precisa de um tipo próprio.
 *
 * `EFOS CORE depends on abstraction, NOT provider` — mesma regra
 * central de D-060: nenhum arquivo de `efos/` (Domain/Engines/
 * Application) importa Claude/OpenAI/qualquer SDK de IA. Uma
 * implementação real (`AnthropicExecutiveChatProvider`) pertence à
 * Infrastructure Layer (`efos/infrastructure/executive-chat/`).
 */
export interface ExecutiveChatProvider {
  readonly providerName: string;

  converse(request: ExecutiveChatRequest): Promise<ExecutiveAIResponse>;
}
