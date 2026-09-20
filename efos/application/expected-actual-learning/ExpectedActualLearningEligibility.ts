import type {
  ExpectedActualComparisonBundle,
  ExpectedActualMetricComparison,
} from "@/efos/application/scenario-outcome-comparison";
import type { Period, ScenarioType } from "@/efos/domain";

/**
 * Mission 186 — Decision Learning from Expected vs Observed.
 *
 * Ponte entre a Mission 185/185 Closure (`ExpectedActualComparisonBundle`,
 * `basis: "live" | "formal"`) e o Learning Loop já existente (D-072,
 * Mission 140 — `buildLearningRecord()`). Responde apenas UMA pergunta:
 * "esta Decision tem, AGORA, uma comparação Esperado vs. Observado forte
 * o bastante para fundamentar um aprendizado DURÁVEL?" — nunca recalcula
 * a comparação em si (Seção 30 da missão: B → E → O, variância,
 * direcionalidade e seleção de observação continuam uma responsabilidade
 * exclusiva de `efos/application/scenario-outcome-comparison/` e
 * `modules/decisions/lib/resolveExpectedActualComparison.ts`).
 *
 * **Invariante estrutural obrigatório (Seção 5/31 da missão) — nunca
 * `basis: "live"`.** Este módulo NUNCA lê `bundle.live` — apenas
 * `bundle.formal`. Uma comparação `"live"` se atualiza a cada novo
 * período reportado (Mission 185 Closure, D-098); um `LearningRecord`
 * persistido é imutável (D-072) — fundamentar um registro imutável numa
 * fonte que muda sozinha corromperia silenciosamente a própria premissa
 * de auditabilidade do Learning Loop. A garantia não depende de a UI
 * esconder a opção: `ExpectedActualLearningContext.basis` é um literal
 * de tipo único (`"formal"`), portanto nenhum valor `"live"` pode ser
 * atribuído a ele sem um erro de compilação — e `LearningRecord.validator.ts`
 * reafirma a mesma regra em tempo de execução (defesa em profundidade).
 */
export const EXPECTED_ACTUAL_LEARNING_INELIGIBLE_REASONS = [
  "not-scenario-backed",
  "no-formal-observation",
  "formal-not-comparable",
  "no-comparable-metrics",
] as const;
export type ExpectedActualLearningIneligibleReason =
  (typeof EXPECTED_ACTUAL_LEARNING_INELIGIBLE_REASONS)[number];

/**
 * Ancoragem de proveniência (Seção 14 — "FinancialOutcomeObservation
 * Authority"): identifica exatamente qual `FinancialOutcomeObservation`
 * (`financialObservationId`) e qual execução financeira específica
 * (`observationExecutionId`, D-089 — nunca `Period`/`executedAt`
 * sozinhos) fundamentaram esta comparação formal. Nunca substituído
 * depois por "a execução mais recente" — mesmo se uma nova execução do
 * mesmo período chegar (Seção 13/34, prova de restatement).
 */
export interface ExpectedActualLearningContext {
  readonly nature: "expected-actual-snapshot";
  readonly decisionId: string;
  readonly companyId: string;
  readonly scenarioType: ScenarioType;
  /** Sempre `"formal"` — ver comentário do módulo acima. */
  readonly basis: "formal";
  readonly baselinePeriod: Period;
  readonly observedPeriod: Period;
  readonly financialObservationId: string;
  readonly observationExecutionId: string;
  /**
   * Cópia imutável de `ExpectedActualComparison.metrics` no momento em
   * que este contexto foi derivado (Seção 12 — "immutable structured
   * snapshot", Opção A) — nunca uma referência recalculada na leitura.
   * Reaproveita `ExpectedActualMetricComparison` (Mission 185) byte a
   * byte — nunca reimplementado (Seção 30).
   */
  readonly metrics: readonly ExpectedActualMetricComparison[];
  readonly limitations: readonly string[];
  readonly disclaimer: string;
}

export type ExpectedActualLearningEligibility =
  | { readonly eligible: true; readonly context: ExpectedActualLearningContext }
  | {
      readonly eligible: false;
      readonly reason: ExpectedActualLearningIneligibleReason;
      readonly message: string;
    };

const INELIGIBLE_MESSAGES: Record<ExpectedActualLearningIneligibleReason, string> = {
  "not-scenario-backed":
    "Esta decisão não se origina de uma análise de cenário — o aprendizado padrão (evidência humana/observação financeira) continua disponível normalmente.",
  "no-formal-observation":
    "Nenhuma observação financeira formal foi registrada ainda para esta decisão — calcule a observação financeira antes de registrar um aprendizado com contexto Esperado vs. Observado.",
  "formal-not-comparable":
    "A avaliação formal registrada ainda não é comparável — o aprendizado padrão continua disponível, sem o contexto financeiro determinístico.",
  "no-comparable-metrics":
    "Nenhum indicador da meta modelada pôde ser comparado à avaliação formal registrada — o aprendizado padrão continua disponível, sem o contexto financeiro determinístico.",
};

function isComparedMetric(
  metric: ExpectedActualMetricComparison
): metric is Extract<ExpectedActualMetricComparison, { status: "compared" }> {
  return metric.status === "compared";
}

/**
 * `deriveExpectedActualLearningEligibility()` (Mission 186) — função
 * pura, síncrona, determinística. Nunca acessa Repository/banco (quem
 * chama já resolveu o `bundle` via `resolveExpectedActualComparison()`),
 * nunca gera `randomUUID()`/`Date.now()` internamente, nunca é chamada
 * pela IA.
 *
 * **Regras, na ordem exata (Seção 6 — "Learning Eligibility")**:
 * 1. `bundle.formal` ausente → `no-formal-observation` (nenhuma
 *    `FinancialOutcomeObservation` existe ainda para esta Decision —
 *    Mission 139/D-071, ou a execução ancorada não foi localizada no
 *    histórico, Mission 185 Closure).
 * 2. `bundle.formal.outcome === "not-scenario-backed"` →
 *    `not-scenario-backed` (a própria `Decision` não carrega
 *    `ScenarioDecisionContext`, D-094 — caminho normal para Decisions
 *    baseadas em Recommendation, Seção 7 da missão: "Ordinary Decisions
 *    ... must continue using the existing Learning path").
 * 3. `comparison.eligibility !== "comparable"` → `formal-not-comparable`
 *    (`awaiting-observation`/`insufficient-data`/`ambiguous-truth` —
 *    Mission 185/185 Closure já cobrem exaustivamente por que cada um
 *    ocorre; esta função nunca reinterpreta esses 3 casos).
 * 4. Nenhuma métrica com `status === "compared"` → `no-comparable-metrics`
 *    (Seção 17 — "if none are comparable: do not allow an
 *    Expected-vs-Observed Learning to claim financial comparison";
 *    métricas parcialmente disponíveis são aceitas — só o caso "zero"
 *    é rejeitado).
 * 5. Caso contrário → elegível, com um `ExpectedActualLearningContext`
 *    imutável construído inteiramente a partir de campos já calculados
 *    por `buildExpectedActualComparison()`/`resolveExpectedActualComparison()`
 *    — nenhuma aritmética nova.
 *
 * **Nota sobre "Decision em estado de lifecycle apropriado" (Seção 6
 * da missão)**: auditado e confirmado desnecessário como checagem
 * independente aqui — uma `FinancialOutcomeObservation` só pode existir
 * se `computeFinancialOutcomeObservationAction()` (Mission 139) já
 * exigiu `DecisionExecutionStatus === "COMPLETED"` no momento do seu
 * próprio cálculo (`EXECUTION_NOT_COMPLETED` caso contrário) — a regra
 * 1 acima (`bundle.formal` ausente) já cobre estruturalmente qualquer
 * Decision cuja execução nunca foi concluída, sem duplicar a checagem.
 */
export function deriveExpectedActualLearningEligibility(
  bundle: ExpectedActualComparisonBundle
): ExpectedActualLearningEligibility {
  const formal = bundle.formal;

  if (!formal) {
    return { eligible: false, reason: "no-formal-observation", message: INELIGIBLE_MESSAGES["no-formal-observation"] };
  }

  if (formal.outcome === "not-scenario-backed") {
    return { eligible: false, reason: "not-scenario-backed", message: INELIGIBLE_MESSAGES["not-scenario-backed"] };
  }

  const comparison = formal.comparison;

  if (comparison.eligibility !== "comparable" || !comparison.observedPeriod || !comparison.observationAnchor) {
    return {
      eligible: false,
      reason: "formal-not-comparable",
      message: comparison.eligibility !== "comparable" ? comparison.reason : INELIGIBLE_MESSAGES["formal-not-comparable"],
    };
  }

  const comparedMetrics = comparison.metrics.filter(isComparedMetric);
  if (comparedMetrics.length === 0) {
    return { eligible: false, reason: "no-comparable-metrics", message: INELIGIBLE_MESSAGES["no-comparable-metrics"] };
  }

  const context: ExpectedActualLearningContext = {
    nature: "expected-actual-snapshot",
    decisionId: comparison.decisionId,
    companyId: comparison.companyId,
    scenarioType: comparison.scenarioType,
    basis: "formal",
    baselinePeriod: comparison.baselinePeriod,
    observedPeriod: comparison.observedPeriod,
    financialObservationId: comparison.observationAnchor.financialObservationId,
    observationExecutionId: comparison.observationAnchor.observationExecutionId,
    metrics: comparison.metrics,
    limitations: comparison.limitations,
    disclaimer: comparison.disclaimer,
  };

  return { eligible: true, context };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Único ponto de leitura autorizado de um `ExpectedActualLearningContext`
 * a partir de `LearningRecord.supportingData` já persistido — mesmo
 * princípio de `readScenarioDecisionContext()`
 * (`efos/application/decision-lifecycle/ScenarioDecisionContext.ts`,
 * D-094): nunca um cast direto espalhado pela UI. Checagem estrutural
 * mínima (nunca uma validação de schema completa, REGRA 15) — suficiente
 * para distinguir com segurança um snapshot real de um
 * `undefined`/formato inesperado.
 */
export function readExpectedActualLearningContext(
  supportingData: Readonly<Record<string, unknown>>
): ExpectedActualLearningContext | undefined {
  const candidate = supportingData.expectedActualContext;
  if (!isPlainObject(candidate)) return undefined;
  return candidate.nature === "expected-actual-snapshot" && candidate.basis === "formal"
    ? (candidate as unknown as ExpectedActualLearningContext)
    : undefined;
}
