"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Knowledge, LearningRecord } from "@/efos/domain";
import { formKnowledgeAction, formGovernedKnowledgeAction } from "@/modules/decisions/actions/knowledge-formation.actions";
import { evaluateKnowledgeAction } from "@/modules/decisions/actions/knowledge-evaluation.actions";
import type { KnowledgeStateResult } from "@/efos/application/knowledge-lifecycle";
import type { KnowledgeCandidatePreview } from "@/efos/application/knowledge-formation";
import { readExpectedActualLearningContext } from "@/efos/application/expected-actual-learning";
import { KNOWLEDGE_CATEGORY_LABELS } from "@/modules/decisions/lib/knowledgeLabels";

/**
 * Mensagens honestas por código de erro (mesmo padrão de
 * `OBSERVATION_ERROR_LABELS`/`LEARNING_ERROR_LABELS` em
 * `DecisionExecutionCard.tsx`, Missions 139/140) — nunca uma mensagem
 * genérica que esconda a causa real.
 */
const KNOWLEDGE_ERROR_LABELS: Record<string, string> = {
  NO_SUFFICIENT_RECURRING_LEARNING:
    "Ainda não há LearningRecords suficientemente recorrentes (mínimo 2 Decisions independentes com a mesma classificação de evidência) — nenhum Knowledge foi fabricado.",
};

/**
 * Mission 146 — Knowledge Lifecycle & Historical Intelligence
 * Maturity. Rótulos sempre evidenciais, nunca causais — mesma
 * disciplina de `CATEGORY_LABELS` acima. Nunca inclui `PROVEN`/
 * `CAUSAL`/`GUARANTEED`/`CERTAIN`.
 */
const LIFECYCLE_STATE_LABELS: Record<string, string> = {
  EMERGING: "Ainda não avaliado",
  INSUFFICIENT: "Avaliado, sem sinal suficiente",
  SUPPORTED: "Reforçado pelo histórico",
  WEAKENED: "Contradito pelo histórico",
  MIXED: "Histórico misto (reforço e contradição)",
};

/**
 * Mission 141 — Knowledge Formation & Cross-Decision Learning. Botão
 * explícito "Formar conhecimento" (nunca automático), `disabled`
 * durante o processamento (mesma proteção contra duplo clique de todo
 * componente desta família), `router.refresh()` após sucesso.
 */
export function KnowledgeFormationPanel({
  companyId,
  knowledge,
  knowledgeStates,
  learningRecordsById,
  pendingReview,
}: {
  companyId: string;
  knowledge: readonly Knowledge[];
  knowledgeStates?: Readonly<Record<string, KnowledgeStateResult>>;
  /**
   * Mission 187 — Governed Learning → Organizational Knowledge. Todos
   * os `LearningRecord`s da empresa, indexados por `id` — usado
   * exclusivamente para exibir, sob demanda ("Ver evidência"), a
   * interpretação executiva (`humanStatement`, Mission 186 Closure) dos
   * registros que efetivamente formaram cada `Knowledge`
   * (`derivedFromLearningRecordIds`). Nunca influencia a formação em si
   * (`formKnowledgeAction()`, inalterada) — leitura de exibição apenas.
   */
  learningRecordsById?: Readonly<Record<string, LearningRecord>>;
  /**
   * Mission 187 Closure — Governed Knowledge Synthesis. Candidatos
   * recorrentes com interpretação executiva, ainda SEM `Knowledge`
   * persistido — nunca formados automaticamente (Seção 21). Cada um só
   * vira `Knowledge` através de `formGovernedKnowledgeAction()`,
   * quando um humano confirma/edita `suggestedStatement`.
   */
  pendingReview?: readonly KnowledgeCandidatePreview[];
}) {
  const router = useRouter();
  const [forming, setForming] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | undefined>();
  const [expandedEvidence, setExpandedEvidence] = useState<string | undefined>();
  const [statementDrafts, setStatementDrafts] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | undefined>();

  async function handleFormKnowledge() {
    if (forming) return;
    setForming(true);
    setError(undefined);
    setInfo(undefined);

    try {
      const result = await formKnowledgeAction({ companyId });
      if (!result.success) {
        setError(KNOWLEDGE_ERROR_LABELS[result.code] ?? result.message);
        return;
      }
      if (result.knowledge.length === 0 && result.pendingReview.length === 0) {
        setInfo("Nenhum padrão novo formado — os padrões recorrentes já existentes continuam válidos.");
      }
      router.refresh();
    } catch {
      setError("Erro inesperado ao formar conhecimento. Tente novamente.");
    } finally {
      setForming(false);
    }
  }

  /**
   * Mission 187 Closure — envia exatamente o texto que o revisor
   * confirmou/editou (ou nada, se preferiu o texto sugerido) — nunca
   * nenhum valor financeiro/lineage, sempre recomputados no servidor
   * (`formGovernedKnowledgeAction()`, Seção 28 da missão).
   */
  async function handleApproveKnowledge(candidateId: string, suggestedStatement: string) {
    if (approvingId) return;
    setApprovingId(candidateId);
    setError(undefined);
    setInfo(undefined);

    try {
      const draft = statementDrafts[candidateId];
      const organizationalStatement = draft !== undefined && draft.trim() !== suggestedStatement.trim() ? draft : undefined;
      const result = await formGovernedKnowledgeAction({ companyId, candidateId, organizationalStatement });
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setError("Erro inesperado ao aprovar o conhecimento. Tente novamente.");
    } finally {
      setApprovingId(undefined);
    }
  }

  /**
   * Mission 145 — Etapa 5/11. Reavalia TODO Knowledge da empresa
   * contra os LearningRecords reais mais recentes — nunca reescreve
   * nenhum Knowledge, apenas persiste uma nova avaliação histórica.
   */
  async function handleEvaluateKnowledge() {
    if (evaluating) return;
    setEvaluating(true);
    setError(undefined);
    setInfo(undefined);

    try {
      const result = await evaluateKnowledgeAction({ companyId });
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setError("Erro inesperado ao avaliar o conhecimento. Tente novamente.");
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-sm">Padrões recorrentes entre decisões independentes</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleFormKnowledge} disabled={forming}>
            {forming ? "Formando..." : "Formar conhecimento"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleEvaluateKnowledge} disabled={evaluating || knowledge.length === 0}>
            {evaluating ? "Avaliando..." : "Avaliar conhecimento"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Consolida LearningRecords recorrentes de múltiplas decisões independentes em conhecimento reutilizável — nunca a partir de uma única decisão, nunca por IA, nunca afirma causalidade.
        </p>

        {/*
          Mission 187 Closure — Governed Knowledge Synthesis (Seção 3/7/24
          da missão). Um candidato com interpretação executiva NUNCA vira
          Knowledge sozinho — o revisor sempre vê as interpretações VERBATIM
          (nunca sintetizadas por esta tela) e confirma/edita o statement
          organizacional final antes de qualquer persistência.
        */}
        {(pendingReview ?? []).map((preview) => {
          const draft = statementDrafts[preview.candidateId] ?? preview.suggestedStatement;
          // Mission 187 Closure — Seção 20: o revisor precisa ver as
          // mesmas limitações estruturais (ex.: realização gradual de
          // prazo de recebimento) que já acompanhavam o contexto
          // Esperado vs. Observado (D-099) quando o executivo escreveu
          // sua interpretação — nunca duplicadas no domínio, sempre
          // lidas da fonte (`learningRecordsById`, já carregado).
          const limitations = Array.from(
            new Set(
              preview.interpretations.flatMap(
                (interpretation) =>
                  readExpectedActualLearningContext(learningRecordsById?.[interpretation.learningRecordId]?.supportingData ?? {})
                    ?.limitations ?? []
              )
            )
          );
          return (
            <div key={preview.candidateId} className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{KNOWLEDGE_CATEGORY_LABELS[preview.category] ?? preview.category}</Badge>
                <span className="text-muted-foreground">Aguardando revisão — {preview.decisionIds.length} Decisions, {preview.interpretations.length} interpretação(ões)</span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-medium text-foreground">Interpretações registradas pelos executivos (fonte — nunca resumidas pela NEXO):</p>
                {preview.interpretations.map((interpretation) => (
                  <p key={interpretation.learningRecordId} className="rounded bg-muted/40 p-1.5 italic text-muted-foreground">
                    {interpretation.humanStatement}
                  </p>
                ))}
              </div>
              {limitations.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-medium text-foreground">Limitações do contexto financeiro de origem:</p>
                  {limitations.map((limitation) => (
                    <p key={limitation} className="text-[10px] text-muted-foreground">{limitation}</p>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-medium text-foreground">Statement organizacional (sugestão determinística — confirme ou edite antes de aprovar):</p>
                <Textarea
                  value={draft}
                  onChange={(event) => setStatementDrafts((prev) => ({ ...prev, [preview.candidateId]: event.target.value }))}
                  className="text-xs"
                  rows={3}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="self-end"
                onClick={() => handleApproveKnowledge(preview.candidateId, preview.suggestedStatement)}
                disabled={approvingId === preview.candidateId || draft.trim().length === 0}
              >
                {approvingId === preview.candidateId ? "Aprovando..." : "Aprovar conhecimento"}
              </Button>
            </div>
          );
        })}

        {knowledge.length === 0 && (pendingReview ?? []).length === 0 && !error && !info && (
          <p className="text-xs text-muted-foreground">Nenhum conhecimento formado ainda para esta empresa.</p>
        )}

        {knowledge.map((k) => {
          const state = knowledgeStates?.[k.id];
          const isExpanded = expandedEvidence === k.id;
          const hasLifecycleEvidence = state !== undefined && state.state !== "EMERGING";
          // Mission 187 — Governed Learning → Organizational Knowledge
          // (Seção 25/26). Lidos exclusivamente para EXIBIÇÃO — nunca
          // influenciam `k.statement` (já determinístico, formado por
          // `buildKnowledgeFromLearningRecords()`) nem a formação em si.
          const interpretedRecords = (k.derivedFromLearningRecordIds ?? [])
            .map((id) => learningRecordsById?.[id])
            .filter((record): record is LearningRecord => record !== undefined && Boolean(record.humanStatement));
          const canExpand = hasLifecycleEvidence || interpretedRecords.length > 0;

          return (
            <div key={k.id} className="rounded-md bg-muted/40 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{KNOWLEDGE_CATEGORY_LABELS[k.category] ?? k.category}</Badge>
                <span className="text-muted-foreground">{k.derivedFromLearningRecordIds?.length ?? 0} LearningRecord(s) de origem</span>
              </div>
              <p className="mt-1 text-foreground">{k.statement}</p>
              {/* Mission 146 — Etapa 14: estado de ciclo de vida agregando TODO o histórico de avaliações (nunca só a mais recente), nunca fabricado na ausência de avaliações reais (EMERGING é o próprio estado honesto de "nenhuma avaliação ainda"). */}
              {hasLifecycleEvidence && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={state.state === "WEAKENED" ? "destructive" : "secondary"}>
                    {LIFECYCLE_STATE_LABELS[state.state] ?? state.state}
                  </Badge>
                  <span className="text-muted-foreground">
                    {state.evaluationCount} avaliação(ões) · {state.supportingCount} a favor · {state.contradictingCount} contra
                    {state.insufficientCount > 0 ? ` · ${state.insufficientCount} inconclusiva(s)` : ""}
                  </span>
                </div>
              )}
              {canExpand && (
                <div className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2">
                  <button
                    type="button"
                    className="w-fit text-left text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => setExpandedEvidence(isExpanded ? undefined : k.id)}
                  >
                    {isExpanded ? "Ocultar evidência" : "Ver evidência"}
                  </button>
                  {isExpanded && (
                    <>
                      {hasLifecycleEvidence && <p className="text-muted-foreground">{state.rationale}</p>}
                      {interpretedRecords.length > 0 && (
                        <div className="mt-1 flex flex-col gap-1">
                          <p className="text-[10px] font-medium text-foreground">
                            Interpretações registradas pelos executivos (fonte — nunca calculadas ou resumidas pela NEXO):
                          </p>
                          {interpretedRecords.map((record) => (
                            <p key={record.id} className="rounded bg-background/60 p-1.5 italic text-muted-foreground">
                              {record.humanStatement}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {info && <p className="text-sm text-muted-foreground">{info}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
