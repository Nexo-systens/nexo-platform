import type { IndicatorsAggregate, Period } from "@/efos/domain";
import { periodOf } from "@/efos/engines/evidence";
import type { EvidenceHistoricalPeriod } from "@/efos/engines/evidence";

import type { HistoricalExecution } from "./HistoricalExecution";

interface CanonicalCandidate {
  readonly executionId: string;
  readonly period: Period;
  readonly financialModelId: string;
  readonly evidenceHistoricalPeriod: EvidenceHistoricalPeriod;
}

/**
 * Mission 175R — Reanalysis Safety & Temporal Degradation Closure,
 * achado adversarial: a comparação de equivalência original usava
 * `JSON.stringify(indicators.indicators)` diretamente — cada
 * `Indicator` carrega `audit.createdAt`/`updatedAt` (DomainEntity,
 * timestamp real de cálculo, `new Date().toISOString()` dentro do
 * Indicators Engine) e `sourceRecordIds` (linhagem/proveniência, não
 * substância financeira) — nenhum dos dois é o mesmo entre duas
 * execuções reais, MESMO quando os valores financeiros são
 * idênticos. Isso tornava "duplicata equivalente colapsa" (Mission
 * 174 Fix) inalcançável em produção genuína — só passava em testes
 * unitários que fixavam `audit` com um literal idêntico ("t") em
 * todas as fixtures, nunca exercitando timestamps reais. Corrigido
 * comparando exclusivamente `{name, result}` de cada `Indicator` —
 * a própria afirmação financeira, nunca proveniência/timestamp de
 * cálculo — ordenado por `name` para nunca depender de ordem de
 * array. Mesmo princípio já usado por `stripNonDeterministicAuditFields()`
 * (harnesses de teste desde a Mission 157), agora como código de
 * PRODUÇÃO: nunca comparar timestamps de auditoria como se fossem
 * conteúdo financeiro.
 */
function financialValueFingerprint(indicators: IndicatorsAggregate): string {
  const values = indicators.indicators
    .map((indicator) => ({ name: indicator.name, result: indicator.result }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return JSON.stringify(values);
}

/**
 * Mission 174 — Production Temporal Evidence Input.
 *
 * Transforma um histórico de `HistoricalExecution[]` já persistido
 * (Mission 085) em `EvidenceHistoricalPeriod[]` (D-087,
 * `efos/engines/evidence`) — a entrada canônica que o `EvidenceEngine`
 * já aceita desde a Mission 166, agora finalmente alimentada por
 * execuções REAIS de produção.
 *
 * **Auditoria obrigatória (Requisito 3/4 da missão), confirmada por
 * leitura de código, não assumida**: `EvidenceHistoricalPeriod`
 * exige exatamente `{financialModel: FinancialModelAggregate,
 * indicators: IndicatorsAggregate}` — nenhum outro dado. Ambos os
 * campos são `DIRECTLY_AVAILABLE`: `HistoricalExecution.snapshot.execution.financialModel`/
 * `.indicators` são os MESMOS objetos que
 * `EFOSPipelineRuntime.execute()` armazenou em `PipelineExecution`
 * (Mission 020B) — persistidos sem transformação por
 * `SupabaseExecutionRepository.save()` (JSONB, `execution: snapshot.execution`
 * completo, nenhum campo removido, confirmado por leitura). Nenhuma
 * reconstrução reversa foi necessária — nunca parseamos
 * `ExecutiveReport`, nunca inferimos um `FinancialModel` anterior a
 * partir de saída posterior, nunca usamos Ground Truth.
 *
 * **Por que esta função existe, em vez de repassar `history` direto
 * ao `EvidenceEngine` (Requisito 10 — "critical boundary")**: o
 * validador já existente de `priorPeriods`
 * (`efos/engines/evidence/evidence.validator.ts`, Mission 166) REJEITA
 * a chamada INTEIRA do Engine se encontrar períodos duplicados,
 * fora de ordem, ou sobrepostos — ao contrário da Mission
 * 171/`deriveFinancialEpisodeState()`, que falha fechado POR MÉTRICA,
 * uma falha aqui quebraria a execução INTEIRA do pipeline (Data,
 * Financial Model, Indicators — tudo seria perdido, não apenas
 * Evidence temporal). Esta função pré-resolve exatamente os mesmos 3
 * problemas que aquele validador rejeitaria — nunca reimplementando a
 * semântica de detecção, apenas GARANTINDO que a entrada já está
 * válida antes de chegar lá:
 *
 * 1. **Reanálise de mesmo período (D-088, nunca por `executedAt`)**:
 *    duas execuções históricas para o MESMO período financeiro
 *    colapsam em uma única entrada SOMENTE quando comprovadamente
 *    equivalentes (mesmos `Indicator`s, comparação estrutural
 *    determinística) — nunca escolhidas por `executedAt` mais
 *    recente. Se divergirem materialmente, esta função aborta
 *    (devolve `undefined`) — nunca escolhe um vencedor por
 *    conveniência.
 * 2. **Consistência de `financialModelId`**: todo candidato deve
 *    compartilhar o MESMO `financialModelId` (D-001 garante isso
 *    estruturalmente para a mesma empresa) — uma divergência real
 *    (nunca esperada, mas nunca assumida) também aborta.
 * 3. **Ordem estritamente crescente, sem sobreposição**: mesma
 *    checagem já usada por `evidence.validator.ts`, reaproveitada
 *    aqui como pré-condição, nunca duplicada como regra de negócio
 *    nova.
 *
 * `undefined` significa "não foi possível canonicalizar o histórico
 * com segurança" — o chamador (`DefaultEFOSFacade`) deve então
 * prosseguir SEM Evidence temporal para esta execução (`priorPeriods`
 * omitido), nunca bloquear a análise inteira por causa disso (mesmo
 * princípio de "ausência de histórico não é erro de infraestrutura",
 * estendido para "histórico ambíguo também não é"). Distinto de `[]`,
 * que significa "a busca de histórico teve sucesso e não há, de fato,
 * nenhum período comparável" (nenhuma execução relevante existe, ou
 * toda execução encontrada pertence a outra empresa) — `[]` nunca é
 * devolvido quando existe uma execução RELEVANTE que não pôde ser
 * canonicalizada (ver classificação abaixo). Falha de infraestrutura
 * (`ExecutionRepository`/`HistoricalExecutionService` lançando exceção
 * ANTES desta função ser chamada) permanece uma categoria
 * estruturalmente distinta — propaga como exceção real, nunca vira
 * `undefined` aqui (esta função nunca captura exceção alguma; recebe
 * sempre um `history` já resolvido com sucesso).
 *
 * **Classificação de cada execução do histórico (Mission 174 Fix —
 * Fail-Closed Prior-Period Canonicalization), nunca um union público
 * novo — o invariante é comportamental:**
 *
 * - **IRRELEVANT** — `companyId` diferente do alvo. Estruturalmente
 *   nunca pode pertencer ao `FinancialModel` atual (D-001: um único
 *   `FinancialModel` por empresa, id determinístico a partir de
 *   `companyId`) — a fronteira de empresa é `companyId`, o único dado
 *   necessário para essa decisão, nunca `financialModelId`/Period/
 *   `executedAt`/conteúdo de relatório (nunca inferência). Excluída em
 *   silêncio — correta e segura, nunca reportada como indeterminação:
 *   uma execução de outra empresa nunca poderia, em nenhuma hipótese,
 *   fazer parte da sequência comparável desta.
 * - **RELEVANT_BUT_UNUSABLE** — mesma empresa, mas sem `financialModel`/
 *   `indicators` (execução malformada/incompleta) ou sem período
 *   extraível (`periodOf(indicators)` retorna `undefined`). Por D-001,
 *   toda execução da mesma empresa pertence ao MESMO `FinancialModel` —
 *   esta execução É relevante para a sequência comparável, apenas não
 *   pode ser posicionada nela com segurança. **Nunca excluída em
 *   silêncio** (defeito corrigido por esta missão — antes, era
 *   descartada exatamente como se fosse IRRELEVANT, podendo fabricar
 *   uma continuidade temporal falsa através de uma lacuna real e
 *   desconhecida): a presença de QUALQUER execução nesta categoria
 *   torna o resultado inteiro `undefined` — nunca uma escolha de
 *   ignorar a lacuna por conveniência.
 * - **CONFLICTING** — mesma empresa, dado utilizável, mas em conflito
 *   real com outra execução utilizável: `financialModelId` divergente
 *   (nunca esperado sob D-001 para a mesma empresa, mas nunca
 *   assumido — verificado, nunca ignorado), mesmo período financeiro
 *   com `Indicator`s materialmente diferentes, ou sobreposição de
 *   períodos. Também resolve para `undefined` — mesmo princípio de
 *   nunca escolher um vencedor por conveniência, já estabelecido pela
 *   versão original desta função.
 * - **VALID_COMPARABLE** — mesma empresa, `financialModel`/`indicators`
 *   presentes, período extraível, sem conflito. Único grupo que de
 *   fato compõe o resultado.
 */
export function buildCanonicalPriorPeriods(
  companyId: string,
  history: readonly HistoricalExecution[]
): readonly EvidenceHistoricalPeriod[] | undefined {
  const candidates: CanonicalCandidate[] = [];
  let hasUnusableRelevantHistory = false;

  for (const historicalExecution of history) {
    if (historicalExecution.companyId !== companyId) continue; // IRRELEVANT

    const { financialModel, indicators } = historicalExecution.snapshot.execution;
    if (!financialModel || !indicators) {
      hasUnusableRelevantHistory = true; // RELEVANT_BUT_UNUSABLE — sem FinancialModel/Indicators
      continue;
    }

    const period = periodOf(indicators);
    if (!period) {
      hasUnusableRelevantHistory = true; // RELEVANT_BUT_UNUSABLE — período não extraível
      continue;
    }

    candidates.push({
      executionId: historicalExecution.executionId,
      period,
      financialModelId: indicators.financialModelId,
      evidenceHistoricalPeriod: { financialModel, indicators },
    });
  }

  // Fail-closed: uma execução relevante e não-posicionável nunca é
  // silenciosamente ignorada — sua mera existência impede que esta
  // função defenda QUALQUER sequência comparável, pois não há como
  // provar que ela não representa uma lacuna material na sequência
  // (a mesma disciplina que `scanForOpenEpisode()`, Mission 171,
  // já aplica a execuções não-posicionáveis dentro de um episódio).
  if (hasUnusableRelevantHistory) return undefined;

  if (candidates.length === 0) return [];

  const financialModelIds = new Set(candidates.map((c) => c.financialModelId));
  if (financialModelIds.size > 1) return undefined;

  const groups = new Map<string, CanonicalCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.period.startDate}|${candidate.period.endDate}`;
    const group = groups.get(key);
    if (group) group.push(candidate);
    else groups.set(key, [candidate]);
  }

  const canonical: CanonicalCandidate[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      canonical.push(group[0]);
      continue;
    }

    const [first, ...rest] = group;
    const firstFingerprint = financialValueFingerprint(first.evidenceHistoricalPeriod.indicators);
    const allEquivalent = rest.every(
      (candidate) =>
        financialValueFingerprint(candidate.evidenceHistoricalPeriod.indicators) === firstFingerprint
    );

    if (!allEquivalent) return undefined;

    const winner = [...group].sort((a, b) => a.executionId.localeCompare(b.executionId))[0];
    canonical.push(winner);
  }

  canonical.sort((a, b) => {
    const startDiff = a.period.startDate.localeCompare(b.period.startDate);
    if (startDiff !== 0) return startDiff;
    return a.period.endDate.localeCompare(b.period.endDate);
  });

  for (let i = 1; i < canonical.length; i++) {
    const previousEnd = new Date(canonical[i - 1].period.endDate).getTime();
    const currentStart = new Date(canonical[i].period.startDate).getTime();
    if (currentStart < previousEnd) return undefined;
  }

  return canonical.map((c) => c.evidenceHistoricalPeriod);
}
