import type { ExecutiveAIRequest } from "./ExecutiveAIRequest";
import type { ExecutiveAIResponse } from "./ExecutiveAIResponse";

/**
 * Porta (Ports & Adapters) para qualquer provedor de IA executiva
 * (Mission 116 — Executive AI Provider Boundary) — mesmo padrão já
 * estabelecido por `efos/application/ports/` (`StorageProvider`,
 * `DocumentRepository` etc.): contrato puro, nenhuma lógica de
 * negócio, implementação real pertence à Infrastructure Layer. Vive
 * em `executive-ai/` (não em `ports/`) porque acompanha os demais
 * contratos executivos (`executive-context/`, `executive-diagnosis/`)
 * — pequeno ajuste estrutural deliberado, mantendo o módulo coeso.
 *
 * `EFOS CORE depends on abstraction, NOT provider` — nenhum código de
 * `efos/` (Domain/Engines/Application) importa Claude/OpenAI/qualquer
 * SDK de IA; todos dependem exclusivamente desta interface. Uma
 * implementação concreta (`AnthropicExecutiveAIProvider`,
 * `OpenAIExecutiveAIProvider` etc.) seria criada em
 * `efos/infrastructure/`, fora do escopo desta missão — **nenhuma foi
 * criada aqui**.
 *
 * `analyze()` recebe contexto, produz resposta externa — nunca
 * autoridade financeira: o tipo de retorno é `ExecutiveAIResponse`
 * (`output: unknown`, UNTRUSTED), nunca `ExecutiveDiagnosis`
 * diretamente. Um provider não tem acesso a — e não pode ter, por não
 * receber nada além de `ExecutiveAIRequest` — Financial/Evidence/
 * Context/Decision/Outcome Engine, Supabase, banco de dados, ou
 * estado de UI/React.
 */
export interface ExecutiveAIProvider {
  readonly providerName: string;

  analyze(request: ExecutiveAIRequest): Promise<ExecutiveAIResponse>;
}
