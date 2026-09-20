import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Contrato do primeiro módulo de consolidação de documentos
 * financeiros da plataforma EFOS (Mission 049 — Financial Document
 * Consolidation). Primeira implementação concreta:
 * `DefaultFinancialDocumentConsolidator`
 * (`DefaultFinancialDocumentConsolidator.ts`).
 *
 * `consolidate()` recebe a coleção completa de `RawFinancialDocument`
 * já resolvida (`FinancialEventResolver`, Mission 048) — antes desta
 * missão, cada documento era tratado isoladamente, sem nenhuma
 * verificação entre documentos ou entre linhas do mesmo documento — e
 * devolve uma coleção sem duplicações estruturais: documentos
 * duplicados removidos, linhas duplicadas dentro do mesmo documento
 * removidas, ordem original preservada.
 *
 * Estritamente consolidação estrutural — **nunca** recalcula valor,
 * **nunca** funde documentos diferentes, **nunca** altera
 * `label`/`date`/`amount`/classificação de nenhuma linha remanescente.
 * `documentId`/`companyId`/`source` de cada documento remanescente
 * permanecem exatamente como recebidos.
 */
export interface FinancialDocumentConsolidator {
  consolidate(
    documents: readonly RawFinancialDocument[]
  ): readonly RawFinancialDocument[];
}
