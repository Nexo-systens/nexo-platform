import { randomUUID } from "node:crypto";

import type { RawFinancialDocument, RawFinancialLine } from "@/efos/engines/data";

import type { CsvParser } from "./CsvParser";

/**
 * Primeira implementação concreta de `CsvParser` (Mission 083 — EFOS
 * Multi-Format Financial Document Intake). Nenhuma biblioteca nova —
 * `File.text()` (Web File API, já disponível no runtime, mesmo
 * espírito de `file.arrayBuffer()` já usado por `DefaultPdfParser`) é
 * suficiente para um formato de texto simples.
 *
 * `parse()`:
 * 1. Lê o `File` como texto (`file.text()`).
 * 2. Divide o texto em linhas (`\n`), remove linhas vazias/apenas
 *    espaço, preserva a ordem original — mesma regra de
 *    `DefaultPdfParser`.
 * 3. Monta `RawFinancialDocument` — `documentId` usa o id canônico
 *    recebido do chamador quando existe (`public.documents.id`,
 *    Mission 108 — Canonical Document Identity), só recorrendo a
 *    `node:crypto` `randomUUID()` quando nenhum id é passado (mesmo
 *    critério de `DefaultPdfParser`); `companyId` recebido do
 *    chamador, `source` é `file.name`, `lines` é cada linha do CSV
 *    (com seus delimitadores originais preservados) convertida em
 *    `RawFinancialLine` só com `label` preenchido — nenhuma
 *    interpretação de coluna, nenhuma classificação de valor/data/
 *    `kindHint` nesta missão, isso pertence ao Classifier (mesma etapa
 *    que já processa linhas de PDF), nunca a este parser.
 *
 * A primeira linha (cabeçalho de coluna, se existir) não é tratada
 * de forma especial — vira uma `RawFinancialLine` como qualquer
 * outra; o Classifier já ignora linhas sem `amount`/`date`
 * reconhecíveis (mesmo comportamento de uma linha de texto de PDF
 * sem dado financeiro).
 */
export class DefaultCsvParser implements CsvParser {
  async parse(
    file: File,
    companyId: string,
    documentId?: string
  ): Promise<RawFinancialDocument> {
    const text = await file.text();

    const lines: readonly RawFinancialLine[] = text
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
  }
}
