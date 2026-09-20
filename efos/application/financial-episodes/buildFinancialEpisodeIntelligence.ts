import { TEMPORAL_METRIC_DEFINITIONS } from "@/efos/engines/evidence";

import type { HistoricalExecution } from "../history";
import { deriveFinancialEpisodeState } from "./deriveFinancialEpisodeState";
import type { FinancialEpisodeStateResult } from "./FinancialEpisodeState";

/**
 * Mission 172 — Integrate Financial Episode Intelligence into
 * ExecutiveFinancialContext.
 *
 * Composição pura sobre `deriveFinancialEpisodeState()` (Mission 171,
 * corrigida pela Mission 171 Fix) — deriva o estado de episódio para
 * TODAS as métricas suportadas por D-087, na mesma ordem declarada em
 * `TEMPORAL_METRIC_DEFINITIONS` (ordem estável e determinística,
 * nunca dependente de iteração de objeto — Requisito 5 da missão).
 * Nunca itera indicadores arbitrários: apenas as 8 chaves já
 * aprovadas (`gross-margin`/`operating-margin`/`net-margin`/
 * `current-liquidity`/`quick-liquidity`/`immediate-liquidity`/
 * `average-receipt-period`/`operating-cash-flow`).
 *
 * **Política de janela histórica (Requisito 6 da missão)**: esta
 * função NUNCA busca seu próprio histórico — recebe `executions`
 * exatamente como o chamador fornece, sem impor limite/paginação
 * própria. Auditoria confirmou que `ExecutionRepository.findByCompany()`/
 * `HistoricalExecutionService.getHistory()` não têm nenhum parâmetro
 * de limite hoje, e nenhuma convenção de janela canônica existe em
 * lugar algum do repositório — inventar um número aqui seria
 * exatamente o tipo de limiar arbitrário que a disciplina do projeto
 * proíbe (mesmo princípio já usado para rejeitar "Rule B",
 * Mission 166A). A janela é, portanto, sempre "o histórico que o
 * chamador já decidiu fornecer" — a mesma política já aplicada a
 * `comparison?: ExecutionComparison` em `buildExecutiveFinancialContext()`
 * (Mission 114): quem decide o que comparar/derivar é sempre a camada
 * de composição que MONTA a chamada, nunca esta função (D-002
 * estendido: uma função de composição também não busca sua própria
 * dependência). Um futuro orquestrador de produção (ainda inexistente
 * — nenhuma composição real chama `buildExecutiveFinancialContext()`
 * hoje, confirmado por auditoria) é responsável por decidir quanto
 * histórico buscar antes de chamar esta função.
 *
 * Falhas fechadas de `deriveFinancialEpisodeState()` (Mission 171
 * Fix) — conflito de mesmo período, execução não-posicionável,
 * histórico insuficiente — se propagam normalmente por métrica; uma
 * métrica `NOT_DETERMINABLE` nunca impede as demais 7 de serem
 * derivadas independentemente (cada chamada a
 * `deriveFinancialEpisodeState()` é isolada por `metricKey`).
 */
export function buildFinancialEpisodeIntelligence(
  companyId: string,
  financialModelId: string,
  executions: readonly HistoricalExecution[]
): readonly FinancialEpisodeStateResult[] {
  return TEMPORAL_METRIC_DEFINITIONS.map((definition) =>
    deriveFinancialEpisodeState(companyId, financialModelId, definition.metricKey, executions)
  );
}
