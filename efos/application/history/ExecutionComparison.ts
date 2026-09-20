/**
 * Direção/estado de mudança de uma métrica entre duas execuções
 * (Mission 085 — Historical Financial Intelligence; granularidade
 * ampliada na Mission 086 — Comparative Financial Intelligence).
 * `"added"`/`"removed"` distinguem explicitamente uma métrica que só
 * existe em um dos dois períodos (antes cobertas genericamente por
 * `"not-comparable"`, Mission 085) de `"not-comparable"` — reservado
 * agora para quando a métrica existe nos dois períodos mas com
 * `unit` divergente entre eles (D-046) — nunca comparada numericamente
 * nesse caso, nunca convertida entre unidades. Distinto de
 * indisponibilidade: `unit` divergente é um problema de comparação
 * entre dois valores existentes; indisponibilidade (Mission 098,
 * D-052) é a ausência do próprio valor em uma ou ambas as execuções.
 *
 * `"unavailable"`/`"became-available"`/`"became-unavailable"`
 * (Mission 098, D-052) cobrem os 4 casos de disponibilidade entre duas
 * execuções: `available→available` continua caindo em
 * `"increased"`/`"decreased"`/`"unchanged"` (comparação numérica
 * normal); `unavailable→available` é `"became-available"`;
 * `available→unavailable` é `"became-unavailable"`;
 * `unavailable→unavailable` é `"unavailable"` — nunca uma comparação
 * numérica inventada (nunca `0` como marcador).
 */
export type ChangeDirection =
  | "increased"
  | "decreased"
  | "unchanged"
  | "added"
  | "removed"
  | "not-comparable"
  | "became-available"
  | "became-unavailable"
  | "unavailable";

/**
 * Comparação estrutural de uma única métrica nomeada (`Indicator.name`,
 * já o único identificador legível e estável do contrato oficial —
 * mesma convenção já usada por `RECOGNIZED_INDICATOR_NAMES`, Evidence
 * Engine, Mission 009) entre duas execuções. Nenhum cálculo financeiro
 * novo — `absoluteChange`/`direction` são derivados apenas por
 * subtração e comparação numérica dos valores já calculados pelo
 * Indicators Engine. `unit`/`category` são preservados quando
 * disponíveis (do lado atual, com fallback para o anterior quando a
 * métrica foi removida) — apenas para contexto, nunca usados para
 * conversão/cálculo.
 */
export interface MetricComparison {
  readonly metricName: string;
  readonly previousValue?: number;
  readonly currentValue?: number;
  readonly absoluteChange?: number;
  readonly direction: ChangeDirection;
  readonly unit?: string;
  readonly category?: string;
}

/**
 * Comparação estrutural entre duas execuções da mesma empresa —
 * `previous`/`current` sempre rastreáveis até a execução de origem
 * (`previousExecutionId`/`currentExecutionId`). Nunca uma nova
 * inteligência financeira — apenas diferença estrutural entre valores
 * já calculados por execuções passadas do EFOS.
 */
export interface ExecutionComparison {
  readonly companyId: string;
  readonly previousExecutionId: string;
  readonly currentExecutionId: string;
  readonly metrics: readonly MetricComparison[];
}

/**
 * Aliases solicitados pela Mission 086 (Comparative Financial
 * Intelligence) — mesma estrutura de `ExecutionComparison`/
 * `MetricComparison` (D-045/Mission 085), nomeados de acordo com o
 * vocabulário "Comparative Financial Intelligence" desta missão.
 * Nenhuma estrutura nova, nenhuma duplicação — apenas um nome
 * alternativo para o mesmo tipo, coerente com a arquitetura existente.
 */
export type FinancialComparison = ExecutionComparison;
export type FinancialMetricChange = MetricComparison;
