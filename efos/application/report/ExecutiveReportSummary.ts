/**
 * Visão geral estrutural de um Executive Report (Mission 022 —
 * Executive Report Service). Cada campo é a contagem de itens já
 * presentes no Aggregate correspondente de `PipelineExecution`
 * (`.length` de uma coleção já produzida) — nunca um valor financeiro
 * novo, nunca uma inferência sobre o conteúdo. Um estágio não
 * alcançado pela execução (Aggregate ausente em `PipelineExecution`)
 * contribui `0`, nunca `undefined` — o Summary sempre existe, mesmo
 * para uma execução interrompida antes do primeiro estágio com
 * Aggregate de coleção (Indicators).
 */
export interface ExecutiveReportSummary {
  readonly indicatorsCount: number;
  readonly evidenceCount: number;
  readonly contextCount: number;
  readonly reasoningCount: number;
  readonly recommendationCount: number;
  readonly decisionCount: number;
}
