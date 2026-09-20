import {
  getDecisionExecutionEventsByDecision,
  getOutcomesByDecision,
} from "@/modules/decisions/services/decision-execution-persistence.service";
import { getFinancialObservationsByDecision } from "@/modules/decisions/services/financial-observation-persistence.service";
import { getLearningRecordsByDecision } from "@/modules/decisions/services/learning-record-persistence.service";
import { deriveDecisionExecutionState } from "@/efos/application/decision-execution/deriveDecisionExecutionState";
import { createClient } from "@/lib/supabase/server";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { DefaultHistoricalExecutionService } from "@/efos/application/history";
import { resolveExpectedActualComparison } from "@/modules/decisions/lib/resolveExpectedActualComparison";
import { DecisionExecutionCard } from "@/modules/decisions/components/DecisionExecutionCard";
import type { PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";

/**
 * Mission 138 — Decision Execution & Outcome Feedback Loop. Server
 * Component: lê o estado canônico direto do banco, mesmo padrão de
 * `ExecutiveDiagnosisSection`/`HumanDecisionSection` (Mission
 * 127/137) — nunca estado local/cache. Recebe as `decisions` já
 * carregadas pelo componente pai (`ExecutiveDiagnosisSection`, que já
 * busca `relatedDecisions` para `HumanDecisionSection`) para evitar
 * uma segunda consulta redundante a `getDecisionsByCompany()`.
 *
 * **Composição escolhida**: um card por `Decision` (não um Kanban
 * genérico) — cada card mostra o estado de execução DERIVADO (nunca
 * uma coluna própria, ver `deriveDecisionExecutionState()`), os
 * Outcomes humanos já registrados e, desde a Mission 139, as
 * `FinancialOutcomeObservation`s já persistidas (D-071) e, desde a
 * Mission 140, os `LearningRecord`s derivados (D-072) — camadas
 * sempre visualmente separadas dentro do mesmo card: Expected/Human
 * Observed (do `Outcome`)/Financial Truth/Correlation (da
 * `FinancialOutcomeObservation`)/Learning (evidência classificada,
 * nunca causalidade). Renderizado como irmão de
 * `HumanDecisionSection`, não aninhado dentro dele — mantém cada
 * componente com uma única responsabilidade (mesmo racional de
 * `DiagnosisReviewSection`/`HumanDecisionSection` serem componentes
 * irmãos, não um único componente monolítico).
 *
 * **Mission 185 — Expected vs Actual Decision Intelligence.** Busca
 * `HistoricalExecutionService.getHistory(companyId)` UMA ÚNICA VEZ
 * (mesmo padrão de `CompanyTimeline.tsx`, Mission 178) e reaproveita
 * para TODAS as Decisions da empresa — `resolveExpectedActualComparison()`
 * é pura e síncrona, nunca uma segunda consulta ao banco por card.
 * Sempre DERIVADA na leitura, nunca persistida (Seção 29 da missão) —
 * cada render reflete a verdade financeira mais atual disponível.
 *
 * **Mission 185 Closure — Observation Horizon & Temporal Eligibility.**
 * `resolveExpectedActualComparison()` agora recebe também
 * `financialObservations` (já buscadas logo abaixo para o bloco de
 * Financial Truth da Mission 139) para produzir a camada `formal`
 * (ancorada à observação financeira explicitamente registrada, quando
 * existir) ao lado da camada `live` (sempre a verdade mais atual) —
 * nenhuma consulta nova, apenas reuso do dado já carregado.
 */
export async function DecisionExecutionSection({
  companyId,
  decisions,
}: {
  companyId: string;
  decisions: readonly PersistedDecision[];
}) {
  if (decisions.length === 0) {
    return null;
  }

  const supabaseClient = await createClient();
  const persistenceClient = new SupabasePersistenceClient(supabaseClient);
  const executionRepository = new SupabaseExecutionRepository(persistenceClient);
  const historicalExecutionService = new DefaultHistoricalExecutionService(executionRepository);

  const [history, cards] = await Promise.all([
    historicalExecutionService.getHistory(companyId),
    Promise.all(
      decisions.map(async (decision) => {
        const [events, outcomes, financialObservations, learningRecords] = await Promise.all([
          getDecisionExecutionEventsByDecision(decision.id),
          getOutcomesByDecision(decision.id),
          getFinancialObservationsByDecision(decision.id),
          getLearningRecordsByDecision(decision.id),
        ]);
        const state = deriveDecisionExecutionState(events);
        return { decision, state, outcomes, financialObservations, learningRecords };
      })
    ),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold text-foreground">Execução & Resultado (Decision Execution)</h3>
      <div className="flex flex-col gap-4">
        {cards.map(({ decision, state, outcomes, financialObservations, learningRecords }) => (
          <DecisionExecutionCard
            key={decision.id}
            companyId={companyId}
            decision={decision}
            state={state}
            outcomes={outcomes}
            financialObservations={financialObservations}
            learningRecords={learningRecords}
            expectedActualComparison={resolveExpectedActualComparison(decision.decision, history, financialObservations)}
          />
        ))}
      </div>
    </div>
  );
}
