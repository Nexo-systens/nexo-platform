import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";

import { assessExecutiveFigureFidelity } from "./assessExecutiveFigureFidelity";
import { assessExecutiveOutputLanguage, type ExecutiveOutputText } from "./assessExecutiveOutputLanguage";

export interface ExecutiveOutputGovernanceResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Mission 206 — porta única da governança de saída (D-132), chamada pelas
 * composições de cada capability (`executeExecutiveAnalysis()`,
 * `executeExecutiveChatAnalysis()`) DEPOIS da validação de schema e de
 * referências e ANTES de qualquer persistência ou exibição. Função pura:
 * não altera o texto do modelo, só aceita ou rejeita a resposta inteira.
 *
 * `extraAllowedSources`: material que a resposta pode legitimamente
 * repetir além do contexto financeiro (no Chat, a pergunta e o histórico
 * da conversa — repetir o número que o executivo digitou não é inventar).
 */
export function validateExecutiveOutputGovernance(
  texts: readonly ExecutiveOutputText[],
  context: ExecutiveFinancialContext,
  extraAllowedSources: readonly unknown[] = []
): ExecutiveOutputGovernanceResult {
  const nonEmpty = texts.filter((entry) => entry.text.trim().length > 0);
  const language = assessExecutiveOutputLanguage(nonEmpty);
  const figures = assessExecutiveFigureFidelity(nonEmpty, context, extraAllowedSources);
  const errors = [...language.errors, ...figures.errors];
  return { valid: errors.length === 0, errors };
}

/** Contagem, por categoria, das violações de uma rejeição — nunca o texto ou o número citado. */
export interface ExecutiveOutputViolationCounts {
  readonly language: number;
  readonly figures: number;
  readonly unavailable: number;
  readonly sign: number;
}

/**
 * Mission 206 — insumo de observabilidade segura: a partir da mensagem de
 * uma rejeição da governança (montada por este módulo), conta as
 * violações por categoria. Serve para medir em produção a taxa de
 * rejeição sem registrar nenhum conteúdo financeiro do cliente.
 */
export function countExecutiveOutputViolations(message: string): ExecutiveOutputViolationCounts {
  const count = (pattern: RegExp) => message.match(pattern)?.length ?? 0;
  return {
    language: count(/não está em português do Brasil/g),
    figures: count(/que não existe no contexto financeiro/g),
    unavailable: count(/que está indisponível no contexto/g),
    sign: count(/com o sinal trocado/g),
  };
}
