import type { NormalizedFinancialRecord } from "@/efos/engines/data";

/**
 * Contrato do primeiro Builder responsável pela estrutura do Balanço
 * Patrimonial (Mission 054 — Balance Sheet Builder). Primeira
 * implementação concreta: `DefaultBalanceSheetBuilder`
 * (`DefaultBalanceSheetBuilder.ts`).
 *
 * `build()` recebe a mesma coleção de `NormalizedFinancialRecord` que
 * `FinancialModelEngine.execute()` aceita — o contrato oficial e
 * imutável de entrada do Engine (D-002) — e devolve essa mesma coleção,
 * apenas reorganizada em três grupos do Balanço Patrimonial: ATIVO,
 * PASSIVO e PATRIMÔNIO LÍQUIDO. Nenhum tipo novo.
 *
 * **Nenhum cálculo financeiro. Nenhuma inferência. Nenhuma IA.** Apenas
 * organização dos registros existentes, usando exclusivamente `kind` e
 * `resourceType` (campos já existentes) e a convenção de classificação
 * já estabelecida em D-004 (`docs/DECISIONS.md`) — nenhuma heurística
 * nova. Nenhum registro é criado, alterado ou removido; nenhum valor é
 * recalculado; nenhuma data é alterada. Cada `NormalizedFinancialRecord`
 * devolvido é exatamente o mesmo objeto recebido (mesma referência) — a
 * única mudança observável possível é a posição de um registro dentro
 * do array.
 *
 * Ver `README.md` deste diretório para o racional completo de por que
 * PATRIMÔNIO LÍQUIDO nunca recebe nenhum registro classificado (D-004
 * define Patrimônio Líquido como identidade contábil — Ativo Total
 * menos Passivo Total — sem nenhum `ResourceType` dedicado) e por que
 * eventos e recursos não cobertos por D-004 são preservados num quarto
 * grupo residual, ao final.
 */
export interface BalanceSheetBuilder {
  build(
    records: readonly NormalizedFinancialRecord[]
  ): readonly NormalizedFinancialRecord[];
}
