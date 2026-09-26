/**
 * Mission 200 — Non-Enumerating Public Auth Responses (D-127).
 *
 * Signup e "esqueci minha senha" são públicos: qualquer pessoa pode
 * submeter qualquer e-mail. A resposta observável (mensagem, status da
 * action, estado visual) nunca pode depender de o e-mail já ter conta.
 *
 * Regra de classificação de um erro do Supabase Auth:
 * - depende SÓ do que o próprio usuário enviou (senha, formato do
 *   e-mail) ou de algo global/por IP (cadastro desativado, limite de
 *   requisições por IP, serviço inalcançável) → mensagem acionável;
 * - qualquer outro desfecho pode depender da existência da conta —
 *   `user_already_exists`/`email_exists`/`identity_already_exists`, mas
 *   também limite ou falha de ENVIO de e-mail, que só acontece quando um
 *   e-mail é de fato enviado (conta nova no signup, conta existente na
 *   recuperação) → mesma resposta neutra do caminho feliz, e o código do
 *   erro vai para o log do servidor (nunca o e-mail).
 *
 * A resposta neutra nunca afirma que algo foi enviado nem que a conta
 * foi criada: ela diz o que acontece SE o endereço puder ser usado e o
 * que fazer se nada chegar — por isso uma falha de envio suprimida não
 * vira uma falsa confirmação de sucesso.
 */

export const SIGNUP_NEUTRAL_MESSAGE =
  "Se este e-mail puder ser usado para criar uma conta, você receberá um link de confirmação em instantes. Se você já tem uma conta, entre ou recupere sua senha. Não recebeu nada? Verifique o spam ou tente novamente em alguns minutos.";

export const PASSWORD_RESET_NEUTRAL_MESSAGE =
  "Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes. Não recebeu nada? Verifique o spam ou tente novamente em alguns minutos.";

const RATE_LIMITED_MESSAGE = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
const SERVICE_UNREACHABLE_MESSAGE =
  "Não foi possível falar com o serviço de autenticação. Verifique sua conexão e tente novamente em instantes.";
const INVALID_EMAIL_MESSAGE = "Informe um e-mail válido.";

/**
 * Piso de duração das actions públicas de signup/recuperação.
 * O Supabase responde mais rápido quando NÃO envia e-mail (conta já
 * confirmada no signup, conta inexistente na recuperação); o piso
 * absorve essa diferença na faixa comum de latência de envio. Não é uma
 * garantia contra medição estatística de um envio mais lento que o piso
 * — limitação documentada em D-127.
 */
export const PUBLIC_AUTH_MIN_DURATION_MS = 1500;

export type PublicAuthOutcome =
  | { readonly kind: "neutral" }
  | { readonly kind: "actionable"; readonly message: string };

type AuthErrorLike = {
  readonly code?: unknown;
  readonly status?: unknown;
  readonly name?: unknown;
};

function codeOf(error: AuthErrorLike): string | undefined {
  return typeof error.code === "string" ? error.code : undefined;
}

/** Falha de transporte (Supabase inalcançável) — independe do e-mail. */
function isServiceUnreachable(error: AuthErrorLike): boolean {
  return error.name === "AuthRetryableFetchError" || error.status === 0;
}

export function classifySignupError(error: AuthErrorLike | null | undefined): PublicAuthOutcome {
  if (!error) return { kind: "neutral" };

  if (isServiceUnreachable(error)) return { kind: "actionable", message: SERVICE_UNREACHABLE_MESSAGE };

  switch (codeOf(error)) {
    case "weak_password":
      return {
        kind: "actionable",
        message: "A senha não atende aos requisitos de segurança. Escolha uma senha mais forte.",
      };
    case "email_address_invalid":
      return { kind: "actionable", message: INVALID_EMAIL_MESSAGE };
    case "signup_disabled":
      return { kind: "actionable", message: "O cadastro de novas contas está indisponível no momento." };
    case "over_request_rate_limit":
      return { kind: "actionable", message: RATE_LIMITED_MESSAGE };
    default:
      return { kind: "neutral" };
  }
}

export function classifyPasswordResetError(error: AuthErrorLike | null | undefined): PublicAuthOutcome {
  if (!error) return { kind: "neutral" };

  if (isServiceUnreachable(error)) return { kind: "actionable", message: SERVICE_UNREACHABLE_MESSAGE };

  switch (codeOf(error)) {
    case "email_address_invalid":
      return { kind: "actionable", message: INVALID_EMAIL_MESSAGE };
    case "over_request_rate_limit":
      return { kind: "actionable", message: RATE_LIMITED_MESSAGE };
    default:
      return { kind: "neutral" };
  }
}

/**
 * Registra um desfecho suprimido pela resposta neutra, para operação —
 * só o fluxo e metadados do erro, nunca e-mail, senha ou token.
 */
export function logSuppressedAuthOutcome(flow: "signup" | "password_reset", error: AuthErrorLike): void {
  console.warn(
    `[auth:${flow}] desfecho suprimido pela resposta neutra (D-127)`,
    JSON.stringify({
      code: codeOf(error) ?? null,
      status: typeof error.status === "number" ? error.status : null,
      name: typeof error.name === "string" ? error.name : null,
    })
  );
}

export async function withMinimumDuration<T>(
  minimumMs: number,
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await operation();
  } finally {
    const remaining = minimumMs - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }
}

/**
 * Mission 200 — destino pós-confirmação sempre interno. `/auth/confirm`
 * concatenava `origin + next`, e um `next` como `@evil.example` ou
 * `.evil.example` produzia uma URL de outro host (open redirect depois
 * de uma verificação de token bem-sucedida). Só caminhos absolutos do
 * próprio site são aceitos; qualquer outra coisa cai no padrão.
 */
export function safeInternalRedirectPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }

  const base = "http://internal.invalid";
  try {
    const resolved = new URL(next, base);
    if (resolved.origin !== base) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
