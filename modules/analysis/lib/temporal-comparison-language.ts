import type { PreviousPeriodState } from "@/efos/application/history";

/**
 * Mission 209 — o que dizer quando não há comparação temporal válida
 * (D-134). Uma linguagem só para Visão geral, Dashboard, histórico da
 * Análise e relatório executivo. Nunca "0%", "0 p.p." nem "sem mudança"
 * quando a comparação não existe.
 */
const UNAVAILABLE: Readonly<Record<Exclude<PreviousPeriodState, "resolved">, { readonly long: string; readonly short: string }>> = {
  "first-period": { long: "Sem período anterior comparável", short: "Sem período anterior" },
  ambiguous: { long: "Comparação indisponível — histórico anterior ambíguo", short: "Histórico ambíguo" },
  unpositioned: { long: "Comparação indisponível — período não determinado", short: "Sem comparação" },
};

/** Frase para a ausência de comparação; `undefined` quando a comparação existe. */
export function comparisonUnavailableText(state: PreviousPeriodState): string | undefined {
  return state === "resolved" ? undefined : UNAVAILABLE[state].long;
}

/** Versão curta (célula de tabela, selo). */
export function comparisonUnavailableShort(state: PreviousPeriodState | undefined): string {
  return state === undefined || state === "resolved" ? "Sem comparação" : UNAVAILABLE[state].short;
}
