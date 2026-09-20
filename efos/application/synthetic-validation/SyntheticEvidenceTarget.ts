/**
 * Mission 158 — Second Synthetic Company / Evidence Threshold Validation.
 *
 * `SyntheticEvidenceTarget` — metadata de validação declarando QUAIS
 * condições um cenário foi deliberadamente desenhado para cruzar nos
 * limiares REAIS do `EvidenceEngine` (`efos/engines/evidence/evidence.constants.ts`).
 * Documenta a intenção do desenho ANTES da execução real — nunca
 * garante o resultado por si só (a Engine real decide, sempre).
 *
 * **REGRA CENTRAL (Etapa 5/17)**: `SyntheticEvidenceTarget` nunca é
 * enviado a nenhuma Engine — é metadata do harness de validação, no
 * mesmo espírito de `SyntheticGroundTruth` (nunca Financial Truth).
 */
export interface SyntheticEvidenceTarget {
  /** `EvidenceType` real esperado (vocabulário fechado do Domain — hoje sempre "negative" para as 5 regras existentes). */
  readonly targetEvidenceType: string;
  /** Descrição da condição de negócio que deveria cruzar o limiar. */
  readonly targetCondition: string;
  /** Índice do período (1-based) em que a condição foi desenhada para cruzar o limiar pela primeira vez. */
  readonly supportingPeriod: number;
  /** Valor numérico do limiar real, lido de `evidence.constants.ts` — nunca reinventado. */
  readonly expectedThreshold: number;
  /** Nome do `Indicator`/métrica real que a regra de detecção consulta (`RECOGNIZED_INDICATOR_NAMES` ou convenção de evento). */
  readonly expectedMetric: string;
  /** `EvidenceDraft.key` real esperado, se a Engine reconhecer a condição — usado só para documentar a expectativa, nunca para forçar o resultado. */
  readonly expectedOutcome: string;
}
