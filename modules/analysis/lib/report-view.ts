import type {
  ExecutiveReport,
  ExecutiveReportSection,
  ExecutiveReportSectionType,
} from "@/efos/application/report";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";

/**
 * As seis seções financeiras (Mission 065) — usadas apenas para
 * classificação visual (tabela de registros/indicadores vs. lista de
 * insight). Nunca reordena `report.sections`: a ordem executiva já
 * chega pronta de `DefaultReportService.buildSections()`.
 */
const FINANCIAL_SECTION_TYPES: readonly ExecutiveReportSectionType[] = [
  "financialHealth",
  "financialRisk",
  "kpi",
  "balanceSheet",
  "incomeStatement",
  "cashFlow",
];

const INDICATOR_SECTION_TYPES: readonly ExecutiveReportSectionType[] = [
  "financialHealth",
  "financialRisk",
  "kpi",
  "indicators",
];

const RECORD_SECTION_TYPES: readonly ExecutiveReportSectionType[] = [
  "balanceSheet",
  "incomeStatement",
  "cashFlow",
];

export function isFinancialSection(section: ExecutiveReportSection): boolean {
  return (FINANCIAL_SECTION_TYPES as readonly string[]).includes(
    section.type
  );
}

export function isIndicatorSection(section: ExecutiveReportSection): boolean {
  return (INDICATOR_SECTION_TYPES as readonly string[]).includes(
    section.type
  );
}

export function isRecordSection(section: ExecutiveReportSection): boolean {
  return (RECORD_SECTION_TYPES as readonly string[]).includes(section.type);
}

/**
 * `true` quando a execução não produziu nenhuma seção — estado
 * explícito ("vazio"), nunca preenchido com conteúdo fictício.
 */
export function hasNoSections(
  report: Pick<ExecutiveReport, "sections">
): boolean {
  return report.sections.length === 0;
}

/**
 * Ordem exata dos `type` das seções, na ordem em que já chegam em
 * `report.sections` — nunca ordenada/filtrada aqui. Usada apenas para
 * teste/verificação de que a ordem executiva (Mission 065) não foi
 * alterada por esta camada de apresentação.
 */
export function getSectionTypeOrder(
  report: Pick<ExecutiveReport, "sections">
): readonly ExecutiveReportSectionType[] {
  return report.sections.map((section) => section.type);
}

/**
 * `period.startDate`/`period.endDate` (`Period`) e `asOfDate`
 * (`Resource`, D-111) são sempre produzidos via `Date.prototype.toISOString()`
 * em algum ponto do pipeline (`extractBalanceAsOfDate()`, extração de
 * período de DRE) — `"AAAA-MM-DDTHH:mm:ss.sssZ"`, nunca apenas
 * `"AAAA-MM-DD"`. Cortar para os 10 primeiros caracteres ANTES de
 * dividir por `-` evita quebrar (`"01T00:00:00.000Z"` como "dia") caso
 * uma chamada futura passe a data já sem a parte de hora — funciona
 * corretamente para as duas formas.
 */
function formatBrDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Mission 194 — Production Executive Report Truth & Presentation
 * Audit, Seção 33. `ExecutiveReportView.tsx` mostrava apenas "Análise
 * executada em {generatedAt}" (o RELÓGIO DE EXECUÇÃO do relatório,
 * `DefaultReportService.buildMetadata()`) — nunca o PERÍODO FINANCEIRO
 * real que a DRE cobre (`StatementLine.period`, D-106) ou a data-base
 * real do Balanço (`Resource.asOfDate`, D-111). Um executivo não tinha
 * como saber, sem inspecionar cada linha da tabela, se estava vendo
 * Julho ou Agosto — a mesma ambiguidade que a missão explicitamente
 * proíbe ("Do not use upload date as financial period").
 *
 * Pura leitura do primeiro valor não-`undefined` já presente nos
 * registros da própria seção (nenhum cálculo novo, nenhuma inferência):
 * `period` (StatementLine, DRE) tem prioridade sobre `asOfDate`
 * (Resource, Balanço) apenas porque esta função é compartilhada pelas
 * duas seções — cada chamada já recebe unicamente os registros de UMA
 * demonstração (Mission 194, D-118: `balanceSheet`/`incomeStatement`
 * não se misturam mais), então nunca há ambiguidade real de qual campo
 * é o certo para aquela seção. D-111/D-113 já garantem que todo
 * registro de uma mesma execução compartilha o mesmo período/data-base
 * (documentos com período/data conflitantes são excluídos antes de
 * chegar aqui) — por isso o PRIMEIRO valor encontrado já representa a
 * seção inteira, nunca uma amostra arbitrária.
 */
export function derivePeriodLabel(
  records: readonly NormalizedFinancialRecord[]
): string | undefined {
  for (const record of records) {
    if (record.period) {
      return `${formatBrDate(record.period.startDate)} a ${formatBrDate(record.period.endDate)}`;
    }
  }
  for (const record of records) {
    if (record.asOfDate) {
      return `Data-base: ${formatBrDate(record.asOfDate)}`;
    }
  }
  return undefined;
}
