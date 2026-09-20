import type { Indicator } from "@/efos/domain";

/**
 * Contrato do Builder oficial responsável por organizar os indicadores
 * financeiros relacionados à análise de risco (Mission 059 — Financial
 * Risk Builder). Primeira implementação concreta:
 * `DefaultFinancialRiskBuilder` (`DefaultFinancialRiskBuilder.ts`).
 *
 * `build()` recebe uma coleção de `Indicator` — a entidade oficial já
 * existente no domínio (`efos/domain/entities/Indicator.ts`), o mesmo
 * tipo já usado por `KPIBuilder` (Mission 057) e `FinancialHealthBuilder`
 * (Mission 058) — e devolve essa mesma coleção, apenas reorganizada.
 * Nenhum tipo novo, nenhum DTO paralelo: nenhum `FinancialRiskIndicator`,
 * `RiskDTO`, `RiskScore` ou enum novo foi criado.
 *
 * **Nenhum cálculo novo. Nenhuma inferência. Nenhuma classificação de
 * risco nova. Nenhuma IA.** Apenas organização determinística, usando
 * exclusivamente `category`/`name` (campos já existentes). Nenhum
 * indicador é criado, removido ou alterado; nenhum `value`, `unit`,
 * `category` ou `name` é alterado. Cada `Indicator` devolvido é
 * exatamente o mesmo objeto recebido (mesma referência) — a única
 * mudança observável possível é a posição de um indicador dentro do
 * array. Este Builder organiza. Ele não interpreta.
 */
export interface FinancialRiskBuilder {
  build(indicators: readonly Indicator[]): readonly Indicator[];
}
