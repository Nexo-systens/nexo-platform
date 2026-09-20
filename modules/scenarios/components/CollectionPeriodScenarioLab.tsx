"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDICATOR_DEFINITIONS } from "@/efos/engines/indicators";
import type { ScenarioMetricComparison, ScenarioProjection } from "@/efos/application/scenario-simulation";
import { formatIndicatorValue } from "@/lib/format-indicator";
import { cn } from "@/lib/utils";
import { simulateScenarioAction, type ScenarioRequest } from "@/modules/scenarios/actions/scenario-simulation.actions";
import { ScenarioDecisionForm } from "@/modules/scenarios/components/ScenarioDecisionForm";
import type { ScenarioBaselineIdentity } from "@/modules/scenarios/lib/scenarioBaselineIdentity";
import {
  COLLECTION_PERIOD_DIRECTIONS,
  COLLECTION_PERIOD_DIRECTION_LABELS,
  COLLECTION_PERIOD_SCENARIO_METRIC_KEYS,
  SCENARIO_IMPACT_TONE_CLASSNAME,
  describeScenarioAssumption,
  formatScenarioMetricDelta,
  toSignedDeltaDaysForDirection,
  type CollectionPeriodDirection,
} from "@/modules/scenarios/lib/scenario-language";

function comparisonByKey(
  comparison: readonly ScenarioMetricComparison[]
): Readonly<Record<string, ScenarioMetricComparison>> {
  return Object.fromEntries(comparison.map((entry) => [entry.metricKey, entry]));
}

function MetricComparisonRow({ metricKey, entry }: { metricKey: string; entry?: ScenarioMetricComparison }) {
  const label = INDICATOR_DEFINITIONS[metricKey as keyof typeof INDICATOR_DEFINITIONS]?.name ?? metricKey;

  if (!entry || entry.status === "unavailable") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">Indisponível nesta empresa</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {formatIndicatorValue(entry.baselineValue, entry.unit)} →{" "}
          {formatIndicatorValue(entry.projectedValue, entry.unit)}
        </span>
      </div>
      <span
        className={cn("text-sm font-medium tabular-nums", SCENARIO_IMPACT_TONE_CLASSNAME[entry.impact])}
      >
        {formatScenarioMetricDelta(entry.delta, entry.unit)}
      </span>
    </div>
  );
}

/**
 * Mission 182 — Scenario Engine Generalization & Second Financial
 * Vertical.
 *
 * Segunda vertical de Scenario Lab: "e se meus clientes demorarem mais/
 * menos para pagar?" (Seção 23 — pergunta de negócio, nunca "Modificar
 * DSO"). Espelha `OperatingCostScenarioLab.tsx` (Mission 181) — mesma
 * disciplina (React nunca calcula nada financeiro, apenas coleta
 * direção+dias, chama `simulateScenarioAction()`, formata o
 * `ScenarioProjection` já pronto; baseline resolvida inteiramente no
 * servidor; `error`/`projection` limpos antes de cada nova submissão),
 * deliberadamente NÃO generalizada num formulário genérico (Seção 22:
 * "explicit form for that simulation", nunca um framework de formulário
 * dinâmico) — um componente próprio e específico para esta vertical,
 * assim como `OperatingCostScenarioLab` permanece específico para a
 * dela.
 *
 * `ScenarioType` (`"adjust_collection_terms"`, D-092) nunca exposto —
 * apenas "clientes demoram mais/pagam mais rápido"
 * (`modules/scenarios/lib/scenario-language.ts`).
 *
 * Desde a Mission 184, um botão explícito "Levar para decisão" (nunca
 * automático) revela `ScenarioDecisionForm`, formalizando este cenário
 * como contexto hipotético de uma `Decision` humana real.
 */
export function CollectionPeriodScenarioLab({ companyId }: { companyId: string }) {
  const [direction, setDirection] = useState<CollectionPeriodDirection | "">("");
  const [daysInput, setDaysInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [projection, setProjection] = useState<ScenarioProjection | undefined>();
  const [submittedRequest, setSubmittedRequest] = useState<ScenarioRequest | undefined>();
  const [baselineIdentity, setBaselineIdentity] = useState<ScenarioBaselineIdentity | undefined>();
  const [showDecisionForm, setShowDecisionForm] = useState(false);

  const parsedDays = Number(daysInput.replace(",", "."));
  const daysIsValid = daysInput.trim() !== "" && Number.isFinite(parsedDays) && parsedDays > 0;

  async function handleSimulate() {
    if (!direction || submitting) return;

    // Higiene de entrada (nunca uma regra de negócio — permanece no
    // servidor): vazio/não-numérico/negativo nunca chegam a ser
    // enviados. `0` É enviado deliberadamente — a rejeição de valor
    // zero é do contrato canônico (`validateCollectionPeriodChangeAssumption()`),
    // preservada sem duplicação.
    if (!daysIsValid) {
      setError("Informe um número de dias positivo para simular.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    setProjection(undefined);
    setSubmittedRequest(undefined);
    setBaselineIdentity(undefined);
    setShowDecisionForm(false);

    try {
      const request: ScenarioRequest = {
        kind: "collection_period_change",
        collectionPeriodDeltaDays: toSignedDeltaDaysForDirection(direction, parsedDays),
      };
      const result = await simulateScenarioAction({ companyId, ...request });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setProjection(result.projection);
      setSubmittedRequest(request);
      setBaselineIdentity(result.baselineIdentity);
    } catch {
      setError("Erro inesperado ao simular o cenário. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const comparison = projection ? comparisonByKey(projection.comparison) : undefined;

  return (
    <>
      <CardHeader>
        <CardTitle className="text-base">Prazo de recebimento</CardTitle>
        <CardDescription>
          Teste o impacto de uma mudança no prazo em que os clientes desta empresa pagam.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collection-direction">O que você quer simular?</Label>
            <Select
              value={direction}
              onValueChange={(value) => setDirection(value as CollectionPeriodDirection)}
            >
              <SelectTrigger id="collection-direction" className="w-full">
                <SelectValue placeholder="Selecione a direção da mudança" />
              </SelectTrigger>
              <SelectContent>
                {COLLECTION_PERIOD_DIRECTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {COLLECTION_PERIOD_DIRECTION_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collection-days">Dias</Label>
            <Input
              id="collection-days"
              inputMode="numeric"
              placeholder="15"
              value={daysInput}
              onChange={(event) => setDaysInput(event.target.value)}
              aria-invalid={daysInput.trim() !== "" && !daysIsValid}
              className="w-24"
            />
          </div>

          <Button onClick={handleSimulate} disabled={!direction || submitting} className="w-fit">
            {submitting ? "Simulando..." : "Simular"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {projection && comparison && (
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                O que você está assumindo
              </span>
              <p className="text-sm text-foreground">
                {describeScenarioAssumption(projection.assumption)}, mantendo receita, custos e o
                restante do balanço patrimonial inalterados.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                O que muda
              </span>
              <div className="flex flex-col gap-2">
                {COLLECTION_PERIOD_SCENARIO_METRIC_KEYS.map((key) => (
                  <MetricComparisonRow key={key} metricKey={key} entry={comparison[key]} />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="w-fit border-warning/30 bg-warning/10 text-warning">
                Cenário hipotético — não é uma previsão
              </Badge>
              <p className="text-xs text-muted-foreground">{projection.disclaimer}</p>
            </div>

            {!showDecisionForm && (
              <Button variant="outline" className="w-fit" onClick={() => setShowDecisionForm(true)}>
                Levar para decisão
              </Button>
            )}

            {showDecisionForm && submittedRequest && baselineIdentity && (
              <ScenarioDecisionForm
                companyId={companyId}
                evaluatedBaselineIdentity={baselineIdentity}
                request={submittedRequest}
                assumptionDescription={describeScenarioAssumption(projection.assumption)}
                onCreated={() => setShowDecisionForm(false)}
              />
            )}
          </div>
        )}
      </CardContent>
    </>
  );
}
