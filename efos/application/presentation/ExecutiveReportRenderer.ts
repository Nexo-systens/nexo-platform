import type { ExecutiveReport } from "../report";

/**
 * Camada oficial de apresentação do `ExecutiveReport` (Mission 078 —
 * Executive Report Presentation Layer). `render()` transforma um
 * `ExecutiveReport` já produzido (`efos/application/report/`, Mission
 * 022) numa representação textual consumível por um ser humano —
 * nenhum cálculo, nenhuma classificação, nenhuma inferência, nenhuma
 * interpretação nova: apenas os dados já presentes no relatório,
 * reorganizados como texto, na mesma ordem em que já aparecem em
 * `report.sections` (a ordem executiva determinística já decidida
 * pela Mission 065 — este contrato nunca reordena nada).
 *
 * Primeira implementação concreta: `DefaultExecutiveReportRenderer`
 * (`DefaultExecutiveReportRenderer.ts`), produzindo Markdown — o
 * formato de menor esforço/dependência (nenhuma biblioteca nova,
 * nenhum motor de template, texto simples e determinístico, fácil de
 * testar). Uma futura implementação (HTML/PDF) pode implementar este
 * mesmo contrato sem alterar `ExecutiveReport` nem `DefaultReportService`.
 *
 * `render()` é síncrono e puro — mesma entrada sempre produz a mesma
 * saída (determinístico), nunca modifica o `ExecutiveReport` recebido,
 * nunca acessa banco/rede/IA.
 */
export interface ExecutiveReportRenderer {
  render(report: ExecutiveReport): string;
}
