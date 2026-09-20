import type {
  Evidence,
  EvidenceAggregate,
  FinancialModelAggregate,
  IndicatorsAggregate,
  Period,
} from "@/efos/domain";
import {
  EVIDENCE_ENGINE_CONSTANTS,
  periodOf,
  TEMPORAL_METRIC_DEFINITIONS,
  type TemporalMetricDefinition,
  type TemporalSnapshot,
} from "@/efos/engines/evidence";

import type { HistoricalExecution } from "../history";
import type {
  FinancialEpisodeDeterminabilityReason,
  FinancialEpisodeStateResult,
} from "./FinancialEpisodeState";

/**
 * Mission 171 — Implement Derived Financial Episode State.
 *
 * Deriva o estado de episódio financeiro de UMA métrica (D-087,
 * `TEMPORAL_METRIC_DEFINITIONS`, reaproveitada sem duplicação — ver
 * `efos/engines/evidence/evidence.temporal.builder.ts`) a partir de um
 * histórico de execuções já persistidas (`HistoricalExecution[]`,
 * Mission 085). Função pura: determinística, imutável, sem
 * repositório, sem Supabase, sem IA, sem relógio, nunca muta a
 * entrada, nenhum estado global oculto — mesmo espírito de
 * `deriveKnowledgeState()` (Mission 146, D-078), adaptado onde o
 * domínio diverge (ver README.md, "Diferenças em relação a
 * deriveKnowledgeState()").
 *
 * Identidade do episódio: `(companyId, financialModelId, metricKey)`
 * — sempre metric-specific (Mission 170, Etapa 3; nunca reaberta por
 * esta missão). `episodeKey` = `metricKey`.
 *
 * Cronologia: SEMPRE por período financeiro (`Indicator.period`, via
 * `periodOf()`, já existente desde a Mission 166) — NUNCA por
 * `executedAt` (D-088, corrigido pela Mission 170C). `executedAt`
 * nunca é lido por este arquivo para nenhuma decisão de verdade
 * financeira.
 *
 * Correção arquitetural obrigatória desta missão (ver prompt): a
 * incapacidade de provar fechamento de um episódio NÃO prova
 * automaticamente continuidade. Uma observação adversa atual só é
 * classificada `CONTINUING_DETERIORATION` quando a sequência de
 * observações comparáveis entre o episódio aberto anterior e a
 * observação atual é inteiramente comparável (sem lacuna material);
 * uma lacuna material devolve `NOT_DETERMINABLE`, nunca
 * `NEW_DETERIORATION` nem `CONTINUING_DETERIORATION` por omissão (ver
 * `scanForOpenEpisode()`).
 */

/** Mínimo de observações canônicas necessário para QUALQUER inferência de novidade/continuidade — distinto de `MINIMUM_PERIODS_FOR_SUSTAINED_DETERIORATION` (Mission 166), que governa a PRODUÇÃO de Evidence dentro de uma única execução, nunca a inferência de episódio entre execuções. Com menos de 2 observações canônicas não há nenhum dado anterior para confirmar ausência/presença de um episódio já aberto. */
const MINIMUM_OBSERVATIONS_FOR_EPISODE_DETERMINATION = 2;

type ObservationClassification =
  | "ADVERSE_PRESENT"
  | "FAVORABLE_PRESENT"
  | "NONE_DETECTED"
  | "METRIC_UNAVAILABLE"
  | "MISSING_EXECUTION"
  | "INCOMPATIBLE_FINANCIAL_MODEL";

interface RawObservation {
  readonly executionId: string;
  readonly period: Period;
  readonly classification: ObservationClassification;
  readonly value?: number;
  readonly evidenceId?: string;
}

/**
 * Resultado da extração de UMA execução (Mission 171 Fix). Distingue
 * explicitamente duas razões, antes fundidas em um único `undefined`:
 * `"irrelevant"` — a execução pertence a outra empresa, nunca
 * contribui, nunca é sequer mencionada (fronteira de contaminação,
 * Mission 170C Caso D); `"unpositionable"` — a execução pertence à
 * MESMA empresa mas não é possível extrair um `Period` dela (relatório
 * ausente/malformado ao ponto de não ter `Indicator.period`). A
 * Mission 171 original tratava os dois casos de forma idêntica
 * (exclusão silenciosa), o que podia fabricar continuidade através de
 * uma lacuna real e desconhecida — corrigido: `"unpositionable"` nunca
 * é descartada silenciosamente, torna a derivação inteira
 * `NOT_DETERMINABLE`/`MISSING_EXECUTION` (Etapa 7 do Fix).
 */
type ExtractedExecution =
  | { readonly kind: "irrelevant" }
  | { readonly kind: "unpositionable" }
  | { readonly kind: "observation"; readonly observation: RawObservation };

function declineEvidenceId(financialModelId: string, metricKey: string): string {
  return `${EVIDENCE_ENGINE_CONSTANTS.idPrefix}-${financialModelId}-${metricKey}-sustained-decline`;
}

function improvementEvidenceId(financialModelId: string, metricKey: string): string {
  return `${EVIDENCE_ENGINE_CONSTANTS.idPrefix}-${financialModelId}-${metricKey}-sustained-improvement`;
}

function findEvidenceById(
  evidence: EvidenceAggregate | undefined,
  id: string
): Evidence | undefined {
  return evidence?.evidences.find((item) => item.id === id);
}

function extractIndicatorsAggregate(
  execution: HistoricalExecution
): IndicatorsAggregate | undefined {
  const section = execution.report?.sections.find((s) => s.type === "indicators");
  return section?.type === "indicators" ? section.indicators : undefined;
}

function extractEvidenceAggregate(
  execution: HistoricalExecution
): EvidenceAggregate | undefined {
  const section = execution.report?.sections.find((s) => s.type === "evidence");
  return section?.type === "evidence" ? section.evidence : undefined;
}

function extractFinancialModel(
  execution: HistoricalExecution
): FinancialModelAggregate | undefined {
  return execution.snapshot.execution.financialModel;
}

/**
 * Extrai a observação bruta de UMA execução para UMA definição de
 * métrica. Nunca lê `executedAt` para nenhuma decisão de valor/
 * classificação — apenas `executionId` é preservado, exclusivamente
 * para rastreabilidade/desempate determinístico entre observações já
 * comprovadamente equivalentes (Etapa de canonicalização).
 *
 * `"irrelevant"` — execução de outra empresa, nunca contribui, nunca
 * deixa rastro (fronteira de contaminação, Mission 170C Caso D).
 * `"unpositionable"` — MESMA empresa, mas impossível extrair um
 * `Period` (relatório ausente/malformado ao ponto de não ter
 * `Indicator.period`) — NUNCA descartada silenciosamente (Mission 171
 * Fix, Etapa 7): sua mera presença torna a derivação inteira
 * `NOT_DETERMINABLE`, porque não há como saber se ela preenche (ou não)
 * uma lacuna real na sequência temporal.
 */
function extractRawObservation(
  execution: HistoricalExecution,
  companyId: string,
  financialModelId: string,
  definition: TemporalMetricDefinition
): ExtractedExecution {
  if (execution.companyId !== companyId) return { kind: "irrelevant" };

  const indicators = extractIndicatorsAggregate(execution);
  if (!indicators) return { kind: "unpositionable" };

  const period = periodOf(indicators);
  if (!period) return { kind: "unpositionable" };

  const evidence = extractEvidenceAggregate(execution);
  const financialModel = extractFinancialModel(execution);

  // Fronteira de financial model — mesmo padrão de checagem explícita
  // já usado por `compareExecutions()`/`evidence.validator.ts` (nunca
  // silenciar, mas aqui como observação de LACUNA — não como exclusão
  // sem rastro — porque já temos um período válido para posicioná-la
  // na sequência, Mission 170C Etapa 4 Caso D).
  const financialModelMismatch =
    indicators.financialModelId !== financialModelId ||
    (evidence !== undefined && evidence.financialModelId !== financialModelId) ||
    (evidence !== undefined && evidence.companyId !== companyId);

  if (financialModelMismatch) {
    return {
      kind: "observation",
      observation: {
        executionId: execution.executionId,
        period,
        classification: "INCOMPATIBLE_FINANCIAL_MODEL",
      },
    };
  }

  // Fluxo de Caixa Operacional exige `financialModel.events` — se
  // ausente, esta execução não tem como contribuir um VALOR real para
  // esta métrica especificamente, mas o período em si é válido:
  // representa uma lacuna material (Mission 170C, Etapa 8 — "unknown
  // material gap"), nunca uma exclusão silenciosa.
  const needsFinancialModel = definition.metricKey === "operating-cash-flow";
  if (needsFinancialModel && !financialModel) {
    return {
      kind: "observation",
      observation: { executionId: execution.executionId, period, classification: "MISSING_EXECUTION" },
    };
  }

  const snapshot: TemporalSnapshot = {
    financialModel: financialModel as FinancialModelAggregate,
    indicators,
  };
  const metricValue = definition.extractValue(snapshot);

  if (!metricValue.available) {
    return {
      kind: "observation",
      observation: { executionId: execution.executionId, period, classification: "METRIC_UNAVAILABLE" },
    };
  }

  const declineId = declineEvidenceId(financialModelId, definition.metricKey);
  const improvementId = improvementEvidenceId(financialModelId, definition.metricKey);

  if (findEvidenceById(evidence, declineId)) {
    return {
      kind: "observation",
      observation: {
        executionId: execution.executionId,
        period,
        classification: "ADVERSE_PRESENT",
        value: metricValue.value,
        evidenceId: declineId,
      },
    };
  }

  if (findEvidenceById(evidence, improvementId)) {
    return {
      kind: "observation",
      observation: {
        executionId: execution.executionId,
        period,
        classification: "FAVORABLE_PRESENT",
        value: metricValue.value,
        evidenceId: improvementId,
      },
    };
  }

  return {
    kind: "observation",
    observation: {
      executionId: execution.executionId,
      period,
      classification: "NONE_DETECTED",
      value: metricValue.value,
    },
  };
}

function samePeriod(a: Period, b: Period): boolean {
  return a.startDate === b.startDate && a.endDate === b.endDate;
}

function periodsOverlap(earlier: Period, later: Period): boolean {
  // Mesmo critério já usado por `evidence.validator.ts` para
  // `priorPeriods` (Mission 166) — nunca uma checagem nova: dois
  // períodos distintos se sobrepõem quando o início do mais recente é
  // anterior ao fim do mais antigo.
  return new Date(later.startDate).getTime() < new Date(earlier.endDate).getTime();
}

/** Uma observação canônica (pós-colapso de duplicatas do mesmo período) — mesmo formato de `RawObservation`, nome distinto apenas para deixar explícito, no restante do arquivo, que já passou por canonicalização. */
type CanonicalObservation = RawObservation;

interface CanonicalizationResult {
  readonly observations: readonly CanonicalObservation[];
  readonly conflict: boolean;
}

/**
 * Agrupa observações brutas por período EXATO e resolve duplicatas —
 * Mission 170C, Etapa 2/4. Equivalência é SEMPRE metric-local (mesmo
 * valor extraído + mesma classificação); nunca compara Evidence/
 * Indicators não relacionados, nunca exige igualdade do relatório
 * inteiro. Duplicatas equivalentes colapsam deterministicamente
 * (menor `executionId` lexicográfico — mesmo critério de desempate já
 * usado por `DefaultHistoricalExecutionService`); duplicatas
 * conflitantes marcam `conflict: true` para TODA a derivação (Etapa 5
 * da Mission 170C: um único conflito de período torna a sequência
 * inteira não confiável para fins de continuidade).
 */
function canonicalizeByPeriod(
  raw: readonly RawObservation[]
): CanonicalizationResult {
  const groups = new Map<string, RawObservation[]>();

  for (const obs of raw) {
    const key = `${obs.period.startDate}|${obs.period.endDate}`;
    const group = groups.get(key);
    if (group) group.push(obs);
    else groups.set(key, [obs]);
  }

  const observations: CanonicalObservation[] = [];
  let conflict = false;

  for (const group of groups.values()) {
    if (group.length === 1) {
      observations.push(group[0]);
      continue;
    }

    const [first, ...rest] = group;
    const allEquivalent = rest.every(
      (item) =>
        item.classification === first.classification && item.value === first.value
    );

    if (!allEquivalent) {
      conflict = true;
      continue;
    }

    const canonical = [...group].sort((a, b) =>
      a.executionId.localeCompare(b.executionId)
    )[0];
    observations.push(canonical);
  }

  return { observations, conflict };
}

interface OpenEpisodeScan {
  readonly openBefore: boolean;
  readonly gapBetween: boolean;
  readonly gapReason?: FinancialEpisodeDeterminabilityReason;
  readonly openSinceIndex?: number;
}

/**
 * Varre a sequência canônica, ordenada por período, de trás para
 * frente a partir de (mas excluindo) `currentIndex`, procurando um
 * episódio adverso já aberto. `FAVORABLE_PRESENT`/`NONE_DETECTED`
 * nunca fecham nem indicam abertura — apenas são atravessados (Mission
 * 170C, Etapa 5: uma melhora nunca fecha um episódio sem recuperação
 * comprovada, D-088). `METRIC_UNAVAILABLE`/`MISSING_EXECUTION`/
 * `INCOMPATIBLE_FINANCIAL_MODEL` são lacunas materiais — a varredura
 * para imediatamente e reporta `gapBetween: true`, porque a
 * arquitetura não pode provar o que aconteceu durante a lacuna
 * (correção obrigatória desta missão: incapacidade de provar
 * fechamento não prova continuidade, e o inverso também nunca é
 * assumido).
 */
function scanForOpenEpisode(
  observations: readonly CanonicalObservation[],
  currentIndex: number
): OpenEpisodeScan {
  for (let i = currentIndex - 1; i >= 0; i--) {
    const obs = observations[i];
    if (obs.classification === "ADVERSE_PRESENT") {
      return { openBefore: true, gapBetween: false, openSinceIndex: i };
    }
    if (obs.classification === "METRIC_UNAVAILABLE") {
      return { openBefore: false, gapBetween: true, gapReason: "UNAVAILABLE_METRIC" };
    }
    if (obs.classification === "MISSING_EXECUTION") {
      return { openBefore: false, gapBetween: true, gapReason: "MISSING_EXECUTION" };
    }
    if (obs.classification === "INCOMPATIBLE_FINANCIAL_MODEL") {
      return {
        openBefore: false,
        gapBetween: true,
        gapReason: "INCOMPATIBLE_FINANCIAL_MODEL",
      };
    }
    // FAVORABLE_PRESENT / NONE_DETECTED — atravessa, continua a varredura.
  }
  return { openBefore: false, gapBetween: false };
}

function notDeterminable(
  companyId: string,
  financialModelId: string,
  metricKey: string,
  reason: FinancialEpisodeDeterminabilityReason,
  observationCount: number,
  firstObservedPeriod?: Period,
  lastObservedPeriod?: Period
): FinancialEpisodeStateResult {
  return {
    companyId,
    financialModelId,
    metricKey,
    episodeKey: metricKey,
    state: "NOT_DETERMINABLE",
    determinabilityReason: reason,
    observationCount,
    ...(firstObservedPeriod ? { firstObservedPeriod } : {}),
    ...(lastObservedPeriod ? { lastObservedPeriod } : {}),
  };
}

/**
 * Deriva o estado de episódio financeiro de uma métrica (D-087) para
 * uma empresa/financial model, a partir do histórico de execuções já
 * persistidas. Ver o comentário do arquivo para o contrato completo.
 *
 * @param companyId identidade de empresa do episódio (Mission 170,
 * Etapa 3).
 * @param financialModelId identidade de financial model do episódio —
 * sempre o mesmo por empresa (D-001), mas exigido explicitamente para
 * nunca inferir (mesma disciplina de `EvidenceEngine`/
 * `compareExecutions()`).
 * @param metricKey uma das 8 chaves de `TEMPORAL_METRIC_DEFINITIONS`
 * (D-087) — `"gross-margin"`, `"operating-margin"`, `"net-margin"`,
 * `"current-liquidity"`, `"quick-liquidity"`, `"immediate-liquidity"`,
 * `"average-receipt-period"`, `"operating-cash-flow"`. Uma `metricKey`
 * desconhecida é um erro estrutural do chamador (nunca um problema de
 * qualidade de dado) — lança exceção, mesmo padrão de
 * `compareExecutions()` para `companyId` divergente.
 * @param executions histórico de execuções já persistidas
 * (`HistoricalExecution[]`, Mission 085) — nunca mutado, ordem de
 * entrada irrelevante (a função ordena internamente por período
 * financeiro).
 */
export function deriveFinancialEpisodeState(
  companyId: string,
  financialModelId: string,
  metricKey: string,
  executions: readonly HistoricalExecution[]
): FinancialEpisodeStateResult {
  const definition = TEMPORAL_METRIC_DEFINITIONS.find(
    (d) => d.metricKey === metricKey
  );
  if (!definition) {
    throw new Error(
      `deriveFinancialEpisodeState(): metricKey desconhecida "${metricKey}" — deve ser uma das chaves de TEMPORAL_METRIC_DEFINITIONS (D-087).`
    );
  }

  const extracted = executions.map((execution) =>
    extractRawObservation(execution, companyId, financialModelId, definition)
  );

  // Mission 171 Fix, Etapa 7: uma execução da MESMA empresa que não
  // pode ser posicionada temporalmente (sem `Period` extraível) NUNCA
  // é descartada silenciosamente — sua mera presença significa que a
  // sequência comparável é desconhecida (poderia preencher uma lacuna
  // real entre dois períodos já vistos), e portanto a derivação
  // inteira falha fechada. Precedência: verificada ANTES de qualquer
  // outra checagem — é a falha estrutural mais severa (nem sequer
  // sabemos a forma completa da sequência).
  const hasUnpositionableExecution = extracted.some((e) => e.kind === "unpositionable");
  if (hasUnpositionableExecution) {
    return notDeterminable(companyId, financialModelId, metricKey, "MISSING_EXECUTION", 0);
  }

  const raw = extracted
    .filter((e): e is Extract<ExtractedExecution, { kind: "observation" }> => e.kind === "observation")
    .map((e) => e.observation);

  const { observations, conflict } = canonicalizeByPeriod(raw);

  const sorted = [...observations].sort((a, b) => {
    const startDiff = a.period.startDate.localeCompare(b.period.startDate);
    if (startDiff !== 0) return startDiff;
    return a.period.endDate.localeCompare(b.period.endDate);
  });

  const first = sorted[0]?.period;
  const last = sorted[sorted.length - 1]?.period;

  if (conflict) {
    return notDeterminable(
      companyId,
      financialModelId,
      metricKey,
      "SAME_PERIOD_CONFLICT",
      sorted.length,
      first,
      last
    );
  }

  for (let i = 1; i < sorted.length; i++) {
    if (
      !samePeriod(sorted[i - 1].period, sorted[i].period) &&
      periodsOverlap(sorted[i - 1].period, sorted[i].period)
    ) {
      return notDeterminable(
        companyId,
        financialModelId,
        metricKey,
        "NON_COMPARABLE_PERIOD",
        sorted.length,
        first,
        last
      );
    }
  }

  if (sorted.length === 0) {
    return notDeterminable(companyId, financialModelId, metricKey, "INSUFFICIENT_HISTORY", 0);
  }

  const currentIndex = sorted.length - 1;
  const current = sorted[currentIndex];

  if (current.classification === "METRIC_UNAVAILABLE") {
    return notDeterminable(
      companyId, financialModelId, metricKey, "UNAVAILABLE_METRIC", sorted.length, first, last
    );
  }
  if (current.classification === "MISSING_EXECUTION") {
    return notDeterminable(
      companyId, financialModelId, metricKey, "MISSING_EXECUTION", sorted.length, first, last
    );
  }
  if (current.classification === "INCOMPATIBLE_FINANCIAL_MODEL") {
    return notDeterminable(
      companyId, financialModelId, metricKey, "INCOMPATIBLE_FINANCIAL_MODEL", sorted.length, first, last
    );
  }

  if (current.classification === "FAVORABLE_PRESENT") {
    return {
      companyId,
      financialModelId,
      metricKey,
      episodeKey: metricKey,
      state: "SUSTAINED_IMPROVEMENT",
      currentEvidenceId: current.evidenceId,
      firstObservedPeriod: current.period,
      lastObservedPeriod: current.period,
      observationCount: sorted.length,
    };
  }

  // Mission 171 Fix, Etapa 3/4 — invariante fundamental: o estado
  // ATUAL descreve o que o EFOS pode provar sobre a OBSERVAÇÃO ATUAL,
  // nunca sobre um episódio histórico isolado dela. `NONE_DETECTED`
  // NUNCA produz `CONTINUING_DETERIORATION` — um episódio adverso
  // aberto no passado é um fato distinto de "a observação atual está
  // deteriorando", e a Mission 171 original os confundia (bug
  // corrigido aqui). `NONE_DETECTED` significa apenas "período
  // comparável, sem sinal de declínio nem melhora agora" — nunca
  // saudável, nunca recuperado, nunca "declínio continuando" — sempre
  // `NOT_DETERMINABLE`/`NO_EPISODE_SIGNAL`, independentemente de haver
  // ou não um episódio aberto no histórico (esse fato histórico
  // permanece não fechado internamente, mas nunca é convertido numa
  // afirmação falsa sobre o presente).
  if (current.classification === "NONE_DETECTED") {
    return notDeterminable(
      companyId, financialModelId, metricKey, "NO_EPISODE_SIGNAL", sorted.length, first, last
    );
  }

  // A partir daqui, current.classification === "ADVERSE_PRESENT" —
  // exige histórico suficiente para qualquer inferência de
  // novidade/continuidade (nunca "existe Evidence adversa" =
  // "episódio novo" sem avaliação histórica).
  if (sorted.length < MINIMUM_OBSERVATIONS_FOR_EPISODE_DETERMINATION) {
    return notDeterminable(companyId, financialModelId, metricKey, "INSUFFICIENT_HISTORY", sorted.length, first, last);
  }

  const scan = scanForOpenEpisode(sorted, currentIndex);

  if (scan.gapBetween) {
    return notDeterminable(
      companyId,
      financialModelId,
      metricKey,
      scan.gapReason!,
      sorted.length,
      first,
      last
    );
  }

  if (scan.openBefore) {
    const episodeStart = sorted[scan.openSinceIndex!];
    return {
      companyId,
      financialModelId,
      metricKey,
      episodeKey: metricKey,
      state: "CONTINUING_DETERIORATION",
      currentEvidenceId: current.evidenceId,
      firstObservedPeriod: episodeStart.period,
      lastObservedPeriod: current.period,
      observationCount: sorted.length,
    };
  }

  // Nenhum episódio aberto encontrado, nenhuma lacuna no caminho —
  // observação adversa genuinamente nova.
  return {
    companyId,
    financialModelId,
    metricKey,
    episodeKey: metricKey,
    state: "NEW_DETERIORATION",
    currentEvidenceId: current.evidenceId,
    firstObservedPeriod: current.period,
    lastObservedPeriod: current.period,
    observationCount: sorted.length,
  };
}
