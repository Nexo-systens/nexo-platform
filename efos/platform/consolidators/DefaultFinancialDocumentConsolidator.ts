import type {
  RawFinancialDocument,
  RawFinancialLine,
} from "@/efos/engines/data";

import type { FinancialDocumentConsolidator } from "./FinancialDocumentConsolidator";

/**
 * Assinatura de conteúdo de uma linha — usada apenas para detectar
 * duplicatas exatas, nunca para alterar a linha em si. Duas linhas
 * são consideradas a mesma linha somente se todos os campos já
 * detectados (pelo Classifier/Normalizer/Resolver) forem idênticos.
 */
function lineSignature(line: RawFinancialLine): string {
  return JSON.stringify([
    line.label,
    line.amount,
    line.currency,
    line.date,
    line.kindHint,
    line.resourceTypeHint,
    line.eventTypeHint,
    // Mission 192, D-106: campos próprios de `kindHint === "statement_line"`
    // — sem eles, duas linhas de categorias de demonstrativo diferentes
    // mas com o mesmo texto/valor coincidente poderiam ser tratadas como
    // duplicata uma da outra.
    line.statementCategory,
    line.isTotalLine,
  ]);
}

/**
 * Remove linhas duplicadas dentro do mesmo documento — primeira
 * ocorrência vence, ordem original preservada. Nenhuma linha
 * remanescente é modificada; apenas duplicatas exatas são
 * descartadas.
 */
function deduplicateLines(
  lines: readonly RawFinancialLine[]
): readonly RawFinancialLine[] {
  const seenSignatures = new Set<string>();
  const deduplicated: RawFinancialLine[] = [];

  for (const line of lines) {
    const signature = lineSignature(line);

    if (seenSignatures.has(signature)) {
      continue;
    }

    seenSignatures.add(signature);
    deduplicated.push(line);
  }

  return deduplicated;
}

/**
 * Assinatura de conteúdo de um documento — `source` + a sequência de
 * assinaturas de suas linhas (já deduplicadas). Dois documentos com
 * `documentId` diferentes (ex.: o mesmo arquivo enviado duas vezes no
 * mesmo upload, cada `File` recebendo um `documentId` novo via
 * `randomUUID()`, Mission 042) mas conteúdo idêntico são tratados como
 * o mesmo documento estrutural — `documentId` nunca é usado como
 * chave de deduplicação aqui, porque duas instâncias distintas do
 * mesmo arquivo sempre recebem `documentId` diferentes antes de
 * chegar a este módulo.
 */
function documentSignature(document: RawFinancialDocument): string {
  return JSON.stringify([
    document.source,
    document.lines.map((line) => lineSignature(line)),
  ]);
}

/**
 * Primeira implementação concreta de `FinancialDocumentConsolidator`
 * (Mission 049 — Financial Document Consolidation). Consolidação
 * puramente estrutural — nunca recalcula valor, nunca funde
 * documentos diferentes, nunca altera `label`/`date`/`amount`/
 * classificação de nenhuma linha remanescente.
 *
 * `consolidate()`:
 * 1. Para cada documento, remove linhas duplicadas dentro dele
 *    (`deduplicateLines()`) — primeira ocorrência vence, ordem
 *    preservada.
 * 2. Entre documentos, remove documentos estruturalmente idênticos
 *    (mesmo `source`, mesma sequência de linhas já deduplicadas) —
 *    primeira ocorrência vence, ordem preservada. Documentos apenas
 *    parcialmente semelhantes (conteúdo diferente) nunca são
 *    fundidos — cada um permanece uma entrada separada na coleção.
 *
 * `documentId`/`companyId`/`source` de cada documento remanescente
 * permanecem exatamente como recebidos — nenhum campo é reescrito,
 * apenas entradas duplicadas inteiras são descartadas.
 */
export class DefaultFinancialDocumentConsolidator
  implements FinancialDocumentConsolidator
{
  consolidate(
    documents: readonly RawFinancialDocument[]
  ): readonly RawFinancialDocument[] {
    const documentsWithDeduplicatedLines = documents.map((document) => ({
      ...document,
      lines: deduplicateLines(document.lines),
    }));

    const seenDocumentSignatures = new Set<string>();
    const consolidated: RawFinancialDocument[] = [];

    for (const document of documentsWithDeduplicatedLines) {
      const signature = documentSignature(document);

      if (seenDocumentSignatures.has(signature)) {
        continue;
      }

      seenDocumentSignatures.add(signature);
      consolidated.push(document);
    }

    return consolidated;
  }
}
