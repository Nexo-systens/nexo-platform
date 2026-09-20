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
  OPERATING_COST_DIRECTIONS,
  OPERATING_COST_DIRECTION_LABELS,
  PRIMARY_SCENARIO_METRIC_KEYS,
  SCENARIO_IMPACT_TONE_CLASSNAME,
  SECONDARY_SCENARIO_METRIC_KEYS,
  describeScenarioAssumption,
  formatScenarioMetricDelta,
  toSignedAmountForDirection,
  type OperatingCostDirection,
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
 * Mission 181 — First Production Scenario Lab Experience.
 *
 * Primeiro consumidor de produto real da vertical de Despesas
 * Operacionais (Mission 180, `efos/application/scenario-simulation/`,
 * D-091) — desde a Mission 182, via a Server Action generalizada
 * `simulateScenarioAction()` (`kind: "operating_cost_change"`). React
 * nunca calcula nada financeiro aqui — apenas coleta a premissa
 * (direção + valor monetário), chama a Server Action, e formata o
 * `ScenarioProjection` já pronto devolvido por ela (Seção 21 da
 * Mission 181). A baseline financeira nunca é escolhida pelo browser —
 * a Server Action resolve `resolveCurrentFinancialExecution()`
 * inteiramente no servidor (D-088/089/090); nenhum `executionId` é
 * enviado ou recebido do client.
 *
 * Fluxo (Seção 4 da Mission 181): direção → valor → simular → ver base
 * → ver projeção → entender impacto → ajustar e simular de novo.
 * Simular em si nunca tem efeito colateral: nenhuma Recommendation é
 * criada, e nenhuma Decision é criada automaticamente — apenas
 * apresentação de um resultado determinístico e hipotético. Desde a
 * Mission 184, um botão explícito "Levar para decisão" (nunca
 * automático) revela `ScenarioDecisionForm`, que formaliza este cenário
 * como contexto hipotético de uma `Decision` humana real — sempre um
 * segundo clique deliberado, nunca parte do fluxo de simulação.
 *
 * Vocabulário de produto neutro (Seção 5 da Mission 181, corrigido na
 * origem pela Mission 182/D-092): a UI nunca expõe `ScenarioType`
 * (`"adjust_operating_costs"`) diretamente — apenas "aumentar/reduzir
 * despesas operacionais" (`modules/scenarios/lib/scenario-language.ts`).
 *
 * Proteção contra novo envio enquanto uma simulação está em andamento
 * (`submitting`) e contra resultado obsoleto sendo exibido como se
 * correspondesse a uma nova tentativa que falhou (Seção 19): tanto
 * `projection` quanto `error` são limpos no INÍCIO de cada nova
 * submissão, antes de aguardar a resposta do servidor — nunca depois.
 */
export function OperatingCostScenarioLab({ companyId }: { companyId: string }) {
  const [direction, setDirection] = useState<OperatingCostDirection | "">("");
  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [projection, setProjection] = useState<ScenarioProjection | undefined>();
  const [submittedRequest, setSubmittedRequest] = useState<ScenarioRequest | undefined>();
  const [baselineIdentity, setBaselineIdentity] = useState<ScenarioBaselineIdentity | undefined>();
  const [showDecisionForm, setShowDecisionForm] = useState(false);

  const parsedAmount = Number(amountInput.replace(",", "."));
  const amountIsValid = amountInput.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;

  async function handleSimulate() {
    if (!direction || submitting) return;

    // Higiene de entrada (nunca uma regra de negócio — essas permanecem
    // no servidor, Seção 8): vazio/não-numérico/negativo nunca chegam a
    // ser enviados. `0` É enviado deliberadamente — a rejeição de valor
    // zero é uma regra do contrato canônico (Mission 180,
    // `validateOperatingCostChangeAssumption`), preservada aqui sem
    // duplicação: o servidor decide e sua mensagem é exibida como veio.
    if (!amountIsValid) {
      setError("Informe um valor monetário positivo para simular.");
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
        kind: "operating_cost_change",
        operatingExpensesDeltaAmount: toSignedAmountForDirection(direction, parsedAmount),
        operatingExpensesDeltaCurrency: "BRL",
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
        <CardTitle className="text-base">Despesas operacionais</CardTitle>
        <CardDescription>
          Teste o impacto de uma mudança em Despesas Operacionais sobre os indicadores desta empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scenario-direction">O que você quer simular?</Label>
            <Select
              value={direction}
              onValueChange={(value) => setDirection(value as OperatingCostDirection)}
            >
              <SelectTrigger id="scenario-direction" className="w-full">
                <SelectValue placeholder="Selecione a direção da mudança" />
              </SelectTrigger>
              <SelectContent>
                {OPERATING_COST_DIRECTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {OPERATING_COST_DIRECTION_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scenario-amount">Valor (R$)</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input
                id="scenario-amount"
                inputMode="decimal"
                placeholder="20.000"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                aria-invalid={amountInput.trim() !== "" && !amountIsValid}
                className="w-36"
              />
            </div>
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
                {describeScenarioAssumption(projection.assumption)}, mantendo o restante do modelo
                financeiro (receita, custos, balanço) inalterado.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                O que muda
              </span>
              <div className="flex flex-col gap-2">
                {PRIMARY_SCENARIO_METRIC_KEYS.map((key) => (
                  <MetricComparisonRow key={key} metricKey={key} entry={comparison[key]} />
                ))}
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Ver indicadores adicionais (retorno e cobertura de juros)
                </summary>
                <div className="mt-2 flex flex-col gap-2">
                  {SECONDARY_SCENARIO_METRIC_KEYS.map((key) => (
                    <MetricComparisonRow key={key} metricKey={key} entry={comparison[key]} />
                  ))}
                </div>
              </details>
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
