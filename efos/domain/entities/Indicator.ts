import type { FinancialStateCategory, IndicatorUnit } from "../enums";
import type { IndicatorResult, Period } from "../value-objects";
import type { DomainEntity } from "./base";

/**
 * Indicador — metrica calculada (Margem, EBITDA, Liquidez, Capital de
 * Giro, ROIC, CAC, LTV, Burn Rate, Runway —
 * docs/01_ARCHITECTURE/04_DOMAIN MODEL.md, "Indicador"). Este dominio
 * nao calcula nada — representa apenas a forma que um indicador ja
 * calculado assume (calculo pertence ao Indicators Engine, efos/engines).
 *
 * `unit` e `formula` foram adicionados na Mission 007 (Indicators
 * Engine) — ver docs/DECISIONS.md D-003. `audit.createdAt` (DomainEntity)
 * cumpre o papel de timestamp de calculo; nenhum campo duplicado foi
 * criado para isso.
 *
 * `result` (Mission 098, D-052) substitui o antigo `value: number` —
 * torna indisponibilidade (ex.: divisor 0 de uma formula) explicita no
 * tipo, em vez de fabricar um `0` que se confundia com um resultado
 * legitimo. Ver `IndicatorResult` (efos/domain/value-objects).
 *
 * `sourceRecordIds` (Mission 110, D-056): `id`s de `Resource`/
 * `FinancialEvent` que genuinamente alimentaram o cálculo deste
 * indicador — construídos durante `extractFinancialStatementInputs()`/
 * `calculateIndicators()` (Indicators Engine), nunca reconstruídos
 * posteriormente. Opcional: `undefined` quando `result.status ===
 * "unavailable"` (não há "origem de um valor" para indisponibilidade,
 * D-052 preservado) ou quando a fórmula não depende de nenhum campo
 * com fonte rastreável (hoje, apenas `interestCoverage`). Nenhuma
 * execução persistida antes desta missão tem este campo — leitura
 * trata a ausência como "sem fontes estruturadas", nunca como erro.
 */
export interface Indicator extends DomainEntity {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly name: string;
  readonly category: FinancialStateCategory;
  readonly unit: IndicatorUnit;
  readonly period: Period;
  readonly result: IndicatorResult;
  readonly formula: string;
  readonly sourceRecordIds?: readonly string[];
}
