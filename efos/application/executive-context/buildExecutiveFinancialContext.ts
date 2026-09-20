import type {
  ContextAggregate,
  EvidenceAggregate,
  IndicatorsAggregate,
  Period,
  ReasoningAggregate,
  RecommendationAggregate,
} from "@/efos/domain";
import type { ExecutionComparison, HistoricalExecution } from "@/efos/application/history";
import { buildFinancialEpisodeIntelligence } from "@/efos/application/financial-episodes";

import type {
  ExecutiveFinancialContext,
  ExecutiveUnknown,
} from "./ExecutiveFinancialContext";

/**
 * Um `ExecutiveUnknown` por `Indicator` com `result.status ===
 * "unavailable"` — nunca inventa um motivo específico
 * (`MISSING_DATA`/`INSUFFICIENT_DATA`/etc.): usa sempre
 * `"UNKNOWN_CAUSE"`, porque `IndicatorResult` (D-052) não carrega essa
 * distinção como dado (ver `ExecutiveFinancialContext.ts`,
 * `UnknownReason`). `impact` é composto apenas do próprio nome do
 * indicador — nunca uma frase interpretativa sobre a gravidade.
 */
function buildUnknowns(indicators: IndicatorsAggregate): readonly ExecutiveUnknown[] {
  return indicators.indicators
    .filter((indicator) => indicator.result.status === "unavailable")
    .map((indicator) => ({
      subject: indicator.name,
      reason: "UNKNOWN_CAUSE" as const,
      impact: `${indicator.name} indisponível nesta execução.`,
    }));
}

/**
 * União (sem duplicatas) de todo `Indicator.sourceRecordIds` presente
 * em `indicators` (D-056) — apenas reagrupamento, nenhum `id` novo é
 * criado ou inferido.
 */
function collectSourceRecordIds(indicators: IndicatorsAggregate): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const indicator of indicators.indicators) {
    for (const id of indicator.sourceRecordIds ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
  }

  return result;
}

/**
 * Constrói o `ExecutiveFinancialContext` (Mission 114) a partir dos
 * agregados já produzidos por uma única execução do pipeline oficial
 * do EFOS — composição pura, nunca recálculo: cada campo é uma
 * referência direta ou um reagrupamento raso de dado já existente.
 * Nenhuma fórmula financeira, nenhuma nova Evidence/Context/
 * Recommendation Rule, nenhuma detecção de conflito (Etapa 8 — ver
 * `ExecutiveConflict`, `conflicts` é sempre `[]` aqui).
 *
 * **Company boundary (Mission 162 — Company-Boundary Integrity
 * Validation, Etapa 3)**: cada Engine individual (`IndicatorsEngine`/
 * `FinancialKnowledgeGraphEngine`/`EvidenceEngine`/`ContextEngine`/
 * `ReasoningEngine`/`RecommendationEngine`) já valida rigorosamente,
 * na própria entrada, que todo agregado recebido pertence ao mesmo
 * `companyId` E ao mesmo `financialModelId` (defesa em profundidade já
 * existente desde as Missions iniciais de cada Engine — confirmado por
 * auditoria de código-fonte). Esta função, porém, é uma composição pura
 * de Application Layer — nunca uma Engine — e por isso nunca passava
 * pelo mesmo portão: um chamador poderia, por engano, montar um
 * `ExecutiveFinancialContext` combinando agregados de EXECUÇÕES
 * diferentes (empresas diferentes), mesmo que cada agregado individual
 * já tivesse sido validado na sua própria Engine de origem. Mesmo
 * precedente exato de `compareExecutions()` (D-045/D-046,
 * `efos/application/history/`): uma função pura de composição que já
 * lança erro explícito quando dois agregados de empresas diferentes são
 * combinados. `comparison` é opcional — omitido (`historicalIntelligence`
 * ausente) quando não há execução anterior para comparar; nunca uma
 * comparação fabricada.
 *
 * **`executions?`/`currentExecutionId?` (Mission 172 — Integrate
 * Financial Episode Intelligence into ExecutiveFinancialContext,
 * corrigido pela Mission 172 Fix — Episode Composition Input
 * Contract)**: histórico de `HistoricalExecution[]` já persistido
 * (Mission 085), usado para derivar `financialEpisodes` via
 * `buildFinancialEpisodeIntelligence()` (Mission 171/171 Fix —
 * reaproveitada integralmente, nunca uma segunda derivação). Mesmo
 * princípio de `comparison?`: esta função NUNCA busca seu próprio
 * histórico.
 *
 * **Contrato de janela histórica segura (Mission 172 Fix, D-089)**:
 * "o chamador decide o que passar" NUNCA significou "qualquer
 * subconjunto de histórico é válido". Truncar arbitrariamente o
 * histórico comparável pode inverter a classificação de episódio —
 * ex.: `adverso→adverso→melhora→melhora→adverso`, se o chamador
 * cortar as duas primeiras observações adversas, o resultado muda de
 * `CONTINUING_DETERIORATION` (correto) para `NEW_DETERIORATION`
 * (falso — o episódio já estava aberto, a informação só foi
 * descartada). Como não existe hoje nenhum sinal de domínio que prove
 * onde um episódio pode começar com segurança (D-088: recuperação/
 * fechamento de episódio não é comprovável), a única política segura
 * é: **`executions` deve conter TODAS as execuções comparáveis do
 * `FinancialModel` atual** — o chamador pode (e deve) excluir
 * execuções de outra empresa/`financialModelId` (irrelevantes por
 * definição), mas NUNCA truncar arbitrariamente o histórico
 * comparável restante. Uma execução malformada antiga dentro desse
 * histórico comparável pode legitimamente produzir
 * `NOT_DETERMINABLE`/`MISSING_EXECUTION` para uma métrica — isso é
 * conservador e semanticamente honesto (Mission 171 Fix), nunca uma
 * razão para descartá-la silenciosamente. Esta função não pode
 * verificar em runtime que o chamador de fato forneceu TODO o
 * histórico comparável (não tem acesso ao repositório) — esta é uma
 * obrigação contratual do chamador, documentada aqui e em D-089,
 * nunca imposta estruturalmente por esta camada pura.
 *
 * Omitido quando `executions` não é fornecido — `financialEpisodes`
 * simplesmente ausente (`undefined`), nunca um array vazio fabricado
 * nem uma derivação forçada — distinto, por design, de
 * `financialEpisodes` conter entradas `NOT_DETERMINABLE` (que
 * significa que a derivação rodou e não pôde defender um estado,
 * nunca "não rodou").
 *
 * **Identidade exata da execução atual (Mission 172 Fix, Etapas 6/7 —
 * substitui a checagem por `Period` da Mission 172 original, que não
 * distinguia duas execuções reanalisando o mesmo período,
 * legitimamente possível desde a Mission 171)**: quando `executions`
 * é fornecido, `currentExecutionId` também deve ser — o `executionId`
 * (`HistoricalExecution.executionId`, identidade canônica já
 * existente desde a Mission 085) da execução que efetivamente produziu
 * os agregados `indicators`/`evidence`/`context`/`reasoning`/
 * `recommendation` recebidos por esta chamada. Exatamente UMA
 * execução em `executions` deve ter esse `executionId` — zero
 * correspondências ou mais de uma são rejeitadas explicitamente.
 * Consistência adicional (Etapa 9 — nunca deep equality frágil):
 * a execução identificada deve descrever o MESMO `Period` deste
 * contexto — caso contrário, `currentExecutionId` aponta para uma
 * execução que não corresponde à mesma observação financeira que os
 * demais agregados descrevem.
 */
export function buildExecutiveFinancialContext(
  companyId: string,
  period: Period,
  indicators: IndicatorsAggregate,
  evidence: EvidenceAggregate,
  context: ContextAggregate,
  reasoning: ReasoningAggregate,
  recommendation: RecommendationAggregate,
  comparison?: ExecutionComparison,
  executions?: readonly HistoricalExecution[],
  currentExecutionId?: string
): ExecutiveFinancialContext {
  const mismatched = [
    ["indicators", indicators.companyId],
    ["evidence", evidence.companyId],
    ["context", context.companyId],
    ["reasoning", reasoning.companyId],
    ["recommendation", recommendation.companyId],
  ].filter(([, aggregateCompanyId]) => aggregateCompanyId !== companyId);

  if (mismatched.length > 0) {
    throw new Error(
      `buildExecutiveFinancialContext(): companyId divergente entre agregados — "${companyId}" esperado, mas ${mismatched.map(([label, id]) => `${label}="${id}"`).join(", ")} — nunca combinar agregados de empresas diferentes num único ExecutiveFinancialContext.`
    );
  }

  if (executions && executions.length > 0) {
    if (!currentExecutionId) {
      throw new Error(
        `buildExecutiveFinancialContext(): "executions" foi fornecido sem "currentExecutionId" — a execução atual deve ser identificada explicitamente por executionId (Mission 172 Fix), nunca inferida apenas por Period (duas execuções podem legitimamente reanalisar o mesmo período, Mission 171).`
      );
    }

    const matches = executions.filter((execution) => execution.executionId === currentExecutionId);

    if (matches.length === 0) {
      throw new Error(
        `buildExecutiveFinancialContext(): currentExecutionId "${currentExecutionId}" não corresponde a nenhuma execução em "executions" — a execução atual deve estar presente exatamente uma vez.`
      );
    }
    if (matches.length > 1) {
      throw new Error(
        `buildExecutiveFinancialContext(): currentExecutionId "${currentExecutionId}" corresponde a mais de uma execução em "executions" — executionId deve ser único; a execução atual deve estar presente exatamente uma vez.`
      );
    }

    const currentExecution = matches[0];

    if (currentExecution.companyId !== companyId) {
      throw new Error(
        `buildExecutiveFinancialContext(): a execução identificada por currentExecutionId ("${currentExecutionId}") pertence à empresa "${currentExecution.companyId}", divergente do companyId deste contexto ("${companyId}") — nunca usar a identidade de execução de uma empresa para representar a observação atual de outra.`
      );
    }

    const indicatorsSection = currentExecution.report?.sections.find((s) => s.type === "indicators");
    const currentExecutionIndicators = indicatorsSection?.type === "indicators" ? indicatorsSection.indicators : undefined;
    const currentExecutionPeriod = currentExecutionIndicators?.indicators[0]?.period;

    if (currentExecutionIndicators && currentExecutionIndicators.financialModelId !== indicators.financialModelId) {
      throw new Error(
        `buildExecutiveFinancialContext(): a execução identificada por currentExecutionId ("${currentExecutionId}") pertence ao financialModelId "${currentExecutionIndicators.financialModelId}", divergente do financialModelId deste contexto ("${indicators.financialModelId}").`
      );
    }

    if (currentExecutionPeriod?.startDate !== period.startDate || currentExecutionPeriod?.endDate !== period.endDate) {
      throw new Error(
        `buildExecutiveFinancialContext(): a execução identificada por currentExecutionId ("${currentExecutionId}") descreve o período ${currentExecutionPeriod ? `${currentExecutionPeriod.startDate} a ${currentExecutionPeriod.endDate}` : "indisponível"}, divergente do período deste contexto (${period.startDate} a ${period.endDate}) — a execução atual em "executions" deve corresponder exatamente à mesma observação financeira que os demais agregados deste contexto descrevem.`
      );
    }
  }

  return {
    identity: { companyId },
    period,
    financialTruth: { indicators: indicators.indicators },
    evidence: evidence.evidences,
    deterministicIntelligence: {
      contexts: context.contexts,
      reasoning: reasoning.reasonings,
      recommendations: recommendation.recommendations,
    },
    ...(comparison ? { historicalIntelligence: { comparison } } : {}),
    sourceTraceability: {
      sourceRecordIds: collectSourceRecordIds(indicators),
    },
    unknowns: buildUnknowns(indicators),
    conflicts: [],
    ...(executions
      ? { financialEpisodes: buildFinancialEpisodeIntelligence(companyId, indicators.financialModelId, executions) }
      : {}),
  };
}
