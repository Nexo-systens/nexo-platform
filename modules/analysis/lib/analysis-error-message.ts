/**
 * Mission 203 — mensagem executiva para uma análise que não pôde ser
 * executada. As validações internas dos Engines do EFOS devolvem textos
 * técnicos ("Entrada invalida para o Financial Model Engine.
 * records[5]: occurredAt e obrigatorio quando kind=\"event\"") — úteis
 * para o suporte, mas vocabulário interno para o executivo. Esta
 * função só decide O QUE MOSTRAR: a mensagem técnica continua
 * disponível como detalhe recolhido, nunca é descartada nem alterada.
 */

export interface AnalysisErrorPresentation {
  readonly message: string;
  /** Texto original, exibido recolhido ("detalhe técnico") quando difere da mensagem. */
  readonly technicalDetail?: string;
}

const ENGINE_VALIDATION = /^Entrada invalida para o .+ Engine\./i;

export const ANALYSIS_DOCUMENT_INPUT_MESSAGE =
  "Um dos documentos enviados tem uma linha que a análise não conseguiu interpretar (por exemplo, um lançamento sem data). Revise os documentos — DRE, Balanço/Balancete ou extrato com transações datadas — e execute a análise novamente.";

export const ANALYSIS_UNEXPECTED_MESSAGE =
  "Não foi possível concluir a análise agora. Tente novamente em instantes; se persistir, fale com o suporte da NEXO.";

export function presentAnalysisError(rawMessage: string | undefined): AnalysisErrorPresentation {
  const message = rawMessage?.trim() ?? "";
  if (message.length === 0) return { message: ANALYSIS_UNEXPECTED_MESSAGE };
  if (ENGINE_VALIDATION.test(message)) {
    return { message: ANALYSIS_DOCUMENT_INPUT_MESSAGE, technicalDetail: message };
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return {
      message: "Sem conexão com o servidor da NEXO. Verifique a conexão e tente novamente.",
      technicalDetail: message,
    };
  }
  return { message };
}

// Cobre "ANTHROPIC_API_KEY não configurada — o provider Anthropic…" e
// 'Provider "anthropic" falhou ao processar a solicitação.'
const AI_PROVIDER = /provider\s+"?anthropic"?|anthropic_api_key|chave de api/i;

export const EXECUTIVE_AI_UNAVAILABLE_MESSAGE =
  "A Executive AI está indisponível no momento. A análise financeira continua disponível; tente gerar o diagnóstico novamente mais tarde.";

/**
 * Falha do provedor de IA ao gerar o diagnóstico (Mission 198:
 * PROVIDER_UNAVAILABLE e afins). O executivo não precisa saber o nome do
 * provedor nem da variável de ambiente — só que a IA está indisponível
 * e que a análise feita continua valendo.
 */
export function presentExecutiveAiError(rawMessage: string | undefined): AnalysisErrorPresentation {
  const message = rawMessage?.trim() ?? "";
  if (message.length === 0 || AI_PROVIDER.test(message)) {
    return { message: EXECUTIVE_AI_UNAVAILABLE_MESSAGE, technicalDetail: message || undefined };
  }
  return { message };
}

export const EXECUTIVE_AI_UNEXPECTED_MESSAGE =
  "A Executive AI não produziu um diagnóstico válido desta vez — nada foi salvo. Tente gerar novamente; se persistir, fale com o suporte da NEXO.";

/**
 * Mission 206 — falha no estágio do provedor do diagnóstico
 * (`stage: "provider"`): indisponibilidade, forma inválida ou resposta
 * rejeitada pela validação/política de saída (idioma, números). O texto
 * é sempre interno e vira detalhe recolhido; a mensagem é executiva.
 * Sessão/acesso/verdade financeira não passam por aqui.
 */
export function presentExecutiveDiagnosisProviderError(rawMessage: string | undefined): AnalysisErrorPresentation {
  const message = rawMessage?.trim() ?? "";
  if (message.length === 0 || AI_PROVIDER.test(message)) {
    return { message: EXECUTIVE_AI_UNAVAILABLE_MESSAGE, technicalDetail: message || undefined };
  }
  return { message: EXECUTIVE_AI_UNEXPECTED_MESSAGE, technicalDetail: message };
}

export const EXECUTIVE_CHAT_UNAVAILABLE_MESSAGE =
  "O Executive Chat está indisponível no momento. A análise e o diagnóstico da empresa continuam disponíveis; tente perguntar novamente mais tarde.";

export const EXECUTIVE_CHAT_UNEXPECTED_MESSAGE =
  "O Executive Chat não conseguiu produzir uma resposta fundamentada para esta pergunta. Tente reformular a pergunta ou tente novamente.";

/**
 * Falha no estágio do provedor do Executive Chat (`stage: "provider"`).
 * Os demais estágios (sessão, acesso, pergunta, contexto financeiro) já
 * devolvem mensagens executivas e não passam por aqui. Neste estágio o
 * texto é sempre interno (chave do provedor, forma da resposta do
 * modelo, validação de referências) — vira detalhe recolhido.
 */
export function presentExecutiveChatProviderError(rawMessage: string | undefined): AnalysisErrorPresentation {
  const message = rawMessage?.trim() ?? "";
  if (message.length === 0 || AI_PROVIDER.test(message)) {
    return { message: EXECUTIVE_CHAT_UNAVAILABLE_MESSAGE, technicalDetail: message || undefined };
  }
  return { message: EXECUTIVE_CHAT_UNEXPECTED_MESSAGE, technicalDetail: message };
}
