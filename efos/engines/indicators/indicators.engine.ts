import type { IndicatorsAggregate } from "@/efos/domain";
import type {
  EfosEngine,
  EfosEngineContext,
  EfosEngineResult,
} from "@/efos/interfaces";

import {
  calculateIndicators,
  derivePeriod,
  extractFinancialStatementInputs,
  extractFinancialStatementInputSources,
} from "./indicators.calculator";
import {
  INDICATORS_ENGINE_CONSTANTS,
  INDICATORS_ENGINE_MESSAGES,
} from "./indicators.constants";
import { mapCalculatedIndicatorsToAggregate } from "./indicators.mapper";
import type { IndicatorsEngineInput } from "./indicators.types";
import { validateIndicatorsEngineInput } from "./indicators.validator";

/**
 * Indicators Engine — quarto estagio do pipeline oficial do EFOS
 * (efos/types/pipeline.ts; docs/ARCHITECTURE.md, "Responsabilidade de
 * cada Engine"). Recebe o Financial Model de uma empresa
 * (FinancialModelAggregate), valida estruturalmente, calcula
 * indicadores financeiros deterministicos e retorna um
 * IndicatorsAggregate.
 *
 * Nao interpreta resultados, nao gera evidencias, nao produz contexto
 * nem recomendacoes, nao usa IA, nao persiste, nao chama outro Engine.
 * Ver README.md, "Limitacoes".
 */
export class IndicatorsEngine
  implements
    EfosEngine<IndicatorsEngineInput, EfosEngineResult<IndicatorsAggregate>>
{
  readonly id = INDICATORS_ENGINE_CONSTANTS.id;

  // Parametro `context` exigido pelo contrato comum (efos/interfaces),
  // ainda nao utilizado nesta fase (sem persistencia, sem orquestracao
  // de pipeline).
  async execute(
    input: IndicatorsEngineInput,
    context: EfosEngineContext // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<EfosEngineResult<IndicatorsAggregate>> {
    const validation = validateIndicatorsEngineInput(input);

    if (!validation.valid) {
      return {
        status: "failed",
        error: [
          INDICATORS_ENGINE_MESSAGES.invalidInput,
          ...validation.errors,
        ].join(" "),
      };
    }

    const { root, events, resources } = input.financialModel;
    const statementLines = input.financialModel.statementLines ?? [];

    // Mission 192 — Canonical Financial Statement Ingestion & Period
    // Semantics, D-107 (estendida na Mission 192 Closure, D-111, para
    // incluir a data-base de um Balancete via `Resource.asOfDate`):
    // período resolvido ANTES de qualquer cálculo — se nenhum sinal
    // genuíno de cronologia financeira existe (nem `StatementLine.period`
    // de um demonstrativo, nem `Resource.asOfDate` de um Balancete, nem
    // ≥2 `FinancialEvent`s datados), o Engine falha explicitamente em
    // vez de fabricar um período a partir do relógio de execução
    // (antipadrão que a Mission 191 comprovou existir aqui). Mesmo
    // espírito fail-closed já aplicado por `DataEngine`/
    // `FinancialModelEngine` a outras lacunas de dado.
    const period = derivePeriod(events, statementLines, resources);

    if (!period) {
      return {
        status: "failed",
        error: INDICATORS_ENGINE_MESSAGES.periodUnavailable,
      };
    }

    const statementInputs = extractFinancialStatementInputs(input.financialModel);
    const statementInputSources = extractFinancialStatementInputSources(
      input.financialModel
    );
    const calculated = calculateIndicators(statementInputs, statementInputSources);

    const aggregate = mapCalculatedIndicatorsToAggregate(
      input.companyId,
      root.id,
      calculated,
      period
    );

    return {
      status: "completed",
      output: aggregate,
    };
  }
}
