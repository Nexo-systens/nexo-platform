import type {
  AuditTrail,
  Indicator,
  IndicatorsAggregate,
  Period,
  Provenance,
} from "@/efos/domain";

import {
  INDICATOR_DEFINITIONS,
  INDICATORS_ENGINE_CONSTANTS,
} from "./indicators.constants";
import type { CalculatedIndicator } from "./indicators.types";

/**
 * Mapper do Indicators Engine. Responsavel exclusivamente por
 * transformar os resultados brutos da calculadora
 * (indicators.calculator.ts) no contrato oficial de saida
 * (IndicatorsAggregate, efos/domain) — nenhuma formula, nenhuma
 * classificacao de dado financeiro acontece aqui.
 */

function buildProvenance(source: string): Provenance {
  // Confianca fixa nesta fase: o Engine calcula deterministicamente a
  // partir do que recebeu, nao avalia a qualidade do dado de entrada.
  return { source, confidence: { value: 100, level: "very_high" } };
}

function buildAuditTrail(timestamp: string): AuditTrail {
  return { createdAt: timestamp, updatedAt: timestamp, version: 1 };
}

function buildIndicatorId(financialModelId: string, slug: string): string {
  return `${INDICATORS_ENGINE_CONSTANTS.idPrefix}-${financialModelId}-${slug}`;
}

export function mapCalculatedIndicatorsToAggregate(
  companyId: string,
  financialModelId: string,
  calculated: Record<string, CalculatedIndicator>,
  period: Period
): IndicatorsAggregate {
  const timestamp = new Date().toISOString();
  const provenance = buildProvenance(INDICATORS_ENGINE_CONSTANTS.name);
  const audit = buildAuditTrail(timestamp);

  const indicators: Indicator[] = (
    Object.keys(INDICATOR_DEFINITIONS) as Array<
      keyof typeof INDICATOR_DEFINITIONS
    >
  ).map((key) => {
    const definition = INDICATOR_DEFINITIONS[key];
    const calculatedIndicator = calculated[key];

    return {
      id: buildIndicatorId(financialModelId, definition.slug),
      companyId,
      financialModelId,
      name: definition.name,
      category: definition.category,
      unit: definition.unit,
      period,
      result: calculatedIndicator.result,
      formula: calculatedIndicator.formula,
      sourceRecordIds: calculatedIndicator.sourceRecordIds,
      provenance,
      audit,
    };
  });

  return { companyId, financialModelId, indicators };
}
