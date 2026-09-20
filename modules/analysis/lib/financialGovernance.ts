import type { Indicator } from "@/efos/domain";
import type { DocumentGovernanceOutcome, DocumentGovernanceResult } from "@/app/api/efos/_shared/documentGovernance";

/**
 * Mission 193 — Production Intake Governance & Permanent Regression
 * Gate, Seção 26. Deriva um resumo de completude financeira
 * EXCLUSIVAMENTE de `Indicator.result.status` já publicado por
 * `financialTruth.indicators` (Mission 114) — nunca uma segunda regra
 * de disponibilidade divergente da já aplicada por `calculateIndicators()`
 * (`incomeStatementDependent()`/`balanceDependent()`/
 * `crossSourceDependent()`, Mission 192 Closure B, D-113). Nunca
 * calcula um "score de qualidade" fabricado (Seção 26: "Do not
 * calculate a fake overall data quality score") — apenas três fatos
 * booleanos, cada um diretamente rastreável a um `Indicator` real.
 *
 * `crossSourceCompatible` é deduzido do próprio ROA: por construção
 * (`mixedDependent()`), ROA só fica indisponível por três motivos —
 * ausência de dado de DRE, ausência de dado de Balanço, ou
 * incompatibilidade temporal entre os dois. As duas primeiras causas já
 * são cobertas por `incomeStatementAvailable`/`balanceSheetAvailable`
 * acima; se AMBAS já são verdadeiras e ROA ainda assim está
 * indisponível, a única causa restante é a incompatibilidade temporal —
 * nunca uma suposição, uma DEDUÇÃO da própria árvore de gates já
 * pública.
 */
export interface FinancialCompletenessSummary {
  readonly incomeStatementAvailable: boolean;
  readonly balanceSheetAvailable: boolean;
  readonly crossSourceCompatible: boolean;
}

function isAvailable(indicators: readonly Indicator[], name: string): boolean {
  return indicators.find((indicator) => indicator.name === name)?.result.status === "available";
}

export function deriveFinancialCompletenessSummary(
  indicators: readonly Indicator[]
): FinancialCompletenessSummary {
  const incomeStatementAvailable = isAvailable(indicators, "Margem Bruta");
  const balanceSheetAvailable = isAvailable(indicators, "Liquidez Corrente");
  const crossSourceCompatible =
    !incomeStatementAvailable || !balanceSheetAvailable || isAvailable(indicators, "ROA");

  return { incomeStatementAvailable, balanceSheetAvailable, crossSourceCompatible };
}

/**
 * Contagem por desfecho (Seção 17 — "5 documentos analisados / 3
 * considerados / 1 duplicado / 1 requer correção") — puramente
 * derivada do vocabulário server-autoritativo já calculado
 * (`buildDocumentGovernanceResults()`), nunca uma segunda
 * classificação. Vazio (`{}`) quando `results` está vazio — nunca
 * "0 documentos" fabricado quando a análise nem chegou a rodar.
 */
export function summarizeDocumentGovernance(
  results: readonly DocumentGovernanceResult[]
): Partial<Record<DocumentGovernanceOutcome, number>> {
  const summary: Partial<Record<DocumentGovernanceOutcome, number>> = {};
  for (const result of results) {
    summary[result.outcome] = (summary[result.outcome] ?? 0) + 1;
  }
  return summary;
}
