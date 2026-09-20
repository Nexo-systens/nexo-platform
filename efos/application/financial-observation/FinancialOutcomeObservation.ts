import type { Period } from "@/efos/domain";
import type { ChangeDirection } from "@/efos/application/history";

/**
 * `FinancialOutcomeObservation` (Mission 139 — Outcome Measurement &
 * Financial Feedback Correlation). Fecha o elo que a Mission 138
 * deixou explicitamente fora de escopo: "conectar `Outcome`/
 * `expectedResult` a uma futura análise de causalidade `Decision →
 * Financial Truth`". Responde "o que aconteceu com a Financial Truth
 * depois desta decisão?" — nunca "a decisão causou isso".
 *
 * **Princípio central, estrutural (Etapa 3 da missão): Correlation ≠
 * Causation.** `classification` é um tipo fechado com um único valor
 * hoje (`"TEMPORAL_ASSOCIATION"`) — deliberadamente. Não existe (e não
 * pode existir, pela própria forma do tipo) um valor como
 * `"CAUSED_BY_DECISION"`. Isto não é apenas uma convenção de nomes —
 * é uma garantia estrutural: nenhum código pode, mesmo por engano,
 * atribuir causalidade, porque o vocabulário simplesmente não a
 * contém.
 *
 * Vive em `efos/application/financial-observation/`, nunca em
 * `efos/domain/` — mesma decisão de camada já tomada para
 * `DiagnosisReview`/`DecisionExecutionEvent` (D-063/D-070): esta não é
 * uma regra determinística de Engine, é uma composição de leitura
 * sobre dados já existentes (`Decision`, `DecisionExecutionEvent`,
 * `HistoricalExecution`) — nenhum cálculo financeiro novo, apenas
 * reaproveitamento de `compareExecutions()` (`efos/application/history`,
 * D-045/D-046, já fechada e testada desde a Mission 085/086).
 */
export const FINANCIAL_CORRELATION_CLASSIFICATIONS = ["TEMPORAL_ASSOCIATION"] as const;
export type FinancialCorrelationClassification = (typeof FINANCIAL_CORRELATION_CLASSIFICATIONS)[number];

/**
 * Janela de observação explícita e auditável (Etapa 8 da missão —
 * "nunca implicitamente inventada pela IA"). `baselineExecutionId`/
 * `observationExecutionId` sempre rastreáveis até uma `ExecutionSnapshot`
 * real já persistida (`public.executions`) — nunca um período
 * sintético. Seleção determinística (`buildFinancialOutcomeObservation.ts`):
 * `baseline` é a execução mais recente com `executedAt <=
 * decision.createdAt` (a Financial Truth como estava quando a decisão
 * foi tomada); `observation` é a execução mais recente com
 * `executedAt >= executionCompletedAt` (a Financial Truth mais atual
 * disponível, nunca antes da execução da decisão terminar) — esta
 * regra por si só impede que dado futuro vaze para o baseline (Etapa
 * 5.F): o baseline nunca pode ser posterior à decisão, a observação
 * nunca pode ser anterior à conclusão da execução.
 *
 * `decisionCreatedAt`/`executionCompletedAt` são os critérios de
 * SELEÇÃO — sempre presentes quando a janela é construída
 * (`buildFinancialOutcomeObservation()`), mas opcionais no tipo: a
 * persistência (`financial_observations`, D-071) não os armazena como
 * colunas próprias (já existem em `decisions.created_at`/no histórico
 * de `decision_execution_events` — nunca duplicados); uma observação
 * relida do banco devolve esses dois campos como `undefined`, nunca
 * um valor fabricado.
 */
export interface ObservationWindow {
  readonly decisionId: string;
  readonly decisionCreatedAt?: string;
  readonly executionCompletedAt?: string;
  readonly baselineExecutionId: string;
  readonly baselineExecutedAt: string;
  readonly baselinePeriod?: Period;
  readonly observationExecutionId: string;
  readonly observationExecutedAt: string;
  readonly observationPeriod?: Period;
}

/**
 * Uma métrica individual comparável (Etapa 9 da missão). Envolve
 * (nunca duplica) um `MetricComparison` já produzido por
 * `compareExecutions()` — `beforeValue`/`afterValue`/`absoluteChange`/
 * `direction` são os mesmos valores de `MetricComparison.previousValue`/
 * `currentValue`/`absoluteChange`/`direction`, apenas renomeados para o
 * vocabulário desta missão (`before`/`after`, não `previous`/`current`).
 * `percentageChange` é o único cálculo genuinamente novo desta missão
 * — `undefined` quando `beforeValue` é `0` (divisão por zero nunca
 * produz `Infinity`/`NaN`, Etapa 18.F). Apenas métricas com
 * `direction` numericamente comparável (`"increased"`/`"decreased"`/
 * `"unchanged"`) chegam a este tipo — `"added"`/`"removed"`/
 * `"not-comparable"`/`"became-available"`/`"became-unavailable"`/
 * `"unavailable"` são descartadas antes (Etapa 18.G — "indicadores não
 * comparáveis são rejeitados").
 */
export interface FinancialMetricObservation {
  readonly metricName: string;
  readonly beforeValue: number;
  readonly afterValue: number;
  readonly absoluteChange: number;
  readonly percentageChange?: number;
  readonly direction: Extract<ChangeDirection, "increased" | "decreased" | "unchanged">;
}

/**
 * Resultado completo de uma observação financeira (Etapa 7 da missão).
 * `humanOutcomeId?` referencia o `Outcome` humano associado, quando
 * existir — nunca fundido com esta observação (Etapa 12: Human Outcome
 * e Financial Observation permanecem sempre camadas separadas,
 * podendo concordar ou divergir).
 */
export interface FinancialOutcomeObservation {
  readonly id: string;
  readonly decisionId: string;
  readonly companyId: string;
  readonly humanOutcomeId?: string;
  readonly computedBy: string;
  readonly computedAt: string;
  readonly classification: FinancialCorrelationClassification;
  readonly window: ObservationWindow;
  readonly metrics: readonly FinancialMetricObservation[];
}
