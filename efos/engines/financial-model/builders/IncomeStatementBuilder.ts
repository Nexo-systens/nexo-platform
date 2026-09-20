import type { NormalizedFinancialRecord } from "@/efos/engines/data";

/**
 * Contrato do Builder oficial responsável por organizar os registros
 * utilizados na Demonstração do Resultado — DRE (Mission 055 — Income
 * Statement Builder). Primeira implementação concreta:
 * `DefaultIncomeStatementBuilder` (`DefaultIncomeStatementBuilder.ts`).
 *
 * `build()` recebe a mesma coleção de `NormalizedFinancialRecord` que
 * `FinancialModelEngine.execute()` aceita — o contrato oficial e
 * imutável de entrada do Engine (D-002) — e devolve essa mesma coleção,
 * apenas reorganizada em seis grupos: Receitas, Custos, Despesas,
 * Financeiro, Tributos e Residual. Nenhum tipo novo.
 *
 * **Nenhum cálculo financeiro. Nenhuma inferência. Nenhuma IA.** Apenas
 * organização dos registros existentes, usando exclusivamente `kind` e
 * `eventType` (campos já existentes) e convenções já estabelecidas
 * (D-004, `docs/DECISIONS.md`; `OPERATING_CASH_INFLOW_EVENT_TYPES` do
 * Evidence Engine) — nenhuma heurística nova. Nenhum registro é criado,
 * removido ou alterado; `amount` nunca é recalculado; lucro/EBITDA/
 * margem nunca são inferidos; nenhuma data ou `currency` é alterada.
 * Cada `NormalizedFinancialRecord` devolvido é exatamente o mesmo
 * objeto recebido (mesma referência) — a única mudança observável
 * possível é a posição de um registro dentro do array.
 *
 * Ver `README.md` deste diretório para o racional completo de por que
 * Financeiro e Tributos nunca recebem nenhum registro classificado
 * (nenhuma convenção já estabelecida cobre esses grupos sem inventar
 * uma classificação nova) e por que eventos/recursos não cobertos por
 * essas convenções são preservados no grupo Residual, ao final.
 */
export interface IncomeStatementBuilder {
  build(
    records: readonly NormalizedFinancialRecord[]
  ): readonly NormalizedFinancialRecord[];
}
