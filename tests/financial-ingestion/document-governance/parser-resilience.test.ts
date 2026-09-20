import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { prepareFinancialDocuments } from "@/app/api/efos/_shared/prepareFinancialDocuments";

/**
 * Mission 193 Closure — Technical Status Ownership & Concurrent
 * Governance Safety, Seção 1/5/23: prova central de que um arquivo
 * tecnicamente ilegível (PDF corrompido — `pdf-parse`/`pdfjs-dist`
 * lança ao tentar ler bytes que não são um PDF válido, confirmado por
 * leitura direta de `DefaultPdfParser.parse()`, nenhum try/catch
 * interno até esta correção) nunca aborta a preparação de OUTROS
 * documentos do mesmo lote — "failure ownership" isolado por
 * documento, nunca pelo lote inteiro.
 *
 * Roda através de `prepareFinancialDocuments()` real (o ponto de
 * entrada baseado em `File`, nunca uma reimplementação de parsing) —
 * a única forma de exercitar de fato `parseSupportedFile()`'s
 * try/catch (Mission 193 Closure).
 */
describe("Per-document technical failure isolation", () => {
  test("PDF corrompido não impede que um CSV válido no mesmo lote seja tecnicamente processado", async () => {
    const corruptPdf = new File(
      [Buffer.from("isto nao e um PDF valido, apenas bytes de lixo para pdf-parse lancar")],
      "corrompido.pdf",
      { type: "application/pdf" }
    );
    const validCsv = new File(
      [Buffer.from("Balanço Patrimonial\nData-base: 31/07/2026\nCaixa R$ 100.000,00\n")],
      "balanco.csv",
      { type: "text/csv" }
    );

    const { documents, excluded } = await prepareFinancialDocuments(
      [
        { file: corruptPdf, documentId: "doc-corrupt" },
        { file: validCsv, documentId: "doc-valid" },
      ],
      "company-parser-resilience"
    );

    const survivingIds = new Set([
      ...documents.map((document) => document.documentId),
      ...excluded.map((entry) => entry.documentId),
    ]);

    assert.equal(
      survivingIds.has("doc-valid"),
      true,
      "o CSV válido deve ter sido tecnicamente processado (presente em documents ou excluded)"
    );
    assert.equal(
      survivingIds.has("doc-corrupt"),
      false,
      "o PDF corrompido nunca aparece nem entre aceitos nem entre excluídos — o lote inteiro NÃO foi abortado por causa dele"
    );
  });
});
