import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  hasPdfSignature,
  looksLikeBinaryContent,
  validateDocumentContent,
} from "@/modules/documents/utils/content-validation";

/**
 * Mission 195 Closure — Trusted Upload Boundary & Activation Integrity.
 * `validateDocumentContent()` é a fronteira que garante que um
 * documento registrado como "PDF" ou "CSV" genuinamente contém bytes
 * compatíveis com esse formato — nunca apenas um nome de arquivo
 * terminando na extensão certa. Testes puros, nenhum I/O, nenhum
 * Supabase — a mesma função chamada por `createDocumentAction()`
 * depois de baixar os bytes reais do Storage.
 */

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const REAL_PDF_HEADER = bytesOf("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\n");
const REALISTIC_CSV = bytesOf(
  "Balanço Patrimonial\nData-base: 31/07/2026\nCaixa R$ 100.000,00\n"
);

describe("hasPdfSignature() — assinatura binária %PDF-", () => {
  test("PDF real (cabeçalho genuíno) tem assinatura válida", () => {
    assert.equal(hasPdfSignature(REAL_PDF_HEADER), true);
  });

  test("texto arbitrário renomeado para .pdf não tem assinatura válida", () => {
    assert.equal(hasPdfSignature(bytesOf("isto nao e um PDF, apenas texto")), false);
  });

  test("bytes vazios/curtos nunca têm assinatura válida", () => {
    assert.equal(hasPdfSignature(new Uint8Array(0)), false);
    assert.equal(hasPdfSignature(bytesOf("%PD")), false);
  });
});

describe("looksLikeBinaryContent() — heurística de byte NUL", () => {
  test("texto genuíno (incluindo acentuação PT-BR) nunca é tratado como binário", () => {
    assert.equal(looksLikeBinaryContent(REALISTIC_CSV), false);
  });

  test("conteúdo com byte NUL é tratado como binário", () => {
    const binary = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]); // cabeçalho PNG genuíno
    assert.equal(looksLikeBinaryContent(binary), true);
  });

  test("byte NUL fora da amostra inicial (8KB) não é detectado — heurística deliberadamente barata, nunca lê o arquivo inteiro", () => {
    const padding = new Uint8Array(8192).fill(0x41); // "AAAA..." — texto genuíno
    const withLateNull = new Uint8Array([...padding, 0x00]);
    assert.equal(
      looksLikeBinaryContent(withLateNull),
      false,
      "byte NUL após a amostra de 8KB não invalida — verificação intencionalmente barata (Seção 8/9: 'smallest defensible check')"
    );
  });
});

describe("validateDocumentContent() — fronteira única de conteúdo", () => {
  test("PDF genuíno (.pdf + assinatura válida) é aceito", () => {
    const result = validateDocumentContent("dre.pdf", REAL_PDF_HEADER);
    assert.equal(result.valid, true);
  });

  test("CSV genuíno (.csv + texto sem byte NUL) é aceito", () => {
    const result = validateDocumentContent("balanco.csv", REALISTIC_CSV);
    assert.equal(result.valid, true);
  });

  test("Seção 20/21 — .pdf com conteúdo não-PDF (renomeado) é rejeitado", () => {
    const result = validateDocumentContent("dre.pdf", bytesOf("conteudo de texto qualquer"));
    assert.equal(result.valid, false);
  });

  test("Seção 23 — .csv com conteúdo binário (renomeado) é rejeitado", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const result = validateDocumentContent("extrato.csv", png);
    assert.equal(result.valid, false);
  });

  test("Seção 24 — arquivo vazio é rejeitado, tanto .pdf quanto .csv", () => {
    assert.equal(validateDocumentContent("dre.pdf", new Uint8Array(0)).valid, false);
    assert.equal(validateDocumentContent("extrato.csv", new Uint8Array(0)).valid, false);
  });

  test("Seção 21 — PDF com assinatura válida mas estruturalmente corrompido depois da assinatura ainda passa aqui (responsabilidade do parser real, Mission 193)", () => {
    const corruptButSigned = new Uint8Array([...REAL_PDF_HEADER, ...bytesOf("lixo binario depois")]);
    const result = validateDocumentContent("dre.pdf", corruptButSigned);
    assert.equal(
      result.valid,
      true,
      "esta fronteira só rejeita 'obviamente não é PDF' — corrupção estrutural além da assinatura é responsabilidade do parser real durante o processamento técnico"
    );
  });

  test("formatos enviáveis mas não-analisáveis (XLSX/DOC/PNG/etc.) nunca têm conteúdo verificado aqui — fora de escopo, nenhuma alegação de analisabilidade a proteger", () => {
    const anyBytes = new Uint8Array([0x00, 0x01, 0x02]);
    assert.equal(validateDocumentContent("planilha.xlsx", anyBytes).valid, true);
  });

  test("Seção 25 — MIME nunca é consultado por esta função (extensão + bytes apenas) — MIME declarado pelo navegador nunca é autoridade", () => {
    // `validateDocumentContent` nem recebe um parâmetro de MIME —
    // prova estrutural de que ele nunca pode influenciar a decisão.
    assert.equal(validateDocumentContent.length, 2, "assinatura da função: (fileName, bytes) — nunca um terceiro parâmetro de MIME");
  });
});
