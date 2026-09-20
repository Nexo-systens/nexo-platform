import { randomUUID } from "node:crypto";

import { PDFParse } from "pdf-parse";

import type { RawFinancialDocument, RawFinancialLine } from "@/efos/engines/data";

import type { PdfParser } from "./PdfParser";

/**
 * Primeira implementação concreta de `PdfParser` (Mission 045 — PDF
 * Text Extraction) — primeira extração real de documentos financeiros
 * da plataforma. Usa `pdf-parse` (biblioteca estável de leitura de
 * PDF, construída sobre `pdfjs-dist`, a mesma engine usada pelo
 * Firefox) para extrair o texto bruto de um `File` PDF.
 *
 * `parse()`:
 * 1. Lê o `File` como `ArrayBuffer` (`file.arrayBuffer()`).
 * 2. Extrai o texto via `PDFParse.getText()`.
 * 3. Divide o texto em linhas (`\n`), remove linhas vazias/apenas
 *    espaço, preserva a ordem original.
 * 4. Monta `RawFinancialDocument` — `documentId` usa o id canônico
 *    recebido do chamador quando existe (`public.documents.id`,
 *    Mission 108 — Canonical Document Identity: o Parser nunca deve
 *    inventar a identidade de um documento já persistido); só recorre
 *    a `node:crypto` `randomUUID()` quando nenhum id é passado (ex.:
 *    `POST /api/efos/upload`, que analisa arquivos efêmeros nunca
 *    armazenados — não há identidade canônica para preservar).
 *    `companyId` recebido do chamador, `source` é `file.name`, `lines`
 *    é cada linha de texto convertida em `RawFinancialLine` só com
 *    `label` preenchido — nenhuma classificação de valor/data/
 *    `kindHint` nesta missão, isso pertence a uma futura etapa de
 *    interpretação.
 *
 * Nenhum OCR, nenhuma imagem, nenhum Excel/Word/CSV — somente PDF com
 * texto extraível (não digitalizado/escaneado).
 */
export class DefaultPdfParser implements PdfParser {
  async parse(
    file: File,
    companyId: string,
    documentId?: string
  ): Promise<RawFinancialDocument> {
    const arrayBuffer = await file.arrayBuffer();

    const parser = new PDFParse({ data: arrayBuffer });

    try {
      // `pageJoiner: ""` desativa o marcador de fronteira de página
      // que a biblioteca insere por padrão ("-- page_number of
      // total_number --") — sem isso, esse texto sintético apareceria
      // como uma linha a mais em `lines`, poluindo a entrada do Data
      // Engine com algo que nunca fez parte do documento real.
      const result = await parser.getText({ pageJoiner: "" });

      const lines: readonly RawFinancialLine[] = result.text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((label) => ({ label }));

      const document: RawFinancialDocument = {
        documentId: documentId ?? randomUUID(),
        companyId,
        source: file.name,
        lines,
      };

      return document;
    } finally {
      await parser.destroy();
    }
  }
}
