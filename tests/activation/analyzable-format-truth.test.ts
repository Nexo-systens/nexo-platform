import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isAllowedFileExtension,
  isAnalyzableDocumentName,
} from "@/modules/documents/utils/file";

/**
 * Mission 195 — Founding Company Production Onboarding & First
 * Executive Value, Seção 10/44. Regressão permanente da verdade de
 * formato: `ALLOWED_FILE_EXTENSIONS` (o que pode ser ENVIADO/armazenado)
 * é deliberadamente mais amplo que `isAnalyzableDocumentName()` (o que
 * de fato chega a `listAnalyzableDocumentsByCompany()` e contribui para
 * uma análise financeira, `.pdf`/`.csv` — os únicos dois formatos com
 * parser real hoje, `efos/platform/parsers/README.md`). Este teste
 * trava essa relação: nenhuma extensão pode se tornar "analisável" sem
 * que este arquivo (e o parser real correspondente) sejam atualizados
 * deliberadamente — nunca um "esquecimento" silencioso em produção.
 */

const UPLOADABLE_BUT_NOT_ANALYZABLE = ["xlsx", "xls", "doc", "docx", "png", "jpg", "jpeg"];
const ANALYZABLE = ["pdf", "csv"];

describe("isAnalyzableDocumentName() — apenas PDF/CSV, nunca mais que isso hoje", () => {
  test("PDF e CSV são analisáveis", () => {
    for (const extension of ANALYZABLE) {
      assert.equal(isAnalyzableDocumentName(`documento.${extension}`), true, extension);
      assert.equal(isAnalyzableDocumentName(`DOCUMENTO.${extension.toUpperCase()}`), true, extension);
    }
  });

  test("formatos enviáveis mas sem parser real (XLSX/XLS/DOC/DOCX/PNG/JPG/JPEG) nunca são analisáveis", () => {
    for (const extension of UPLOADABLE_BUT_NOT_ANALYZABLE) {
      assert.equal(
        isAnalyzableDocumentName(`documento.${extension}`),
        false,
        `${extension} pode ser enviado/armazenado, mas nunca deveria ser tratado como analisável`
      );
    }
  });

  test("todo formato UPLOADABLE_BUT_NOT_ANALYZABLE ainda é aceito no upload (armazenamento legítimo, nunca bloqueado por engano)", () => {
    for (const extension of UPLOADABLE_BUT_NOT_ANALYZABLE) {
      assert.equal(
        isAllowedFileExtension(`documento.${extension}`),
        true,
        `${extension} deveria continuar podendo ser armazenado, mesmo não sendo analisado`
      );
    }
  });

  test("extensão desconhecida nunca é analisável nem enviável", () => {
    assert.equal(isAnalyzableDocumentName("documento.exe"), false);
    assert.equal(isAllowedFileExtension("documento.exe"), false);
  });

  test("arquivo sem extensão nunca é analisável", () => {
    assert.equal(isAnalyzableDocumentName("documento-sem-extensao"), false);
  });
});
