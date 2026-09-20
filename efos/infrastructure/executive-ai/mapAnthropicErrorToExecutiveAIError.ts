import Anthropic from "@anthropic-ai/sdk";
import type { ExecutiveAIError } from "@/efos/application/executive-ai";

const PROVIDER_NAME = "anthropic-claude";

/**
 * Mission 133 — redação defensiva de qualquer substring que se
 * pareça com uma chave de API Anthropic (`sk-ant-...`) ou um bearer
 * token genérico, aplicada a qualquer texto antes de entrar em
 * `ExecutiveAIError`. Camada extra, não a única proteção: o próprio
 * SDK já não ecoa a chave usada na requisição em `error.message`
 * (confirmado por leitura de `core/error.js`, `APIError.makeMessage()`
 * só usa o corpo de erro devolvido pela API, nunca os headers da
 * requisição) — esta função existe para o caso de uma mensagem de
 * erro nunca antes vista conter, por qualquer motivo, algo que pareça
 * um segredo.
 */
function redactSecrets(text: string): string {
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]{10,}/g, "[REDACTED_API_KEY]")
    .replace(/bearer\s+[A-Za-z0-9._-]{10,}/gi, "[REDACTED_TOKEN]");
}

/**
 * Extrai, de forma segura, o máximo de contexto diagnóstico possível
 * de uma exceção não reconhecida — Mission 133, Etapa 3. Nunca lê
 * `caught.headers` (poderia incluir cabeçalhos de requisição) e nunca
 * lê nenhum campo além de `constructor.name`/`message` (para
 * qualquer `Error`) e `status`/`type` (só quando `caught` já é uma
 * instância reconhecida de `Anthropic.APIError`, cujo `status`/`type`
 * vêm da resposta HTTP, nunca da requisição).
 */
function extractDiagnostics(caught: unknown): Pick<ExecutiveAIError, "rawErrorClass" | "rawErrorMessage" | "httpStatus" | "errorType"> {
  const rawErrorClass = caught instanceof Error ? caught.constructor.name : typeof caught;
  const rawErrorMessageSource = caught instanceof Error ? caught.message : String(caught);
  const rawErrorMessage = redactSecrets(rawErrorMessageSource);

  if (caught instanceof Anthropic.APIError) {
    return {
      rawErrorClass,
      rawErrorMessage,
      httpStatus: caught.status ?? undefined,
      errorType: caught.type ?? undefined,
    };
  }

  return { rawErrorClass, rawErrorMessage };
}

/**
 * Traduz qualquer exceção capturada ao chamar o SDK da Anthropic para
 * o vocabulário fechado `ExecutiveAIErrorCode` (Mission 118, Etapa 8) —
 * **nenhuma** exceção crua do SDK escapa da fronteira do provider;
 * `ExecutiveAIError.message` nunca é um stack trace, nunca contém a
 * API key (o SDK não a inclui em `error.message`, reforçado por
 * `redactSecrets()` como defesa em profundidade).
 *
 * Mission 133 — achado real: a `PROVIDER_UNAVAILABLE` genérica da
 * Mission 132 (round-trip de 563ms, incompatível com um round-trip
 * de rede completo mas também com os guards puramente client-side já
 * vistos) caiu no fallback final, que **descartava toda a informação
 * da exceção real** — nem `caught.constructor.name` nem
 * `caught.message` eram encaminhados. Todo branch agora popula
 * `rawErrorClass`/`rawErrorMessage`/`httpStatus`/`errorType`
 * (Etapa 3, campos diagnósticos de `ExecutiveAIError`) — a
 * classificação em `code` (vocabulário fechado, D-060) permanece
 * exatamente a mesma de antes, nunca enfraquecida ou expandida.
 *
 * Mapeamento (Etapa 8 original, preservado): `APIConnectionTimeoutError`/
 * `APIUserAbortError` → `PROVIDER_TIMEOUT`; `RateLimitError` →
 * `PROVIDER_TIMEOUT`; `AuthenticationError`/`PermissionDeniedError`
 * (API key ausente/inválida/sem permissão), `BadRequestError`/
 * `UnprocessableEntityError` (possível incompatibilidade de
 * schema/tool — Mission 133, Etapa 2, mensagem distinta para tornar
 * esse caso identificável sem precisar de outra chamada),
 * `APIConnectionError`, `InternalServerError`, `NotFoundError`,
 * `ConflictError`, qualquer outro `APIError`, e qualquer exceção não
 * reconhecida (ex.: `AnthropicError`/`RetryableError` lançados antes
 * de qualquer rede, como o guard de timeout já encontrado pela
 * Mission 131) → `PROVIDER_UNAVAILABLE` (D-060 já não distingue
 * causas mais específicas de indisponibilidade permanente no `code`
 * — a distinção fica nos campos diagnósticos, nunca no vocabulário
 * fechado).
 */
export function mapAnthropicErrorToExecutiveAIError(caught: unknown): ExecutiveAIError {
  const diagnostics = extractDiagnostics(caught);

  if (caught instanceof Anthropic.APIConnectionTimeoutError) {
    return {
      code: "PROVIDER_TIMEOUT",
      message: "A chamada ao provider Anthropic excedeu o tempo limite de conexão.",
      providerName: PROVIDER_NAME,
      ...diagnostics,
    };
  }

  if (caught instanceof Anthropic.APIUserAbortError) {
    return {
      code: "PROVIDER_TIMEOUT",
      message: "A chamada ao provider Anthropic foi interrompida antes de concluir.",
      providerName: PROVIDER_NAME,
      ...diagnostics,
    };
  }

  if (caught instanceof Anthropic.RateLimitError) {
    return {
      code: "PROVIDER_TIMEOUT",
      message: "O provider Anthropic está limitando a taxa de requisições no momento.",
      providerName: PROVIDER_NAME,
      ...diagnostics,
    };
  }

  if (caught instanceof Anthropic.AuthenticationError) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: "Falha de autenticação com o provider Anthropic (chave de API ausente ou inválida).",
      providerName: PROVIDER_NAME,
      ...diagnostics,
    };
  }

  if (caught instanceof Anthropic.PermissionDeniedError) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: "O provider Anthropic negou permissão para esta chamada.",
      providerName: PROVIDER_NAME,
      ...diagnostics,
    };
  }

  if (caught instanceof Anthropic.BadRequestError || caught instanceof Anthropic.UnprocessableEntityError) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: `O provider Anthropic rejeitou a requisição como inválida (status ${diagnostics.httpStatus ?? "desconhecido"}) — possível incompatibilidade entre o tool schema enviado e o que a API espera. Detalhe real: ${diagnostics.rawErrorMessage}`,
      providerName: PROVIDER_NAME,
      ...diagnostics,
    };
  }

  if (caught instanceof Anthropic.APIError) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: `O provider Anthropic falhou ao processar a solicitação (status ${diagnostics.httpStatus ?? "desconhecido"}). Detalhe real: ${diagnostics.rawErrorMessage}`,
      providerName: PROVIDER_NAME,
      ...diagnostics,
    };
  }

  return {
    code: "PROVIDER_UNAVAILABLE",
    message: `O provider Anthropic falhou ao processar a solicitação antes de uma resposta HTTP classificável. Classe real: ${diagnostics.rawErrorClass}. Detalhe real: ${diagnostics.rawErrorMessage}`,
    providerName: PROVIDER_NAME,
    ...diagnostics,
  };
}
