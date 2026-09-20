import type {
  ContextAggregate,
  DecisionAggregate,
  EvidenceAggregate,
  Indicator,
  IndicatorsAggregate,
  ReasoningAggregate,
  RecommendationAggregate,
} from "@/efos/domain";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";

/**
 * Uma seção do Executive Report — um estágio lógico da análise
 * (Mission 022 — Executive Report Service). Cada seção carrega
 * apenas o Aggregate (ou, para as seções organizadas, a lista de
 * `Indicator`/`NormalizedFinancialRecord` já reorganizada por um
 * Builder) já produzido pelo estágio correspondente de
 * `PipelineExecution`, por referência (nunca copiado, nunca
 * recalculado, D-017/D-019) — nenhuma formatação visual, nenhum
 * HTML, nenhum Markdown. `type` identifica o estágio; `title` é um
 * rótulo executivo fixo, não derivado de nenhum dado da execução.
 *
 * Union discriminada por `type` — os 6 estágios "legíveis por um
 * executivo" da cadeia principal (Indicators, Evidence, Context,
 * Reasoning, Recommendation, Decision); Data, Financial Model,
 * Financial Knowledge Graph e Learning são estágios internos/técnicos
 * ou de meta-conhecimento, deliberadamente fora do Executive Report
 * (mesmo conjunto de 6 exemplos dado pela missão original, Mission
 * 022) — mais três variantes aditivas introduzidas na Mission 062
 * (Report Layer Builder Integration, D-035/D-036): `"kpi"`,
 * `"financialHealth"`, `"financialRisk"` — cada uma carregando
 * `execution.indicators.indicators` já reorganizado por
 * `KPIBuilder`/`FinancialHealthBuilder`/`FinancialRiskBuilder`
 * (`efos/engines/financial-model/builders/`, Missions 057–059) —
 * mais três variantes aditivas introduzidas na Mission 064
 * (Financial Statement Builders Integration, D-037): `"balanceSheet"`,
 * `"incomeStatement"`, `"cashFlow"` — cada uma carregando
 * `execution.data` (`readonly NormalizedFinancialRecord[]`, produzido
 * pelo Data Engine e preservado em `PipelineExecution.data`, Mission
 * 020B) já reorganizado por `BalanceSheetBuilder`/
 * `IncomeStatementBuilder`/`CashFlowBuilder` — cada Builder aplicado
 * independentemente, nunca encadeados (a ordenação de uma demonstração
 * nunca contamina outra). Desde a Mission 194 (Production Executive
 * Report Truth & Presentation Audit, D-118), cada Builder recebe um
 * SUBCONJUNTO de `execution.data` pré-filtrado por `kind` (nunca mais a
 * coleção inteira idêntica para os três) — `balanceSheet` só contém
 * `kind === "resource"`; `incomeStatement` contém `kind !== "resource"`
 * (StatementLine + Event, D-106); `cashFlow` só contém `kind === "event"`
 * — ver `DefaultReportService.buildFinancialSections()` para o
 * racional completo. O único Builder financeiro ainda sem seção
 * correspondente é `FinancialStatementBuilder` — exige
 * `CandidateFinancialRecord[]` (Data Engine, forma pré-normalização),
 * que nunca é preservado em lugar algum (D-033).
 */
export type ExecutiveReportSection =
  | {
      readonly type: "indicators";
      readonly title: string;
      readonly indicators: IndicatorsAggregate;
    }
  | {
      readonly type: "evidence";
      readonly title: string;
      readonly evidence: EvidenceAggregate;
    }
  | {
      readonly type: "context";
      readonly title: string;
      readonly context: ContextAggregate;
    }
  | {
      readonly type: "reasoning";
      readonly title: string;
      readonly reasoning: ReasoningAggregate;
    }
  | {
      readonly type: "recommendation";
      readonly title: string;
      readonly recommendation: RecommendationAggregate;
    }
  | {
      readonly type: "decision";
      readonly title: string;
      readonly decision: DecisionAggregate;
    }
  | {
      readonly type: "kpi";
      readonly title: string;
      readonly kpi: readonly Indicator[];
    }
  | {
      readonly type: "financialHealth";
      readonly title: string;
      readonly financialHealth: readonly Indicator[];
    }
  | {
      readonly type: "financialRisk";
      readonly title: string;
      readonly financialRisk: readonly Indicator[];
    }
  | {
      readonly type: "balanceSheet";
      readonly title: string;
      readonly balanceSheet: readonly NormalizedFinancialRecord[];
    }
  | {
      readonly type: "incomeStatement";
      readonly title: string;
      readonly incomeStatement: readonly NormalizedFinancialRecord[];
    }
  | {
      readonly type: "cashFlow";
      readonly title: string;
      readonly cashFlow: readonly NormalizedFinancialRecord[];
    };

export type ExecutiveReportSectionType = ExecutiveReportSection["type"];
