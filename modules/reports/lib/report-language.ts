import type { PeriodVersion, PreviousPeriodComparison } from "@/efos/application/history";
import { comparisonUnavailableText } from "@/modules/analysis/lib/temporal-comparison-language";

import type { ReportReading } from "./report-reading";

/**
 * Mission 208 — frases do relatório executivo, montadas só de contagens e
 * estados já calculados (nenhum juízo novo). Regra da Mission 204: plural
 * real e zero por extenso ("nenhum sinal"), nunca "0 sinal(is)".
 */

export function counted(count: number, singular: string, plural: string, zero: string): string {
  if (count === 0) return zero;
  return `${count} ${count === 1 ? singular : plural}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function describeSignals(reading: Pick<ReportReading, "signalCounts" | "indicatorCounts">): string {
  const { attention, favorable, information } = reading.signalCounts;
  const extra = information > 0 ? `, além de ${counted(information, "informação", "informações", "")}` : "";
  let signals: string;
  if (attention === 0 && favorable === 0) {
    signals = `O EFOS não registrou sinais de atenção nem sinais favoráveis neste período${extra}.`;
  } else {
    // O que existe primeiro; a ausência por extenso no fim ("e nenhum sinal favorável").
    const present = [
      attention > 0 ? counted(attention, "sinal de atenção", "sinais de atenção", "") : undefined,
      favorable > 0 ? counted(favorable, "sinal favorável", "sinais favoráveis", "") : undefined,
    ].filter(Boolean);
    const absent = attention === 0 ? " e nenhum sinal de atenção" : favorable === 0 ? " e nenhum sinal favorável" : "";
    signals = `O EFOS registrou ${present.join(" e ")}${absent} neste período${extra}.`;
  }

  const { total, unavailable } = reading.indicatorCounts;
  const indicators =
    total === 0
      ? "Nenhum indicador foi calculado nesta análise."
      : unavailable === 0
        ? `Os ${total} indicadores foram calculados.`
        : unavailable === 1
          ? `1 de ${total} indicadores não pôde ser calculado por falta de dado no período.`
          : `${unavailable} de ${total} indicadores não puderam ser calculados por falta de dado no período.`;
  return `${signals} ${indicators}`;
}

export function describeComparison(comparison: PreviousPeriodComparison, label?: { readonly long: string }): string {
  if (comparison.outcome === "resolved") return label?.long ?? "Período anterior";
  return comparisonUnavailableText(comparison.outcome) ?? "Comparação indisponível";
}

export function describeVersion(version: PeriodVersion, formatDate: (iso: string) => string): string {
  switch (version.state) {
    case "latest":
      return version.versions <= 1
        ? "Única versão deste período"
        : `Versão mais recente (${version.versions} análises do período)`;
    case "earlier":
      return `Versão anterior — o período foi analisado de novo em ${formatDate(version.latestExecutedAt)}`;
    case "unpositioned":
      return "Sem período determinado";
  }
}
