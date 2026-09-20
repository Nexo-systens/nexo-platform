import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Contrato da camada final de preparação de documentos financeiros da
 * plataforma EFOS (Mission 050 — Financial Knowledge Builder).
 * Primeira implementação concreta: `DefaultFinancialKnowledgeBuilder`
 * (`DefaultFinancialKnowledgeBuilder.ts`).
 *
 * `build()` recebe a coleção completa de `RawFinancialDocument` já
 * classificada (`FinancialLineClassifier`, Mission 046), normalizada
 * (`FinancialLineNormalizer`, Mission 047), resolvida
 * (`FinancialEventResolver`, Mission 048) e consolidada
 * (`FinancialDocumentConsolidator`, Mission 049), e devolve uma
 * coleção — mesmo contrato oficial do Data Engine
 * (`efos/engines/data/data.types.ts`), nenhum tipo novo. **Esta
 * camada nunca executa o Pipeline** — apenas enriquece/certifica os
 * documentos antes de a `EFOSPlatform` entregá-los ao EFOS Core.
 *
 * Estritamente consolidação/validação estrutural sobre informação já
 * existente — nunca cria valor, data, documento ou campo novo; nunca
 * altera `amount`/`currency`/`label`/classificação já estabelecida;
 * nunca usa IA/LLM/heurística nova (nenhuma regra além das já usadas
 * por `FinancialLineClassifier`/`FinancialEventResolver`). Todo dado
 * de entrada é preservado na saída.
 */
export interface FinancialKnowledgeBuilder {
  build(
    documents: readonly RawFinancialDocument[]
  ): readonly RawFinancialDocument[];
}
