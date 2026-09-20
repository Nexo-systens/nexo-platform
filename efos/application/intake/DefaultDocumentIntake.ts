import type { RawFinancialDocument } from "@/efos/engines/data";

import type { DocumentIntake } from "./DocumentIntake";

/**
 * Primeira implementação concreta de `DocumentIntake` (Mission 026 —
 * Document Intake Layer). Responsabilidade estritamente estrutural,
 * nenhuma regra financeira, nenhum parsing contábil, nenhum OCR,
 * nenhuma IA:
 *
 * - coleção vazia é um caso válido, nunca um erro — devolve `[]`;
 * - entradas nulas/indefinidas são descartadas;
 * - duplicatas por `documentId` são descartadas (primeira ocorrência
 *   vence, ordem original preservada);
 * - a ordem original dos documentos remanescentes é preservada;
 * - a coleção retornada é sempre uma cópia nova, nunca o array
 *   recebido — imutável (`readonly`) e sem referência compartilhada
 *   com o array de entrada.
 *
 * Nenhum `RawFinancialDocument` individual é modificado — cada
 * documento mantido na saída é exatamente a mesma referência de
 * objeto recebida na entrada; nenhum documento novo é criado.
 */
export class DefaultDocumentIntake implements DocumentIntake {
  prepareDocuments(
    documents: readonly RawFinancialDocument[]
  ): readonly RawFinancialDocument[] {
    if (documents.length === 0) {
      return [];
    }

    const seenDocumentIds = new Set<string>();
    const prepared: RawFinancialDocument[] = [];

    for (const document of documents) {
      if (!document) {
        continue;
      }

      if (seenDocumentIds.has(document.documentId)) {
        continue;
      }

      seenDocumentIds.add(document.documentId);
      prepared.push(document);
    }

    return prepared;
  }
}
