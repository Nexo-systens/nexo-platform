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
import type { FinancialStateCategory } from "@/efos/domain";
import { INDICATOR_DEFINITIONS } from "@/efos/engines/indicators";
import type { ExecutiveScenarioComparison } from "@/efos/application/scenario-simulation";
import { formatIndicatorValue } from "@/lib/format-indicator";
import { cn } from "@/lib/utils";
import type { ScenarioRequest } from "@/modules/scenarios/actions/scenario-simulation.actions";
import { compareScenariosAction } from "@/modules/scenarios/actions/scenario-simulation.actions";
import { ScenarioDecisionForm } from "@/modules/scenarios/components/ScenarioDecisionForm";
import type { ScenarioBaselineIdentity } from "@/modules/scenarios/lib/scenarioBaselineIdentity";
import {
  COLLECTION_PERIOD_DIRECTIONS,
  COLLECTION_PERIOD_DIRECTION_LABELS,
  OPERATING_COST_DIRECTIONS,
  OPERATING_COST_DIRECTION_LABELS,
  SCENARIO_IMPACT_TONE_CLASSNAME,
  describeScenarioAssumption,
  formatScenarioMetricDelta,
  toSignedAmountForDirection,
  toSignedDeltaDaysForDirection,
  type CollectionPeriodDirection,
  type OperatingCostDirection,
} from "@/modules/scenarios/lib/scenario-language";

type SlotKind = ScenarioRequest["kind"];

const SLOT_KIND_OPTIONS: readonly { readonly value: SlotKind; readonly label: string }[] = [
  { value: "operating_cost_change", label: "Despesas operacionais" },
  { value: "collection_period_change", label: "Prazo de recebimento" },
];

interface SlotState {
  readonly kind: SlotKind;
  readonly opexDirection: OperatingCostDirection | "";
  readonly opexAmountInput: string;
  readonly collectionDirection: CollectionPeriodDirection | "";
  readonly collectionDaysInput: string;
}

const EMPTY_SLOT: SlotState = {
  kind: "operating_cost_change",
  opexDirection: "",
  opexAmountInput: "",
  collectionDirection: "",
  collectionDaysInput: "",
};

function slotToRequest(slot: SlotState): ScenarioRequest | undefined {
  if (slot.kind === "operating_cost_change") {
    const amount = Number(slot.opexAmountInput.replace(",", "."));
    if (!slot.opexDirection || slot.opexAmountInput.trim() === "" || !Number.isFinite(amount) || amount <= 0) {
      return undefined;
    }
    return {
      kind: "operating_cost_change",
      operatingExpensesDeltaAmount: toSignedAmountForDirection(slot.opexDirection, amount),
      operatingExpensesDeltaCurrency: "BRL",
    };
  }

  const days = Number(slot.collectionDaysInput.replace(",", "."));
  if (
    !slot.collectionDirection ||
    slot.collectionDaysInput.trim() === "" ||
    !Number.isFinite(days) ||
    days <= 0
  ) {
    return undefined;
  }
  return {
    kind: "collection_period_change",
    collectionPeriodDeltaDays: toSignedDeltaDaysForDirection(slot.collectionDirection, days),
  };
}

function ScenarioSlotFields({
  label,
  slot,
  onChange,
}: {
  label: string;
  slot: SlotState;
  onChange: (next: SlotState) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>

      <div className="flex flex-col gap-1.5">
        <Label>Tipo de simulação</Label>
        <Select value={slot.kind} onValueChange={(value) => onChange({ ...EMPTY_SLOT, kind: value as SlotKind })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SLOT_KIND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {slot.kind === "operating_cost_change" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Direção</Label>
            <Select
              value={slot.opexDirection}
              onValueChange={(value) => onChange({ ...slot, opexDirection: value as OperatingCostDirection })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
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
            <Label>Valor (R$)</Label>
            <Input
              inputMode="decimal"
              placeholder="20.000"
              value={slot.opexAmountInput}
              onChange={(event) => onChange({ ...slot, opexAmountInput: event.target.value })}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Direção</Label>
            <Select
              value={slot.collectionDirection}
              onValueChange={(value) =>
                onChange({ ...slot, collectionDirection: value as CollectionPeriodDirection })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
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
            <Label>Dias</Label>
            <Input
              inputMode="numeric"
              placeholder="15"
              value={slot.collectionDaysInput}
              onChange={(event) => onChange({ ...slot, collectionDaysInput: event.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const CATEGORY_LABELS: Partial<Record<FinancialStateCategory, string>> = {
  profitability: "Rentabilidade",
  liquidity: "Liquidez",
  debt: "Dívida",
  efficiency: "Eficiência",
};

function groupMetricsByCategory(
  metrics: ExecutiveScenarioComparison["metrics"]
): readonly { readonly category: string; readonly metrics: ExecutiveScenarioComparison["metrics"] }[] {
  const order: string[] = [];
  const groups = new Map<string, ExecutiveScenarioComparison["metrics"][number][]>();

  for (const metric of metrics) {
    const category =
      (INDICATOR_DEFINITIONS as Record<string, { category: FinancialStateCategory } | undefined>)[
        metric.metricKey
      ]?.category ?? "profitability";
    const label = CATEGORY_LABELS[category] ?? category;
    if (!groups.has(label)) {
      order.push(label);
      groups.set(label, []);
    }
    groups.get(label)?.push(metric);
  }

  return order.map((category) => ({ category, metrics: groups.get(category) ?? [] }));
}

/**
 * Mission 183 — Executive Scenario Comparison.
 *
 * "Como as consequências financeiras de decisões alternativas se
 * comparam?" (Seção 3) — nunca "qual devo escolher?" (Seção 3/9/10):
 * nenhuma pontuação, nenhum peso, nenhum vencedor automático em nenhum
 * lugar deste componente.
 *
 * Fluxo (Seção 24): configurar Cenário A → configurar Cenário B →
 * Comparar → ver baseline + os dois resultados. `compareScenariosAction()`
 * (Mission 183) resolve o baseline UMA ÚNICA VEZ no servidor para os
 * dois cenários (Seção 22/23) — React nunca escolhe/resolve baseline,
 * nunca calcula nada financeiro, apenas coleta as duas premissas e
 * formata o `ExecutiveScenarioComparison` já pronto.
 *
 * Cada linha de indicador mostra base → Cenário A (valor/delta/impacto)
 * → Cenário B (valor/delta/impacto), agrupadas por categoria já
 * canônica (`INDICATOR_DEFINITIONS.category`, D-093 — nunca uma
 * taxonomia nova). Um indicador afetado por só um dos dois cenários
 * ainda aparece para o outro com delta zero (Seção 18 — fronteira
 * causal visível, nunca escondida).
 *
 * Desde a Mission 184 (Scenario-to-Decision Governance Bridge), depois
 * de comparar, um botão explícito por cenário ("Levar Cenário A/B para
 * decisão", nunca "Aprovar cenário recomendado" — não existe
 * vencedor) revela `ScenarioDecisionForm`, formalizando o cenário
 * ESCOLHIDO pelo executivo como contexto hipotético de uma `Decision`
 * humana real, preservando a alternativa NÃO escolhida apenas como
 * contexto de trade-off — nunca convertida em uma segunda `Decision`.
 */
export function ScenarioComparisonLab({ companyId }: { companyId: string }) {
  const [slotA, setSlotA] = useState<SlotState>({ ...EMPTY_SLOT, kind: "operating_cost_change" });
  const [slotB, setSlotB] = useState<SlotState>({ ...EMPTY_SLOT, kind: "collection_period_change" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [comparison, setComparison] = useState<ExecutiveScenarioComparison | undefined>();
  /**
   * Mission 184 — Scenario-to-Decision Governance Bridge. Snapshot dos
   * `ScenarioRequest` que de fato produziram `comparison` — nunca
   * `requestA`/`requestB` recomputados ao vivo do estado atual dos
   * slots, que poderia ter divergido (usuário editou um campo) depois
   * de comparar mas antes de clicar "Levar para decisão". Garante que
   * a decisão formalizada sempre corresponde EXATAMENTE ao que está
   * sendo exibido na tela no momento do clique.
   */
  const [comparedRequests, setComparedRequests] = useState<readonly [ScenarioRequest, ScenarioRequest] | undefined>();
  const [baselineIdentity, setBaselineIdentity] = useState<ScenarioBaselineIdentity | undefined>();
  const [decisionSlot, setDecisionSlot] = useState<"A" | "B" | undefined>();

  const requestA = slotToRequest(slotA);
  const requestB = slotToRequest(slotB);
  const canCompare = requestA !== undefined && requestB !== undefined && !submitting;

  async function handleCompare() {
    if (!requestA || !requestB || submitting) return;

    setSubmitting(true);
    setError(undefined);
    setComparison(undefined);
    setComparedRequests(undefined);
    setBaselineIdentity(undefined);
    setDecisionSlot(undefined);

    try {
      const result = await compareScenariosAction({ companyId, scenarios: [requestA, requestB] });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setComparison(result.comparison);
      setComparedRequests([requestA, requestB]);
      setBaselineIdentity(result.baselineIdentity);
    } catch {
      setError("Erro inesperado ao comparar os cenários. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const groups = comparison ? groupMetricsByCategory(comparison.metrics) : [];

  return (
    <>
      <CardHeader>
        <CardTitle className="text-base">Comparar cenários</CardTitle>
        <CardDescription>
          Compare as consequências financeiras de duas alternativas a partir da mesma verdade financeira atual.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ScenarioSlotFields label="Cenário A" slot={slotA} onChange={setSlotA} />
          <ScenarioSlotFields label="Cenário B" slot={slotB} onChange={setSlotB} />
        </div>

        <Button onClick={handleCompare} disabled={!canCompare} className="w-fit">
          {submitting ? "Comparando..." : "Comparar"}
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {comparison && (
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cenário A
                </span>
                <p className="text-sm text-foreground">
                  {describeScenarioAssumption(comparison.scenarios[0].assumption)}
                </p>
              </div>
              <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cenário B
                </span>
                <p className="text-sm text-foreground">
                  {describeScenarioAssumption(comparison.scenarios[1].assumption)}
                </p>
              </div>
            </div>

            {groups.map((group) => (
              <div key={group.category} className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.category}
                </span>
                <div className="flex flex-col gap-2">
                  {group.metrics.map((metric) => (
                    <div key={metric.metricKey} className="rounded-md border border-border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{metric.label}</span>
                        {metric.perScenario[0]?.status === "compared" && (
                          <span className="text-xs text-muted-foreground">
                            Base: {formatIndicatorValue(metric.perScenario[0].baselineValue, metric.unit)}
                          </span>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(["Cenário A", "Cenário B"] as const).map((scenarioLabel, index) => {
                          const entry = metric.perScenario[index];
                          if (!entry || entry.status === "unavailable") {
                            return (
                              <div key={scenarioLabel} className="text-xs text-muted-foreground">
                                {scenarioLabel}: indisponível
                              </div>
                            );
                          }
                          return (
                            <div key={scenarioLabel} className="flex items-center justify-between gap-2 text-sm">
                              <span className="text-xs text-muted-foreground">{scenarioLabel}</span>
                              <span
                                className={cn(
                                  "font-medium tabular-nums",
                                  SCENARIO_IMPACT_TONE_CLASSNAME[entry.impact]
                                )}
                              >
                                {formatIndicatorValue(entry.projectedValue, metric.unit)} (
                                {formatScenarioMetricDelta(entry.delta, metric.unit)})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="w-fit border-warning/30 bg-warning/10 text-warning">
                Comparação hipotética — não é uma previsão, nenhum vencedor é escolhido automaticamente
              </Badge>
              <p className="text-xs text-muted-foreground">{comparison.disclaimer}</p>
            </div>

            {comparedRequests && !decisionSlot && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="w-fit" onClick={() => setDecisionSlot("A")}>
                  Levar Cenário A para decisão
                </Button>
                <Button variant="outline" className="w-fit" onClick={() => setDecisionSlot("B")}>
                  Levar Cenário B para decisão
                </Button>
              </div>
            )}

            {comparedRequests && decisionSlot && baselineIdentity && (
              <ScenarioDecisionForm
                companyId={companyId}
                evaluatedBaselineIdentity={baselineIdentity}
                request={decisionSlot === "A" ? comparedRequests[0] : comparedRequests[1]}
                alternative={decisionSlot === "A" ? comparedRequests[1] : comparedRequests[0]}
                assumptionDescription={
                  decisionSlot === "A"
                    ? describeScenarioAssumption(comparison.scenarios[0].assumption)
                    : describeScenarioAssumption(comparison.scenarios[1].assumption)
                }
                alternativeDescription={
                  decisionSlot === "A"
                    ? describeScenarioAssumption(comparison.scenarios[1].assumption)
                    : describeScenarioAssumption(comparison.scenarios[0].assumption)
                }
                onCreated={() => setDecisionSlot(undefined)}
              />
            )}
          </div>
        )}
      </CardContent>
    </>
  );
}
