import type { FinancialModelAggregate, Period } from "@/efos/domain";
import { FINANCIAL_TRUTH_FINGERPRINT_EXCLUDED_KEYS } from "@/modules/decisions/lib/selectCurrentFinancialExecution";
import { periodsEqual } from "@/efos/application/scenario-simulation";

/**
 * Mission 184 Closure — Exact Scenario Baseline Identity & Decision
 * Consent.
 *
 * **O problema que esta missão corrige**: Mission 184 tratava
 * `periodsEqual()` como se fosse prova suficiente de que "a verdade
 * financeira usada para formalizar uma Decision é a mesma que o
 * executivo avaliou". D-088 (correção da Mission 170C) já estabelece,
 * para Financial Episode, o princípio oposto: **mesmo `Period` NUNCA
 * implica mesma verdade financeira** — duas execuções podem
 * reprocessar o mesmo período com conteúdo materialmente diferente.
 * `resolveCurrentFinancialExecution()` (Mission 176 Closure/Final
 * Closure) já resolve isso para "qual é a verdade financeira atual",
 * via `financialTruthFingerprint()` sobre os 6 agregados — e
 * `resolveScenarioBaseline()` (`scenario-simulation.actions.ts`) já
 * reaproveita essa função inteira, o que significa que uma execução
 * conflitante para o mesmo período JÁ era rejeitada (`ambiguous`/
 * `"conflicting"`) ANTES mesmo do `periodsEqual()` de Mission 184 ser
 * avaliado (ver `test-mission184closure-scenario-baseline-identity.ts`,
 * Parte A, que prova isso empiricamente sobre o código real, nunca por
 * suposição).
 *
 * **Por que, mesmo assim, esta identidade explícita é adicionada**
 * (Seção 7/12/13/17 da missão de fechamento): (1) o fingerprint de 6
 * agregados de Mission 176 é deliberadamente amplo demais para
 * Scenario Lab — inclui `evidence`/`context`/`reasoning`/`recommendation`,
 * nenhum dos quais os simuladores de cenário (`runSingleScenario()`)
 * de fato consomem; reaproveitá-lo diretamente produziria falsa
 * obsolescência sempre que qualquer um desses agregados mudasse por um
 * motivo alheio ao `FinancialModel` (Seção 27 — "minimize false
 * staleness"). Esta identidade é ESCOPADA apenas ao agregado que os
 * simuladores realmente leem. (2) Torna a identidade um conceito
 * tipado e auditável de primeira classe — nunca implícito na
 * combinação acidental de duas funções nunca desenhadas juntas. (3)
 * Defesa em profundidade: se a semântica de conflito de
 * `resolveCurrentFinancialExecution()` for revisada no futuro (fora do
 * controle desta missão), esta identidade independente continua
 * detectando divergência de conteúdo. (4) Permite que o snapshot
 * (`ScenarioDecisionContext.baselineFingerprint`) registre, de forma
 * auditável e permanente, exatamente qual conteúdo financeiro
 * fundamentou a Decision (Seção 17/18).
 *
 * **O que esta identidade NÃO faz** (Seção 5 — "one defensible truth
 * model, not duplicated fingerprint functions"): não substitui nem
 * duplica a detecção de conflito de `resolveCurrentFinancialExecution()`
 * — aquela continua sendo a ÚNICA autoridade sobre "existe uma verdade
 * financeira defensável para o período atual". Esta identidade
 * verifica uma pergunta ORTOGONAL e mais estreita: "o `FinancialModel`
 * que estou prestes a recomputar é EXATAMENTE o mesmo, byte a byte
 * (exceto metadado operacional), que o executivo viu?" — reaproveita o
 * MESMO conjunto de chaves excluídas (`FINANCIAL_TRUTH_FINGERPRINT_EXCLUDED_KEYS`,
 * `id`/`audit`/`provenance`/`sourceRecordIds`), nunca um segundo
 * julgamento divergente sobre o que conta como metadado operacional.
 *
 * **Fronteira de confiança (Seção 12/15)**: o `financialModelFingerprint`
 * é sempre RECOMPUTADO no servidor a partir do `FinancialModel`
 * canônico recém-resolvido — nunca aceito do cliente como autoridade.
 * O valor que o cliente eventualmente ecoa de volta (`ScenarioBaselineIdentity`
 * recebida na resposta de `simulateScenarioAction()`/`compareScenariosAction()`)
 * é tratado apenas como uma REIVINDICAÇÃO sobre o que o executivo viu
 * — comparada, nunca confiada; uma reivindicação adulterada nunca pode
 * conceder autoridade, apenas causar uma rejeição segura (mesma
 * disciplina já estabelecida para `evaluatedPeriod` em Mission 184).
 */
export interface ScenarioBaselineIdentity {
  readonly period: Period;
  readonly financialModelFingerprint: string;
}

/**
 * Impressão digital do `FinancialModelAggregate` — reaproveita o
 * MESMO mecanismo de canonicalização de Mission 176
 * (`JSON.stringify()` com replacer que remove metadado operacional em
 * qualquer profundidade), escopado apenas a este agregado. Mesma
 * limitação conhecida e aceita de `financialTruthFingerprint()`
 * (Mission 176 Closure): sensível à ordem de `resources`/`events` —
 * erra para o lado seguro (fail-closed), nunca declara equivalência
 * onde há divergência real.
 */
export function fingerprintFinancialModel(financialModel: FinancialModelAggregate): string {
  return JSON.stringify(financialModel, (key, value) =>
    FINANCIAL_TRUTH_FINGERPRINT_EXCLUDED_KEYS.has(key) ? undefined : value
  );
}

export function computeScenarioBaselineIdentity(
  financialModel: FinancialModelAggregate,
  period: Period
): ScenarioBaselineIdentity {
  return { period, financialModelFingerprint: fingerprintFinancialModel(financialModel) };
}

/**
 * Prova de identidade EXATA — nunca apenas cronológica (Seção 6/7 da
 * missão de fechamento). `Period` continua necessário (cronologia,
 * apresentação, detecção de drift para um período mais novo — Seção
 * 10), mas sozinho nunca é suficiente; o fingerprint do `FinancialModel`
 * é a prova de conteúdo que falta.
 */
export function scenarioBaselineIdentitiesMatch(
  a: ScenarioBaselineIdentity,
  b: ScenarioBaselineIdentity
): boolean {
  return periodsEqual(a.period, b.period) && a.financialModelFingerprint === b.financialModelFingerprint;
}
