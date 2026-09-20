import type { NormalizedFinancialRecord } from "@/efos/engines/data";

/**
 * Contrato do Builder oficial responsável por organizar os registros
 * utilizados na estrutura do Fluxo de Caixa (Mission 056 — Cash Flow
 * Builder). Primeira implementação concreta: `DefaultCashFlowBuilder`
 * (`DefaultCashFlowBuilder.ts`).
 *
 * `build()` recebe a mesma coleção de `NormalizedFinancialRecord` que
 * `FinancialModelEngine.execute()` aceita — o contrato oficial e
 * imutável de entrada do Engine (D-002) — e devolve essa mesma
 * coleção, apenas reorganizada. Nenhum tipo novo.
 *
 * **Nenhum cálculo financeiro. Nenhuma inferência. Nenhuma IA.** Apenas
 * organização dos registros existentes, usando exclusivamente `kind` e
 * `eventType` (campos já existentes). A Ontologia Financeira oficial
 * (`efos/domain/enums/domain-classification.ts`) e as convenções já
 * estabelecidas no projeto (D-004, `docs/DECISIONS.md`; Evidence
 * Engine) só classificam Entrada/Saída de Caixa **operacional** — não
 * existe, hoje, nenhuma classificação oficial de Fluxo de Caixa de
 * Investimento ou Financiamento. Por instrução explícita da missão
 * ("Caso não exista classificação oficial... não criar convenções
 * novas"), nenhum desses dois grupos foi inventado — nenhum registro é
 * criado, removido, alterado ou recalculado; nenhum saldo/fluxo líquido
 * é inferido; nenhuma data ou `currency` é alterada. Cada
 * `NormalizedFinancialRecord` devolvido é exatamente o mesmo objeto
 * recebido (mesma referência) — a única mudança observável possível é
 * a posição de um registro dentro do array.
 *
 * Ver `README.md` deste diretório para o racional completo.
 */
export interface CashFlowBuilder {
  build(
    records: readonly NormalizedFinancialRecord[]
  ): readonly NormalizedFinancialRecord[];
}
