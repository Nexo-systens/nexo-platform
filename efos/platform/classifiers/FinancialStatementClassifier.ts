import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Resultado de detecção/classificação de um documento como
 * demonstrativo financeiro por período (Mission 192 — Canonical
 * Financial Statement Ingestion & Period Semantics). Nunca exposto
 * como parte do `RawFinancialDocument` retornado por `classify()` —
 * `RawFinancialLine`/`RawFinancialDocument` não têm campo para
 * registrar diagnóstico (mesmo racional já estabelecido por
 * `FinancialRecordValidator`/`FinancialContextBuilder`, Missions
 * 051/052) — usado apenas pelo chamador (`prepareFinancialDocuments`)
 * para decidir se o documento entra no lote e para relatar
 * honestamente uma exclusão (Seção 23 da Mission 192).
 */
export interface StatementClassificationSummary {
  /** O documento contém vocabulário de demonstrativo (DRE) reconhecível. */
  readonly recognizedAsStatement: boolean;
  /** Um período único e não ambíguo para o documento inteiro foi extraído. */
  readonly periodResolved: boolean;
  /** Quantas linhas foram classificadas em uma `StatementCategory`. */
  readonly classifiedLineCount: number;
  /** Quantas linhas de conteúdo (excluindo cabeçalho/período) não puderam ser classificadas. */
  readonly unclassifiedLineCount: number;
}

/**
 * Interpreta um documento já parseado (texto/linhas) como um
 * demonstrativo financeiro agregado por período (DRE) — nunca uma
 * transação/evento datado. Estritamente separado de
 * `FinancialLineClassifier` (que continua servindo documentos
 * transacionais/extrato bancário, inalterado — Seção 21 da Mission
 * 192): um documento nunca passa pelos dois classificadores.
 */
export interface FinancialStatementClassifier {
  /**
   * Decide, por conteúdo (nunca por `categoria` informada no upload —
   * Seção 13 da Mission 192, "never trust category alone"), se este
   * documento deve ser interpretado como demonstrativo por período em
   * vez de transacional.
   */
  looksLikeFinancialStatement(document: RawFinancialDocument): boolean;

  /**
   * Classifica cada linha em uma `StatementCategory` e anexa o período
   * único do documento — nunca uma data por linha. Linhas sem
   * correspondência inequívoca permanecem sem `kindHint` (nunca
   * inventado). Se o período do documento não puder ser determinado,
   * NENHUMA linha recebe `kindHint="statement_line"` — o documento
   * inteiro permanece não resolvido (ver `summarize()`).
   */
  classify(document: RawFinancialDocument): RawFinancialDocument;

  /** Diagnóstico não persistido — ver `StatementClassificationSummary`. */
  summarize(document: RawFinancialDocument): StatementClassificationSummary;
}
