import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Camada oficial responsável por receber os documentos enviados pela
 * Plataforma antes da execução do EFOS (Mission 026 — Document Intake
 * Layer). Converte uma coleção de documentos externos em uma coleção
 * oficial de `RawFinancialDocument` (`efos/engines/data/
 * data.types.ts`, contrato oficial já produzido pelo Data Engine,
 * D-002) — nunca faz upload, nunca salva arquivo, nunca faz OCR/
 * parsing contábil/IA. Apenas normaliza e valida a entrada estrutural
 * dos documentos que serão enviados ao Data Engine via
 * `PipelineContext.metadata.documents` (D-016).
 *
 * Primeira implementação concreta: `DefaultDocumentIntake`
 * (`DefaultDocumentIntake.ts`). Único método público:
 * `prepareDocuments()`.
 */
export interface DocumentIntake {
  prepareDocuments(
    documents: readonly RawFinancialDocument[]
  ): readonly RawFinancialDocument[];
}
