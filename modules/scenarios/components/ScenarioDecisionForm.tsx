"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DECISION_TYPES,
  RECOMMENDATION_CONFIDENCE_LEVELS,
  RECOMMENDATION_PRIORITIES,
  type DecisionType,
  type RecommendationConfidence,
  type RecommendationPriority,
} from "@/efos/domain";
import {
  DECISION_CONFIDENCE_LABELS,
  DECISION_PRIORITY_LABELS,
  DECISION_TYPE_LABELS,
} from "@/modules/decisions/lib/governanceLabels";
import { createScenarioDecisionAction } from "@/modules/scenarios/actions/scenario-decision.actions";
import type { ScenarioRequest } from "@/modules/scenarios/actions/scenario-simulation.actions";
import type { ScenarioBaselineIdentity } from "@/modules/scenarios/lib/scenarioBaselineIdentity";

/**
 * Mission 184 — Scenario-to-Decision Governance Bridge. Revisada pela
 * Mission 184 Closure (Exact Scenario Baseline Identity & Decision
 * Consent) — `evaluatedPeriod` (`Period` sozinho) substituído por
 * `evaluatedBaselineIdentity` (`Period` + impressão digital do
 * `FinancialModel`, D-088: mesmo período nunca implica mesma verdade).
 *
 * A única ação real que leva um cenário (single ou de comparação) para
 * a governança de `Decision` já existente (Missions 123-179) —
 * "Levar para decisão" (Seção 27: nunca "Aprovar cenário recomendado",
 * já que não existe recomendação nem vencedor). Reaproveita a MESMA
 * disciplina de `HumanDecisionSection.tsx` (Mission 127/153): título/
 * descrição/justificativa sempre nas palavras do executivo, proteção
 * síncrona contra duplo clique (`submittingRef`), `router.refresh()`
 * após sucesso.
 *
 * Nunca envia `evaluatedBaselineIdentity`/`request`/`alternative` como
 * verdade — são apenas a REIVINDICAÇÃO que `createScenarioDecisionAction()`
 * recomputa e reverifica inteiramente no servidor (Seção 17/18/19).
 * Este componente nunca calcula nenhum valor financeiro.
 */
export function ScenarioDecisionForm({
  companyId,
  evaluatedBaselineIdentity,
  request,
  alternative,
  assumptionDescription,
  alternativeDescription,
  onCreated,
}: {
  companyId: string;
  evaluatedBaselineIdentity: ScenarioBaselineIdentity;
  request: ScenarioRequest;
  alternative?: ScenarioRequest;
  assumptionDescription: string;
  alternativeDescription?: string;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<DecisionType | "">("");
  const [priority, setPriority] = useState<RecommendationPriority | "">("");
  const [confidence, setConfidence] = useState<RecommendationConfidence | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);
  const submittingRef = useRef(false);

  const canSubmit = Boolean(type && priority && confidence && title.trim() && description.trim() && rationale.trim());

  async function handleSubmit() {
    if (!canSubmit || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(undefined);
    setSuccess(false);

    try {
      const result = await createScenarioDecisionAction({
        companyId,
        evaluatedBaselineIdentity,
        request,
        alternative,
        type: type as DecisionType,
        priority: priority as RecommendationPriority,
        confidence: confidence as RecommendationConfidence,
        title: title.trim(),
        description: description.trim(),
        rationale: rationale.trim(),
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      setType("");
      setPriority("");
      setConfidence("");
      setTitle("");
      setDescription("");
      setRationale("");
      router.refresh();
      onCreated?.();
    } catch {
      setError("Erro inesperado ao registrar a decisão. Tente novamente.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-sm">Levar para decisão</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Este cenário é registrado como contexto hipotético da decisão — nunca como um resultado real. O
          resultado efetivo continua dependendo da execução e é registrado separadamente, mais tarde, como
          Outcome.
        </p>
        <p className="text-sm text-foreground">{assumptionDescription}</p>
        {alternativeDescription && (
          <p className="text-xs text-muted-foreground">
            Alternativa considerada, não escolhida: {alternativeDescription}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(value) => setType(value as DecisionType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {DECISION_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {DECISION_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as RecommendationPriority)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {RECOMMENDATION_PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {DECISION_PRIORITY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Confiança</Label>
            <Select value={confidence} onValueChange={(value) => setConfidence(value as RecommendationConfidence)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {RECOMMENDATION_CONFIDENCE_LEVELS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {DECISION_CONFIDENCE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Título</Label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Reduzir despesas operacionais em R$ 6.000/mês"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Descrição</Label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que foi decidido" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Justificativa</Label>
          <Textarea
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            placeholder="Por que esta decisão foi tomada — sempre nas suas próprias palavras"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && (
          <p className="text-sm text-emerald-600">Decisão registrada com sucesso — veja a Central de Decisões.</p>
        )}

        <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="w-fit">
          {submitting ? "Registrando decisão..." : "Registrar decisão"}
        </Button>
      </CardContent>
    </Card>
  );
}
