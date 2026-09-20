import type { Indicator } from "@/efos/domain";

/**
 * Contrato do Builder oficial responsável por organizar os indicadores
 * financeiros para avaliação da saúde financeira da empresa (Mission
 * 058 — Financial Health Builder). Primeira implementação concreta:
 * `DefaultFinancialHealthBuilder`
 * (`DefaultFinancialHealthBuilder.ts`).
 *
 * `build()` recebe uma coleção de `Indicator` — a entidade oficial já
 * existente no domínio (`efos/domain/entities/Indicator.ts`), o mesmo
 * tipo produzido pelo Indicators Engine (`IndicatorsAggregate.indicators`)
 * — e devolve essa mesma coleção, apenas reorganizada. Nenhum tipo
 * novo, nenhum DTO paralelo: a missão especifica `FinancialIndicator`
 * no CONTRATO, mas nenhum tipo com esse nome existe no domínio do EFOS
 * — mesma resolução já documentada em `KPIBuilder` (Mission 057, ver
 * `README.md` deste diretório): `Indicator` é o único tipo oficial já
 * existente com exatamente os campos descritos (`category`, `name`).
 *
 * **Nenhum cálculo novo. Nenhuma inferência. Nenhuma IA. Nenhuma
 * alteração dos indicadores. Nenhum score/nota/classificação
 * criados.** Apenas organização determinística, usando exclusivamente
 * `category`/`name` (campos já existentes). Nenhum indicador é criado,
 * removido ou recalculado; nenhum valor, `unit` ou fórmula é alterada.
 * Cada `Indicator` devolvido é exatamente o mesmo objeto recebido
 * (mesma referência) — a única mudança observável possível é a
 * posição de um indicador dentro do array.
 */
export interface FinancialHealthBuilder {
  build(indicators: readonly Indicator[]): readonly Indicator[];
}
