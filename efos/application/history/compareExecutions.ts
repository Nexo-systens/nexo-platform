import type { Indicator, IndicatorResult } from "@/efos/domain";

import type { HistoricalExecution } from "./HistoricalExecution";
import type {
  ChangeDirection,
  ExecutionComparison,
  MetricComparison,
} from "./ExecutionComparison";

/**
 * Normaliza um `Indicator` lido de volta de uma execução persistida
 * (Mission 098, D-052) — execuções gravadas antes desta missão nunca
 * tiveram `result`, apenas `value: number` (formato legado). Compatibilidade
 * histórica: um `value` legado é sempre lido como `available` com o
 * valor original, nunca reclassificado como `unavailable` — o dado
 * persistido em si nunca é alterado, apenas a leitura em memória desta
 * cópia. `report` persistido não passa por nenhuma validação de schema
 * neste código (nenhum consumidor existente valida a forma do JSONB ao
 * ler de volta), então a checagem de forma aqui é apenas defensiva.
 */
function normalizeIndicator(indicator: Indicator): Indicator {
  const raw = indicator as unknown as { result?: unknown; value?: number };

  if (
    raw.result &&
    typeof raw.result === "object" &&
    "status" in (raw.result as object)
  ) {
    return indicator;
  }

  const legacyResult: IndicatorResult =
    typeof raw.value === "number"
      ? { status: "available", value: raw.value }
      : { status: "unavailable" };

  return { ...indicator, result: legacyResult };
}

/**
 * Extrai os indicadores calculados (`Indicator.name` → `Indicator`) de
 * um `HistoricalExecution`, a partir da seção `"indicators"` do
 * `ExecutiveReport` — a lista completa e não filtrada já produzida
 * pelo Indicators Engine (Mission 062/065), a única fonte de métricas
 * nomeadas e comparáveis já oficial do contrato existente. As seções
 * `"kpi"`/`"financialHealth"`/`"financialRisk"` (Mission 062) não
 * precisam ser lidas separadamente — cada uma reorganiza o mesmo
 * `IndicatorsAggregate.indicators` (confirmado por leitura de
 * `KPIBuilder`/`FinancialHealthBuilder`/`FinancialRiskBuilder`,
 * Mission 086, Auditoria), então a seção `"indicators"` já é o
 * conjunto completo. Nenhum cálculo novo — apenas leitura.
 * `report`/seção ausentes devolvem um mapa vazio, nunca um valor
 * inventado. Cada `Indicator` passa por `normalizeIndicator()` — o
 * único ponto onde uma execução persistida antiga (formato legado,
 * sem `result`) é lida como um `Indicator` do contrato atual.
 */
function extractIndicatorsByName(
  execution: HistoricalExecution
): ReadonlyMap<string, Indicator> {
  const indicatorsSection = execution.report?.sections.find(
    (section) => section.type === "indicators"
  );

  if (!indicatorsSection || indicatorsSection.type !== "indicators") {
    return new Map();
  }

  return new Map(
    indicatorsSection.indicators.indicators.map((indicator) => {
      const normalized = normalizeIndicator(indicator);
      return [normalized.name, normalized];
    })
  );
}

function resultValue(indicator: Indicator): number | undefined {
  return indicator.result.status === "available"
    ? indicator.result.value
    : undefined;
}

/**
 * `previous`/`current` — o mesmo `Indicator` (ou `undefined`, quando a
 * métrica não existe naquele período) já resolvido por nome.
 *
 * Regras (Mission 086, D-046 — política de unidades incompatíveis; e
 * Mission 098, D-052 — disponibilidade):
 * - ausente em `previous`, presente em `current` → `"added"`;
 * - presente em `previous`, ausente em `current` → `"removed"`;
 * - presente nos dois, `unit` diverge → `"not-comparable"` (nunca
 *   convertido/comparado entre unidades diferentes — fenômeno distinto
 *   de indisponibilidade);
 * - presente nos dois, mesma `unit`, os 4 casos de disponibilidade:
 *   `available→available` → comparação numérica simples
 *   (`"increased"`/`"decreased"`/`"unchanged"`);
 *   `unavailable→available` → `"became-available"`;
 *   `available→unavailable` → `"became-unavailable"`;
 *   `unavailable→unavailable` → `"unavailable"` (nenhuma comparação
 *   numérica — nunca `0` inventado).
 */
function compareIndicator(
  metricName: string,
  previous: Indicator | undefined,
  current: Indicator | undefined
): MetricComparison {
  if (previous === undefined && current === undefined) {
    // Nunca acontece na prática (metricName só existe se um dos dois
    // mapas o contém) — cobertura defensiva, sem alterar o contrato.
    return { metricName, direction: "not-comparable" };
  }

  if (previous === undefined) {
    return {
      metricName,
      currentValue: resultValue(current!),
      direction: "added",
      unit: current!.unit,
      category: current!.category,
    };
  }

  if (current === undefined) {
    return {
      metricName,
      previousValue: resultValue(previous),
      direction: "removed",
      unit: previous.unit,
      category: previous.category,
    };
  }

  if (previous.unit !== current.unit) {
    return {
      metricName,
      previousValue: resultValue(previous),
      currentValue: resultValue(current),
      direction: "not-comparable",
      unit: current.unit,
      category: current.category,
    };
  }

  if (
    previous.result.status === "unavailable" &&
    current.result.status === "unavailable"
  ) {
    return {
      metricName,
      direction: "unavailable",
      unit: current.unit,
      category: current.category,
    };
  }

  if (previous.result.status === "unavailable") {
    return {
      metricName,
      currentValue: resultValue(current),
      direction: "became-available",
      unit: current.unit,
      category: current.category,
    };
  }

  if (current.result.status === "unavailable") {
    return {
      metricName,
      previousValue: resultValue(previous),
      direction: "became-unavailable",
      unit: current.unit,
      category: current.category,
    };
  }

  const previousValue = previous.result.value;
  const currentValue = current.result.value;

  const direction: ChangeDirection =
    currentValue > previousValue
      ? "increased"
      : currentValue < previousValue
        ? "decreased"
        : "unchanged";

  return {
    metricName,
    previousValue,
    currentValue,
    absoluteChange: currentValue - previousValue,
    direction,
    unit: current.unit,
    category: current.category,
  };
}

/**
 * Comparação estrutural mínima entre duas execuções da mesma empresa
 * (Mission 085 — Historical Financial Intelligence; formalizada como
 * `FinancialComparison` na Mission 086 — Comparative Financial
 * Intelligence). Função pura — nunca acessa Repository/banco, nunca
 * modifica `previous`/`current` recebidos, mesma entrada sempre produz
 * a mesma saída.
 *
 * Para cada `Indicator.name` presente em pelo menos um dos dois
 * `ExecutiveReport`s (seção `"indicators"`): ver `compareIndicator()`
 * para as regras exatas de `direction`. Nenhum valor ausente é
 * inventado como `0`; nenhuma métrica surge sem rastreabilidade —
 * `previousExecutionId`/`currentExecutionId` sempre presentes no
 * resultado, mesmo quando `metrics: []`.
 *
 * **Demonstrações financeiras (Balanço/DRE/Fluxo de Caixa) não são
 * comparadas por esta função** (Mission 086, Auditoria) —
 * `BalanceSheetBuilder`/`IncomeStatementBuilder`/`CashFlowBuilder`
 * devolvem a mesma coleção de `NormalizedFinancialRecord` apenas
 * reordenada, nunca agregada em totais nomeados; cada registro tem um
 * `recordId` único por execução (nunca estável entre períodos) e um
 * `label` de texto livre (sem vocabulário fixo) — nenhuma chave
 * determinística existe para comparar registro a registro entre
 * execuções sem inventar uma convenção de agregação nova, fora do
 * escopo desta missão (D-046).
 *
 * `previous`/`current` devem já pertencer à mesma empresa — este
 * assert existe para nunca comparar execuções de empresas diferentes
 * silenciosamente; quem chama (`DefaultHistoricalExecutionService`/um
 * futuro consumidor) é responsável por só invocar com duas execuções
 * já filtradas pelo mesmo `companyId` (nunca combinando o resultado de
 * duas chamadas a `findByCompany()` de empresas distintas).
 */
export function compareExecutions(
  previous: HistoricalExecution,
  current: HistoricalExecution
): ExecutionComparison {
  if (previous.companyId !== current.companyId) {
    throw new Error(
      "compareExecutions(): previous.companyId e current.companyId devem ser iguais — nunca comparar execuções de empresas diferentes."
    );
  }

  const previousIndicators = extractIndicatorsByName(previous);
  const currentIndicators = extractIndicatorsByName(current);

  const metricNames = new Set([
    ...previousIndicators.keys(),
    ...currentIndicators.keys(),
  ]);

  const metrics: MetricComparison[] = [...metricNames]
    .sort((a, b) => a.localeCompare(b))
    .map((metricName) =>
      compareIndicator(
        metricName,
        previousIndicators.get(metricName),
        currentIndicators.get(metricName)
      )
    );

  return {
    companyId: current.companyId,
    previousExecutionId: previous.executionId,
    currentExecutionId: current.executionId,
    metrics,
  };
}
