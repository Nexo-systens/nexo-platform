import { readScenarioDecisionContext } from "@/efos/application/decision-lifecycle";
import type { FinancialObservationBase } from "@/efos/application/financial-observation";
import type { HistoricalExecution } from "@/efos/application/history";
import type { Decision } from "@/efos/domain";
import { scenarioContextMatchesExecution } from "@/modules/scenarios/lib/scenarioBaselineIdentity";

/**
 * Mission 211 — Outcome Temporal Integrity (D-136).
 *
 * Em qual verdade financeira esta decisão foi tomada? Só pela LINHAGEM já
 * gravada, nunca por proximidade de datas e nunca "a última análise":
 *
 * - **Cenário** (Scenario Lab ou proposta do Executive Chat, D-094/D-095/
 *   D-135): a execução com o mesmo período e a mesma impressão do Financial
 *   Model do `scenarioContext` — a mesma regra da linhagem do relatório
 *   (`scenarioContextMatchesExecution`). Entre versões equivalentes, a mais
 *   recente que já existia quando a decisão foi registrada.
 * - **Recomendação / leitura da IA** (D-082): a execução do diagnóstico que a
 *   decisão cita (`executive_diagnoses.execution_id`).
 * - **Manual, sem diagnóstico e sem cenário**: nenhuma base. O resultado
 *   humano (`Outcome`) continua válido; a observação financeira não existe
 *   até haver uma base explícita.
 *
 * Base declarada mas não localizável no histórico da MESMA empresa:
 * `unavailable` (falha fechada). Função pura.
 */
export type DecisionFinancialBaseOrigin = "scenario" | "diagnosis" | "manual";

export interface DecisionFinancialBaseInput {
  readonly decision: Decision;
  /** `decisions.created_at` — o instante em que a decisão foi registrada. */
  readonly decisionCreatedAt: string;
  /** `decisions.diagnosis_id`, quando a coluna existe na linha. */
  readonly diagnosisId?: string | null;
  /** O diagnóstico citado, lido sob RLS pelo chamador. */
  readonly diagnosis?: { readonly id: string; readonly companyId: string; readonly executionId: string | null } | null;
  readonly history: readonly HistoricalExecution[];
}

export interface DecisionFinancialBase {
  readonly origin: DecisionFinancialBaseOrigin;
  readonly base: FinancialObservationBase;
}

/** De onde vem a base financeira de uma decisão — só pela linhagem gravada, sem consultar o histórico. */
export function decisionFinancialBaseOrigin(decision: Decision, diagnosisId?: string | null): DecisionFinancialBaseOrigin {
  if (readScenarioDecisionContext(decision.supportingData)) return "scenario";
  if (decision.basedOnDiagnosisId ?? diagnosisId) return "diagnosis";
  return "manual";
}

export function resolveDecisionFinancialBase(input: DecisionFinancialBaseInput): DecisionFinancialBase {
  const { decision, history } = input;
  const companyHistory = history.filter((execution) => execution.companyId === decision.companyId);

  const origin = decisionFinancialBaseOrigin(decision, input.diagnosisId);
  const scenario = readScenarioDecisionContext(decision.supportingData);
  if (origin === "scenario" && scenario) {
    const decidedAt = Date.parse(input.decisionCreatedAt);
    const anchored = companyHistory.filter(
      (execution) => scenarioContextMatchesExecution(scenario, execution) && Date.parse(execution.executedAt) <= decidedAt
    );
    const execution = anchored.at(-1);
    return { origin: "scenario", base: execution ? { outcome: "anchored", execution } : { outcome: "unavailable" } };
  }

  const diagnosisId = decision.basedOnDiagnosisId ?? input.diagnosisId ?? undefined;
  if (origin === "diagnosis" && diagnosisId) {
    const diagnosis = input.diagnosis;
    if (!diagnosis || diagnosis.id !== diagnosisId || diagnosis.companyId !== decision.companyId || !diagnosis.executionId) {
      return { origin: "diagnosis", base: { outcome: "unavailable" } };
    }
    const execution = companyHistory.find((candidate) => candidate.executionId === diagnosis.executionId);
    return { origin: "diagnosis", base: execution ? { outcome: "anchored", execution } : { outcome: "unavailable" } };
  }

  return { origin: "manual", base: { outcome: "unanchored" } };
}
