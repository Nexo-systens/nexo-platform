import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Contrato do primeiro módulo de classificação determinística de
 * linhas financeiras da plataforma EFOS (Mission 046 — Financial Line
 * Classification). Primeira implementação concreta:
 * `DefaultFinancialLineClassifier` (`DefaultFinancialLineClassifier.ts`).
 *
 * `classify()` recebe um `RawFinancialDocument` já produzido (ex.:
 * por `PdfParser`, Mission 045 — cada linha só com `label`) e devolve
 * um `RawFinancialDocument` — mesmo contrato oficial do Data Engine
 * (`efos/engines/data/data.types.ts`), nenhum tipo novo — com cada
 * `RawFinancialLine` enriquecida com os campos opcionais já previstos
 * pelo contrato (`amount`, `currency`, `date`, `kindHint`,
 * `resourceTypeHint`, `eventTypeHint`) sempre que forem detectáveis de
 * forma determinística e sem ambiguidade a partir do próprio texto da
 * linha. Nunca inventa dado: um campo permanece ausente/`undefined`
 * quando não houver certeza.
 *
 * Sem IA, sem LLM, sem OCR — apenas regras determinísticas (padrões
 * de texto/palavras-chave). Nenhuma regra financeira/contábil é
 * aplicada aqui — classificação sintática de texto, nunca
 * interpretação de DRE/Balanço; isso continua pertencendo
 * exclusivamente aos Builders dos Engines.
 */
export interface FinancialLineClassifier {
  classify(document: RawFinancialDocument): RawFinancialDocument;
}
