import type { CandidateFinancialRecord } from "@/efos/engines/data";

/**
 * Contrato do primeiro Builder do EFOS Core responsável por consolidar
 * registros financeiros em demonstrações (Mission 053 — Financial
 * Statement Builder). Primeira implementação concreta:
 * `DefaultFinancialStatementBuilder`
 * (`DefaultFinancialStatementBuilder.ts`).
 *
 * `build()` recebe uma coleção de `CandidateFinancialRecord` — o tipo
 * intermediário produzido pelo Mapper do Data Engine
 * (`efos/engines/data/data.types.ts`, `data.mapper.ts`), definido lá
 * como produtor oficial (mesma regra de D-002: o tipo é definido uma
 * única vez no Engine produtor e importado por tipo) — e devolve essa
 * mesma coleção, apenas reorganizada. Nenhum tipo novo.
 *
 * **Nenhum cálculo financeiro novo. Nenhuma IA. Nenhuma inferência.**
 * Apenas organização dos registros existentes: nenhum registro é
 * criado, nenhum valor/data é alterado, `amount` nunca é recalculado.
 * Cada `CandidateFinancialRecord` devolvido é exatamente o mesmo objeto
 * recebido (mesma referência) — a única mudança observável possível é
 * a posição de um registro dentro do array.
 *
 * `build()` **não é chamado por `FinancialModelEngine.execute()`**
 * nesta missão — ver `README.md` deste diretório para o racional
 * completo de por que o contrato oficial de entrada do Engine
 * (`NormalizedFinancialRecord`, D-002) não foi alterado.
 */
export interface FinancialStatementBuilder {
  build(
    records: readonly CandidateFinancialRecord[]
  ): readonly CandidateFinancialRecord[];
}
