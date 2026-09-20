import type { HistoricalExecution } from "@/efos/application/history";
import type { PipelineExecution } from "@/efos/application/orchestrators";
import type { Period, IndicatorsAggregate } from "@/efos/domain";

/**
 * Mission 176 — Production Executive Diagnosis with Full EFOS
 * Context. Extraída de `executive-diagnosis.actions.ts` (Mission 128)
 * para um módulo puro, testável diretamente — arquivos `"use server"`
 * só podem exportar funções assíncronas (restrição do Next.js Server
 * Actions), então esta lógica pura (síncrona, sem I/O) nunca poderia
 * ser exportada/testada diretamente de dentro da própria Server
 * Action. Mesmo padrão já estabelecido por `buildOutcome.ts`/
 * `buildDiagnosisReview.ts`/`buildDecisionExecutionEvent.ts` neste
 * mesmo diretório: composição pura vive em `modules/decisions/lib/`,
 * a Server Action apenas orquestra I/O e chama estas funções.
 *
 * Deriva o `Period` de uma execução a partir da união (min/max) dos
 * períodos de seus `Indicator`s (D-056) — nenhum período é inventado;
 * quando não há indicadores, não há período derivável (retorna
 * `undefined`, tratado como Financial Truth insuficiente pelo
 * chamador). Mesmo princípio de reagrupamento raso de
 * `buildExecutiveFinancialContext()` (`collectSourceRecordIds()`).
 */
export function derivePeriodFromIndicators(indicators: IndicatorsAggregate): Period | undefined {
  if (indicators.indicators.length === 0) return undefined;

  let startDate = indicators.indicators[0].period.startDate;
  let endDate = indicators.indicators[0].period.endDate;

  for (const indicator of indicators.indicators) {
    if (indicator.period.startDate < startDate) startDate = indicator.period.startDate;
    if (indicator.period.endDate > endDate) endDate = indicator.period.endDate;
  }

  return { startDate, endDate };
}

/**
 * Confirma que a execução escolhida tem todos os agregados que
 * `buildExecutiveFinancialContext()` exige como não-opcionais — nunca
 * inventa um agregado ausente com um valor vazio fabricado (Mission
 * 128, proibição explícita de "diagnóstico parcial").
 */
export function hasCompleteFinancialTruth(
  execution: PipelineExecution
): execution is PipelineExecution &
  Required<Pick<PipelineExecution, "indicators" | "evidence" | "context" | "reasoning" | "recommendation">> {
  return (
    execution.indicators !== undefined &&
    execution.evidence !== undefined &&
    execution.context !== undefined &&
    execution.reasoning !== undefined &&
    execution.recommendation !== undefined
  );
}

function periodKey(p: Period): string {
  return `${p.startDate}|${p.endDate}`;
}

/**
 * Mission 176 Closure — Current Financial Truth Canonicalization.
 *
 * Chaves excluídas de `financialTruthFingerprint()`, nunca comparadas
 * como se fossem conteúdo financeiro: `audit` (timestamp real de
 * cálculo — `createdAt`/`updatedAt`/`version`, `DomainEntity`, nunca
 * idêntico entre duas execuções reais mesmo com valores idênticos),
 * `provenance` (origem/confiança — descreve COMO o dado foi obtido,
 * não O QUE ele afirma), `sourceRecordIds` (proveniência/linhagem de
 * Resource/FinancialEvent — pode divergir entre duas análises
 * genuinamente equivalentes que reprocessam documentos diferentes
 * descrevendo os mesmos valores, ex.: um `documentId` efêmero
 * diferente por upload, Mission 108), `id` (identidade de entidade —
 * já deterministicamente derivada de `financialModelId` + chave de
 * conteúdo em todo o domínio, `buildEvidenceId()`/`buildContextId()`/
 * `buildReasoningId()`/`buildRecommendationId()`, nunca um diferenciador
 * de conteúdo por si só, e explicitamente listada como metadado
 * operacional pela missão). Nenhuma dessas chaves é substância
 * financeira — comparar qualquer uma delas fabricaria conflito ou
 * equivalência a partir de metadado, nunca de fato.
 */
/**
 * Exportado desde a Mission 184 Closure (Exact Scenario Baseline
 * Identity & Decision Consent) — `modules/scenarios/lib/scenarioBaselineIdentity.ts`
 * reaproveita exatamente este conjunto para uma impressão digital
 * ESCOPADA (apenas `FinancialModelAggregate`, o único agregado que os
 * simuladores de Scenario Lab de fato consomem) — nunca um segundo
 * conjunto de exclusão inventado para o mesmo propósito (metadado
 * operacional nunca é substância financeira, seja qual for o agregado
 * sendo comparado).
 */
export const FINANCIAL_TRUTH_FINGERPRINT_EXCLUDED_KEYS = new Set([
  "id",
  "audit",
  "provenance",
  "sourceRecordIds",
]);

/**
 * Impressão digital do conteúdo financeiro de uma execução — os
 * MESMOS 6 agregados que `buildExecutiveFinancialContext()` já exige
 * (`hasCompleteFinancialTruth()`), nunca um novo framework de
 * deep-equality genérico: apenas `JSON.stringify()` com um replacer
 * que remove metadado operacional (ver `FINANCIAL_TRUTH_FINGERPRINT_EXCLUDED_KEYS`)
 * em qualquer profundidade de aninhamento.
 *
 * Para `buildCanonicalPriorPeriods()`/`financialValueFingerprint()`
 * (Mission 174/175R), `{indicator.name, indicator.result}` já basta —
 * a Evidence temporal só precisa saber SE a métrica está piorando ou
 * melhorando, calculado exclusivamente a partir de `Indicator.result`.
 * Para Executive Diagnosis, a IA consome os 6 agregados inteiros —
 * `FinancialModel`/`Indicators`/`Evidence`/`Context`/`Reasoning`/
 * `Recommendation` — logo a equivalência aqui precisa necessariamente
 * cobrir todos os 6: duas execuções podem ter `Indicators` idênticos
 * mas produzir `Evidence` diferente (ex.: `priorPeriods` disponível em
 * momentos distintos da persistência, Mission 174/175R) — checar
 * apenas Indicators seria insuficiente para provar que a IA receberia
 * exatamente a mesma verdade financeira.
 *
 * **Limitação conhecida, aceita deliberadamente (nunca escondida)**:
 * esta comparação é sensível à ORDEM dos arrays dentro de cada
 * agregado (`financialModel.resources`/`.events`,
 * `indicators.indicators`, `evidence.evidences`, etc.) — duas
 * execuções financeiramente idênticas, mas cujos registros de origem
 * foram processados em ordem diferente, poderiam ser incorretamente
 * classificadas como CONFLICTING em vez de EQUIVALENT. Esta é uma
 * limitação que erra para o lado SEGURO (fail-closed): o pior caso é
 * relatar ambiguidade onde na verdade havia equivalência — nunca o
 * inverso (nunca declara equivalência onde há divergência real).
 * Consistente com a disciplina fail-closed já estabelecida por D-088/
 * D-089/D-090 ao longo de toda esta série de missões.
 */
function financialTruthFingerprint(
  execution: PipelineExecution &
    Required<Pick<PipelineExecution, "indicators" | "evidence" | "context" | "reasoning" | "recommendation">>
): string {
  return JSON.stringify(
    {
      financialModel: execution.financialModel,
      indicators: execution.indicators,
      evidence: execution.evidence,
      context: execution.context,
      reasoning: execution.reasoning,
      recommendation: execution.recommendation,
    },
    (key, value) => (FINANCIAL_TRUTH_FINGERPRINT_EXCLUDED_KEYS.has(key) ? undefined : value)
  );
}

export type CurrentFinancialExecutionResolution =
  | { readonly outcome: "resolved"; readonly execution: HistoricalExecution }
  | { readonly outcome: "no-history" }
  | { readonly outcome: "ambiguous"; readonly reason: "malformed" | "conflicting" | "unpositionable" };

/**
 * Mission 176 Final Closure — Unpositionable Financial Truth.
 *
 * Melhor sinal de identidade de `FinancialModel` disponível numa
 * execução que pode nem ter `indicators`/período extraível —
 * `indicators.financialModelId` quando `indicators` existe (mesmo sem
 * período, ex.: `indicators.indicators` vazio), senão
 * `financialModel.root.id` (Financial Model Engine já rodou, mas
 * Indicators Engine não). `undefined` significa "nenhum sinal de
 * identidade de modelo disponível nesta execução" — nunca inferido de
 * outro campo.
 */
function financialModelIdSignal(execution: PipelineExecution): string | undefined {
  return execution.indicators?.financialModelId ?? execution.financialModel?.root.id;
}

/**
 * Mission 176 Closure — Current Financial Truth Canonicalization.
 *
 * Substitui `pickCurrentExecution()` (Mission 176), que corrigia a
 * cronologia (`Period`, nunca `executedAt`) mas resolvia EMPATES de
 * mesmo período por desempate de `executionId` — identidade de
 * execução pode fornecer ordenação determinística, mas NUNCA pode
 * estabelecer autoridade financeira: duas execuções do MESMO período
 * com valores MATERIALMENTE diferentes eram silenciosamente
 * resolvidas para uma delas, entregando à IA um "fato" que não era,
 * na verdade, defensável.
 *
 * Duas perguntas SEPARADAS, nunca fundidas:
 *
 * **Pergunta A — qual é o período financeiro mais recente?** Resolvida
 * inteiramente por cronologia (`Period.startDate`/`endDate`, via
 * `derivePeriodFromIndicators()`) — execuções sem período extraível
 * (sem `indicators`, ou `indicators.indicators` vazio) nunca competem.
 *
 * **Pergunta B — existe UMA verdade financeira defensável para esse
 * período?** Nunca assumida. Todas as execuções que compartilham o
 * período mais recente são classificadas:
 *
 * - **malformed** — alguma execução do grupo não tem os 6 agregados
 *   completos (`hasCompleteFinancialTruth()`) — não pode contribuir
 *   `financialTruthFingerprint()` algum. Desconhecido ≠ equivalente:
 *   fail closed, NUNCA escolhe silenciosamente a execução irmã bem-
 *   formada.
 * - **conflicting** — todas completas, mas `financialTruthFingerprint()`
 *   diverge entre pelo menos duas — conflito financeiro real e
 *   MATERIAL. Fail closed — nunca resolvido por `executionId`/
 *   `executedAt`/ordem de array/pedir para a IA decidir.
 * - **equivalent** (grupo de tamanho 1, ou tamanho >1 com fingerprint
 *   idêntico) — SOMENTE agora, DEPOIS de provada a equivalência, um
 *   desempate operacional determinístico (`executionId`
 *   lexicograficamente menor) escolhe um representante da classe já
 *   comprovadamente equivalente — o desempate nunca estabelece
 *   equivalência ou autoridade financeira, apenas escolhe qual objeto
 *   concreto representa a classe.
 *
 * Um conflito/malformação em um período MAIS ANTIGO (não o mais
 * recente) nunca bloqueia a resolução da verdade atual — isso é
 * exclusivamente responsabilidade de `deriveFinancialEpisodeState()`
 * (Mission 171/171 Fix), que recebe o histórico completo e pode
 * legitimamente produzir `NOT_DETERMINABLE`/`SAME_PERIOD_CONFLICT`
 * para esse período mais antigo — nunca impedindo o diagnóstico do
 * período atual, genuinamente não-ambíguo.
 *
 * **Mission 176 Final Closure — Unpositionable Financial Truth**:
 * uma execução da MESMA empresa sem período financeiro extraível
 * (`indicators` ausente, ou `indicators.indicators` vazio — ex.:
 * pipeline interrompido entre o Financial Model Engine e o Indicators
 * Engine) NUNCA pode ser tratada como estruturalmente inerte — sua
 * ausência de período não prova que ela é mais antiga que qualquer
 * outra execução; pode, na verdade, representar um período MAIS
 * recente que simplesmente não terminou de ser calculado. Ignorá-la
 * silenciosamente permitiria que uma execução completa, mas
 * genuinamente mais antiga, fosse escolhida como "atual" só porque a
 * candidata realmente mais recente ainda não tem período extraível —
 * o mesmo tipo de fabricação de continuidade que D-088/D-090 já
 * proíbem para Evidence temporal, agora fechado aqui para a verdade
 * financeira atual.
 *
 * Classificação de cada execução da MESMA empresa sem período
 * extraível, usando `financialModelIdSignal()`:
 *
 * - **Nenhum sinal de modelo disponível** (nem `indicators`, nem
 *   `financialModel`) — identidade genuinamente ambígua. Nunca
 *   assumida como irrelevante: fail closed
 *   (`ambiguous`/`unpositionable`).
 * - **Sinal de modelo presente, mas divergente** de todo candidato
 *   POSICIONADO já encontrado — prova POSITIVA (nunca suposição) de
 *   que esta execução pertence a um `FinancialModel` diferente do que
 *   está sendo avaliado; D-001 garante um único `FinancialModel` por
 *   empresa, então essa divergência prova que a execução não pode
 *   descrever a verdade financeira ATUAL desta empresa/modelo — segura
 *   para excluir (mesmo princípio de IRRELEVANT por fronteira de
 *   empresa, agora por fronteira de modelo, ambos comprovados, nunca
 *   assumidos).
 * - **Sinal de modelo ausente, ou nenhum candidato posicionado ainda
 *   existe para comparar** — não há como provar que é de outro modelo:
 *   fail closed (`ambiguous`/`unpositionable`) — "identidade ambígua"
 *   nunca vira exclusão silenciosa (Seção 3/6 da missão de fechamento
 *   final).
 *
 * A presença de QUALQUER execução relevante fail-closed nesta
 * categoria interrompe a resolução IMEDIATAMENTE — antes mesmo de
 * calcular "qual é o período mais recente" entre os candidatos
 * posicionados, porque essa própria pergunta deixa de ser confiável
 * quando uma execução relevante e não-posicionável pode representar
 * um período ainda mais recente.
 */
export function resolveCurrentFinancialExecution(
  companyId: string,
  history: readonly HistoricalExecution[]
): CurrentFinancialExecutionResolution {
  const relevant = history.filter((h) => h.companyId === companyId);

  const withPeriod: { historicalExecution: HistoricalExecution; period: Period }[] = [];
  const unpositionable: HistoricalExecution[] = [];

  for (const h of relevant) {
    const indicators = h.snapshot.execution.indicators;
    const period = indicators ? derivePeriodFromIndicators(indicators) : undefined;
    if (period) {
      withPeriod.push({ historicalExecution: h, period });
    } else {
      unpositionable.push(h);
    }
  }

  if (unpositionable.length > 0) {
    // Modelos já comprovados pelos candidatos POSICIONADOS — nunca
    // reconstruídos/adivinhados; apenas o que já foi genuinamente
    // observado neste histórico real.
    const positionedModelIds = new Set(
      withPeriod
        .map((entry) => financialModelIdSignal(entry.historicalExecution.snapshot.execution))
        .filter((id): id is string => id !== undefined)
    );

    for (const candidate of unpositionable) {
      const signal = financialModelIdSignal(candidate.snapshot.execution);
      const provablyDifferentModel =
        signal !== undefined && positionedModelIds.size > 0 && !positionedModelIds.has(signal);

      if (!provablyDifferentModel) {
        return { outcome: "ambiguous", reason: "unpositionable" };
      }
    }
  }

  if (withPeriod.length === 0) {
    return { outcome: "no-history" };
  }

  const latestPeriod = withPeriod.reduce((latest, entry) => {
    const startDiff = entry.period.startDate.localeCompare(latest.startDate);
    if (startDiff !== 0) return startDiff > 0 ? entry.period : latest;
    const endDiff = entry.period.endDate.localeCompare(latest.endDate);
    return endDiff > 0 ? entry.period : latest;
  }, withPeriod[0].period);

  const latestPeriodGroup = withPeriod
    .filter((entry) => periodKey(entry.period) === periodKey(latestPeriod))
    .map((entry) => entry.historicalExecution);

  const malformed = latestPeriodGroup.some(
    (h) => !hasCompleteFinancialTruth(h.snapshot.execution)
  );
  if (malformed) {
    return { outcome: "ambiguous", reason: "malformed" };
  }

  const completeGroup = latestPeriodGroup as ReadonlyArray<
    HistoricalExecution & {
      snapshot: { execution: PipelineExecution & Required<Pick<PipelineExecution, "indicators" | "evidence" | "context" | "reasoning" | "recommendation">> };
    }
  >;

  if (completeGroup.length === 1) {
    return { outcome: "resolved", execution: completeGroup[0] };
  }

  const [first, ...rest] = completeGroup;
  const firstFingerprint = financialTruthFingerprint(first.snapshot.execution);
  const allEquivalent = rest.every(
    (candidate) => financialTruthFingerprint(candidate.snapshot.execution) === firstFingerprint
  );

  if (!allEquivalent) {
    return { outcome: "ambiguous", reason: "conflicting" };
  }

  // Já provada a equivalência financeira do grupo inteiro — o
  // desempate abaixo escolhe apenas qual objeto concreto representa a
  // classe, nunca decide o que é verdade.
  const representative = [...completeGroup].sort((a, b) =>
    a.executionId.localeCompare(b.executionId)
  )[0];

  return { outcome: "resolved", execution: representative };
}
