import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Contrato do primeiro módulo de resolução de eventos financeiros da
 * plataforma EFOS (Mission 048 — Financial Event Resolution).
 * Primeira implementação concreta: `DefaultFinancialEventResolver`
 * (`DefaultFinancialEventResolver.ts`).
 *
 * `resolve()` recebe um `RawFinancialDocument` já classificado
 * (`FinancialLineClassifier`, Mission 046) e normalizado
 * (`FinancialLineNormalizer`, Mission 047), e devolve um
 * `RawFinancialDocument` — mesmo contrato oficial do Data Engine
 * (`efos/engines/data/data.types.ts`), nenhum tipo novo. `RawFinancialLine`
 * não tem campos separados `eventType`/`occurredAt`/`kind` — o Data
 * Engine (`data.mapper.ts`) já os deriva diretamente de
 * `eventTypeHint`/`date`/`kindHint` na hora de montar
 * `CandidateFinancialRecord`. "Resolver" um evento, portanto, significa
 * consolidar esses três campos já existentes quando os sinais
 * necessários estiverem inequivocamente presentes na própria linha —
 * nunca criar um campo novo, nunca inventar um valor.
 *
 * Estritamente consolidação — nunca classificação (isso é exclusivo
 * de `FinancialLineClassifier`) nem formatação (isso é exclusivo de
 * `FinancialLineNormalizer`). Sem IA, sem LLM. Se um campo obrigatório
 * não puder ser resolvido a partir do que já existe, permanece
 * ausente — nunca assumido, nunca inferido.
 */
export interface FinancialEventResolver {
  resolve(document: RawFinancialDocument): RawFinancialDocument;
}
