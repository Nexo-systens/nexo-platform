import type { ExecutiveDiagnosis } from "@/efos/application/executive-diagnosis/ExecutiveDiagnosis";
import { listRecommendationReferences, type RecommendationReferenceCategory } from "@/efos/application/executive-diagnosis";
import {
  deriveRecommendationGovernanceState,
  type RecommendationGovernanceState,
} from "@/efos/application/recommendation-governance";
import {
  deriveRecommendationOutcomeReconciliation,
  type RecommendationOutcomeReconciliation,
} from "@/efos/application/recommendation-outcome-reconciliation";
import type { DecisionExecutionEvent } from "@/efos/application/decision-execution";
import type { DiagnosisReview } from "@/efos/application/diagnosis-review";
import type { FinancialOutcomeObservation } from "@/efos/application/financial-observation";
import type { Decision, Knowledge, LearningRecord, Outcome } from "@/efos/domain";
import type { PersistedExecutiveDiagnosis } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import type { PersistedDiagnosisReview } from "@/modules/decisions/services/diagnosis-review-persistence.service";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";

/**
 * Mission 179 — Executive Decision Center.
 *
 * **Achado central desta missão (Seção 3, "First Critical Question")**:
 * a classificação ARCHITECTURALLY_BLOCKED atribuída pela Mission 178 ao
 * Decision Center estava INCORRETA. Auditoria de código real provou que
 * `diagnoses[0]` (a única "âncora" que impedia uma fila real) é uma
 * escolha arbitrária de composição de `ExecutiveDiagnosisSection.tsx`
 * — nunca um limite estrutural de `deriveRecommendationGovernanceState()`
 * (Mission 154)/`deriveRecommendationOutcomeReconciliation()` (Mission
 * 155)/`listRecommendationReferences()` (Mission 150), que já recebem
 * `companyId`+`diagnosis` como parâmetros simples, sem nenhuma noção de
 * "mais recente" embutida. `getExecutiveDiagnosesByCompany()` já
 * devolve TODOS os diagnósticos da empresa; `getDecisionsByCompany()`/
 * `getLearningRecordsByCompany()`/`getKnowledgeByCompany()` já são
 * company-wide (nunca escopados a um único diagnóstico) — a mesma
 * composição já usada por `ExecutiveDiagnosisSection` para o
 * diagnóstico mais recente é aqui generalizada para TODOS os
 * diagnósticos, reaproveitando literalmente as mesmas 3 funções puras,
 * nenhuma reimplementação de lógica de governança.
 *
 * **Semântica de "requer decisão" (Seção 6)** — derivada exclusivamente
 * do `lifecycleState`/`reviewStatus` já produzidos por
 * `RecommendationGovernanceState` (Mission 154), nunca de timestamp/
 * ordem de array/UI: `NOT_REVIEWED` (nenhuma revisão ainda) e
 * `REVIEWED` com `reviewStatus.status !== "REJECTED"` (revisado e
 * aceito/modificado, mas sem `Decision` ainda) requerem decisão.
 * `REVIEWED` com `reviewStatus.status === "REJECTED"` é tratado como
 * RESOLVIDO (o humano já decidiu não agir — a rejeição em si é o
 * desfecho, mesmo sem uma `Decision` formal) — nunca permanece na fila
 * de pendências. `DECIDED`/`EXECUTING`/`BLOCKED` já têm uma `Decision`
 * (decidido, possivelmente em execução). `COMPLETED`/`CANCELLED`/
 * `OUTCOME_RECORDED`/`LEARNING_OBSERVED` são o ciclo encerrado. Este
 * mapeamento é uma composição de apresentação sobre 2 campos JÁ
 * existentes de `RecommendationGovernanceState` — nunca um novo estado
 * de negócio inventado (Seção 6 da missão: "if no defensible state
 * exists, stop and report" — um estado defensável já existe, por isso
 * a implementação prossegue).
 *
 * Itens cujo `governance.outcome !== "GOVERNED"` (`RECOMMENDATION_NOT_FOUND`/
 * `COMPANY_MISMATCH`/`TEMPORAL_INCONSISTENCY` — sempre defeitos
 * estruturais que não deveriam ocorrer com dados bem formados) são
 * excluídos da fila — nunca apresentados como "pendentes" nem
 * escondidos silenciosamente de um jeito que finja que está tudo bem;
 * simplesmente não participam de uma fila que pressupõe governança
 * bem-formada (mesmo princípio de `financialTruthFingerprint()`: nunca
 * fabricar certeza a partir de dado estruturalmente inválido).
 */

export const DECISION_CENTER_BUCKETS = ["requires-decision", "decided", "concluded"] as const;
export type DecisionCenterBucket = (typeof DECISION_CENTER_BUCKETS)[number];

export interface ExecutiveDecisionWorkItem {
  readonly recommendationId: string;
  readonly diagnosisId: string;
  readonly diagnosisCreatedAt: string;
  readonly category: RecommendationReferenceCategory;
  readonly statement: string;
  readonly rank?: number;
  readonly governance: RecommendationGovernanceState;
  readonly reconciliation: RecommendationOutcomeReconciliation;
  readonly bucket: DecisionCenterBucket;
}

export interface DecisionCenterQueueInputs {
  readonly companyId: string;
  readonly diagnoses: readonly PersistedExecutiveDiagnosis[];
  readonly reviewsByDiagnosis: Readonly<Record<string, readonly PersistedDiagnosisReview[]>>;
  readonly decisions: readonly PersistedDecision[];
  readonly executionEvents: readonly DecisionExecutionEvent[];
  readonly outcomes: readonly Outcome[];
  readonly learningRecords: readonly LearningRecord[];
  readonly knowledgeRecords: readonly Knowledge[];
  readonly financialObservations: readonly FinancialOutcomeObservation[];
}

function deriveBucket(governance: RecommendationGovernanceState): DecisionCenterBucket {
  const state = governance.lifecycleState;
  if (state === undefined || state === "NOT_REVIEWED") return "requires-decision";
  if (state === "REVIEWED") {
    return governance.reviewStatus?.status === "REJECTED" ? "concluded" : "requires-decision";
  }
  if (state === "DECIDED" || state === "EXECUTING" || state === "BLOCKED") return "decided";
  return "concluded"; // COMPLETED | CANCELLED | OUTCOME_RECORDED | LEARNING_OBSERVED
}

function findRankForPriorityItem(diagnosis: ExecutiveDiagnosis, recommendationId: string): number | undefined {
  return diagnosis.priorities.find((priority) => priority.id === recommendationId)?.rank;
}

/**
 * Composição pura — nunca acessa Supabase/relógio/IA, nunca muta
 * nenhum argumento recebido. Mesma entrada sempre produz a mesma
 * saída.
 *
 * **Ordenação (Seção 10) — deliberadamente limitada e documentada**:
 * dentro de "requires-decision", itens da categoria `"priorities"`
 * (que já carregam um `rank` real do próprio diagnóstico, D-059) vêm
 * primeiro, ordenados por `rank` ascendente — a única prioridade
 * genuinamente canônica disponível. Os demais itens (sem `rank`
 * algum — nenhuma urgência financeira é inventada para eles) são
 * ordenados por `diagnosisCreatedAt` ASCENDENTE (o mais antigo
 * pendente primeiro) — um proxy honesto de "há mais tempo aguardando
 * atenção", nunca urgência financeira. Nas filas "decided"/"concluded"
 * (atividade já resolvida), a ordenação é por `diagnosisCreatedAt`
 * DESCENDENTE (mais recente primeiro) — mesma convenção já estabelecida
 * pela Mission 178 (Knowledge Timeline) para atividade histórica.
 */
export function buildDecisionCenterQueue(inputs: DecisionCenterQueueInputs): readonly ExecutiveDecisionWorkItem[] {
  // Defesa em profundidade (Seção 25 adversarial: "can cross-company
  // data leak?") — `inputs.diagnoses` já deveria vir escopado por
  // `getExecutiveDiagnosesByCompany(companyId)`, mas esta função nunca
  // confia cegamente que o chamador já filtrou (mesmo princípio já
  // aplicado por `buildCanonicalPriorPeriods()`/`buildCompanyTimeline()`).
  const scopedDiagnoses = inputs.diagnoses.filter((diagnosis) => diagnosis.companyId === inputs.companyId);
  const allDecisionEntities: readonly Decision[] = inputs.decisions.map((persisted) => persisted.decision);
  const items: ExecutiveDecisionWorkItem[] = [];

  for (const diagnosis of scopedDiagnoses) {
    const review: DiagnosisReview | undefined = inputs.reviewsByDiagnosis[diagnosis.id]?.[0]?.review;

    for (const reference of listRecommendationReferences(diagnosis.diagnosis)) {
      const governance = deriveRecommendationGovernanceState(
        reference.recommendationId,
        diagnosis.diagnosis,
        inputs.companyId,
        review,
        allDecisionEntities,
        inputs.executionEvents,
        inputs.outcomes,
        inputs.learningRecords,
        inputs.knowledgeRecords
      );

      if (governance.outcome !== "GOVERNED") continue;

      const reconciliation = deriveRecommendationOutcomeReconciliation(
        diagnosis.diagnosis,
        governance,
        inputs.financialObservations
      );

      items.push({
        recommendationId: reference.recommendationId,
        diagnosisId: diagnosis.id,
        diagnosisCreatedAt: diagnosis.createdAt,
        category: reference.category,
        statement: reference.statement,
        rank: findRankForPriorityItem(diagnosis.diagnosis, reference.recommendationId),
        governance,
        reconciliation,
        bucket: deriveBucket(governance),
      });
    }
  }

  const requiresDecision = items
    .filter((item) => item.bucket === "requires-decision")
    .sort((a, b) => {
      const aHasRank = a.rank !== undefined;
      const bHasRank = b.rank !== undefined;
      if (aHasRank && bHasRank) return (a.rank as number) - (b.rank as number);
      if (aHasRank) return -1;
      if (bHasRank) return 1;
      return a.diagnosisCreatedAt.localeCompare(b.diagnosisCreatedAt);
    });

  const decided = items
    .filter((item) => item.bucket === "decided")
    .sort((a, b) => b.diagnosisCreatedAt.localeCompare(a.diagnosisCreatedAt));

  const concluded = items
    .filter((item) => item.bucket === "concluded")
    .sort((a, b) => b.diagnosisCreatedAt.localeCompare(a.diagnosisCreatedAt));

  return [...requiresDecision, ...decided, ...concluded];
}
