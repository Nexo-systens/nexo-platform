import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Contrato do primeiro módulo de extração real de documentos
 * financeiros da plataforma EFOS (Mission 045 — PDF Text Extraction).
 * Primeira implementação concreta: `DefaultPdfParser`
 * (`DefaultPdfParser.ts`).
 *
 * `parse()` recebe um `File` (PDF), o `companyId` já conhecido pelo
 * chamador e, opcionalmente, o `documentId` **canônico** do documento
 * já persistido (`public.documents.id` — Mission 108, Canonical
 * Document Identity) e devolve um `RawFinancialDocument` já pronto —
 * contrato oficial do Data Engine (`efos/engines/data/data.types.ts`),
 * nenhum tipo novo. Responsabilidade estritamente de extração/
 * estruturação de texto: extrai o conteúdo textual do PDF, separa em
 * linhas, remove linhas vazias, preserva a ordem original — nenhuma
 * regra financeira, nenhuma classificação de `kindHint`/valor/data
 * (isso continua sendo decidido por uma futura etapa de interpretação,
 * não por este parser).
 *
 * `documentId` é opcional porque nem todo chamador tem um documento já
 * persistido para referenciar (`POST /api/efos/upload` analisa
 * `File[]` efêmeros, nunca armazenados — não existe identidade
 * canônica para preservar nesse caso). Quando omitido, a implementação
 * gera um id próprio apenas para a execução atual — nunca finge ser
 * a identidade de um documento real.
 *
 * Apenas PDF nesta missão — OCR, imagem, Excel e Word permanecem
 * fora de escopo, cada um exigiria sua própria implementação de
 * `parse()`-like, não coberta por este contrato. CSV ganhou seu
 * próprio parser irmão desde a Mission 083 (`CsvParser`/
 * `DefaultCsvParser`).
 */
export interface PdfParser {
  parse(
    file: File,
    companyId: string,
    documentId?: string
  ): Promise<RawFinancialDocument>;
}
