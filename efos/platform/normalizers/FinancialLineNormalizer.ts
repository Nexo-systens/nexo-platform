import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Contrato do primeiro módulo de normalização de linhas financeiras
 * da plataforma EFOS (Mission 047 — Financial Line Normalization).
 * Primeira implementação concreta: `DefaultFinancialLineNormalizer`
 * (`DefaultFinancialLineNormalizer.ts`).
 *
 * `normalize()` recebe um `RawFinancialDocument` já classificado
 * (`FinancialLineClassifier`, Mission 046) e devolve um
 * `RawFinancialDocument` — mesmo contrato oficial do Data Engine
 * (`efos/engines/data/data.types.ts`), nenhum tipo novo — com cada
 * `RawFinancialLine` limpa e padronizada: `label` sem espaços
 * redundantes, em forma Unicode canônica, sem símbolo monetário
 * duplicado quando `currency` já o representa estruturalmente;
 * `currency`/`date`/`amount` re-emitidos em forma canônica.
 *
 * Estritamente formatação/representação — **nunca** classificação.
 * `FinancialLineClassifier` continua sendo a única camada que decide
 * `kindHint`/`resourceTypeHint`/`eventTypeHint`/`amount`/`currency`/
 * `date`; este módulo nunca infere um campo que o Classifier deixou
 * ausente, nunca reclassifica, nunca usa heurística de classificação.
 * Sem IA, sem LLM, sem embeddings.
 */
export interface FinancialLineNormalizer {
  normalize(document: RawFinancialDocument): RawFinancialDocument;
}
