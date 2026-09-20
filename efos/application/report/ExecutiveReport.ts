import type { ExecutiveReportMetadata } from "./ExecutiveReportMetadata";
import type { ExecutiveReportSection } from "./ExecutiveReportSection";
import type { ExecutiveReportSummary } from "./ExecutiveReportSummary";

/**
 * Representação estruturada e canônica de um relatório executivo
 * (Mission 022 — Executive Report Service) — a transformação de um
 * `PipelineExecution` (`efos/application/orchestrators/
 * PipelineExecution.ts`) já concluído em uma forma organizada para
 * leitura executiva. Apenas estrutura: nenhuma renderização, nenhum
 * HTML, nenhum Markdown, nenhum PDF — isso pertence a uma camada
 * futura de apresentação, fora do escopo desta missão.
 *
 * `metadata` identifica a execução de origem; `summary` é a visão
 * geral estrutural (contagens, sem cálculo financeiro novo);
 * `sections` são os estágios legíveis por um executivo, cada um
 * carregando o Aggregate já produzido pelo Engine correspondente, por
 * referência.
 */
export interface ExecutiveReport {
  readonly metadata: ExecutiveReportMetadata;
  readonly summary: ExecutiveReportSummary;
  readonly sections: readonly ExecutiveReportSection[];
}
