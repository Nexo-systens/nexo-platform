import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Contrato do segundo módulo de extração real de documentos
 * financeiros da plataforma EFOS (Mission 083 — EFOS Multi-Format
 * Financial Document Intake). Primeira implementação concreta:
 * `DefaultCsvParser` (`DefaultCsvParser.ts`).
 *
 * `parse()` recebe um `File` (CSV), o `companyId` já conhecido pelo
 * chamador e, opcionalmente, o `documentId` **canônico** do documento
 * já persistido (`public.documents.id` — Mission 108, Canonical
 * Document Identity; mesmo parâmetro de `PdfParser`), e devolve um
 * `RawFinancialDocument` já pronto — o mesmo contrato oficial do Data
 * Engine (`efos/engines/data/data.types.ts`) já usado por `PdfParser`
 * (Mission 045), nenhum tipo novo. Responsabilidade estritamente de
 * extração/estruturação de texto: lê o conteúdo textual do CSV, separa
 * em linhas, remove linhas vazias, preserva a ordem original — nenhuma
 * regra financeira, nenhuma interpretação de coluna, nenhuma
 * classificação de `kindHint`/valor/data (isso continua pertencendo ao
 * Classifier, exatamente como já acontece para PDF).
 *
 * Cada linha do CSV (incluindo seus delimitadores originais, `,`/`;`)
 * vira o `label` bruto de um `RawFinancialLine` — o mesmo tratamento
 * que uma linha de texto extraída de um PDF já recebe; o EFOS nunca
 * sabe, a partir daqui, se a linha veio de um PDF ou de um CSV.
 */
export interface CsvParser {
  parse(
    file: File,
    companyId: string,
    documentId?: string
  ): Promise<RawFinancialDocument>;
}
