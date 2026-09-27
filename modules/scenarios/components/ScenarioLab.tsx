"use client";

import { useState } from "react";

import { SectionShell } from "@/components/shared/SectionShell";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CollectionPeriodScenarioLab } from "@/modules/scenarios/components/CollectionPeriodScenarioLab";
import { OperatingCostScenarioLab } from "@/modules/scenarios/components/OperatingCostScenarioLab";
import { ScenarioComparisonLab } from "@/modules/scenarios/components/ScenarioComparisonLab";

const SUPPORTED_SCENARIOS = [
  { value: "operating_cost", label: "Despesas operacionais" },
  { value: "collection_period", label: "Prazo de recebimento" },
  { value: "compare", label: "Comparar cenários" },
] as const;
type SupportedScenario = (typeof SUPPORTED_SCENARIOS)[number]["value"];

/**
 * Mission 182 — Scenario Engine Generalization & Second Financial
 * Vertical. Estendida pela Mission 183 — Executive Scenario Comparison
 * (Seção 24).
 *
 * Casca do Scenario Lab (Seção 22 da Mission 182): "escolher simulação
 * suportada → formulário explícito para essa simulação → resultado" —
 * nunca um framework de formulário dinâmico/genérico. Exatamente 3
 * opções suportadas, cada uma seu próprio componente hardcoded
 * (`OperatingCostScenarioLab`/`CollectionPeriodScenarioLab`/
 * `ScenarioComparisonLab`) — nenhuma UI construída para uma vertical
 * inexistente. A capacidade de rodar um único cenário (Mission 181/182)
 * é preservada integralmente — comparar nunca é obrigatório (Seção 27
 * da Mission 183: "Do not force users into comparison mode").
 */
export function ScenarioLab({ companyId }: { companyId: string }) {
  const [selected, setSelected] = useState<SupportedScenario>("operating_cost");

  return (
    <SectionShell
      id="scenario-lab"
      eyebrow="Cenários"
      title="Scenario Lab"
      description="Explore alternativas a partir da última análise: a base, o cenário e a diferença — antes de levar uma escolha para decisão."
    >
      <Card className="gap-0 py-0">
        <div
          role="tablist"
          aria-label="Tipo de simulação"
          className="flex flex-wrap gap-1 border-b border-border bg-surface-subtle px-3 py-2"
        >
          {SUPPORTED_SCENARIOS.map((scenario) => {
            const isSelected = selected === scenario.value;
            return (
              <button
                key={scenario.value}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelected(scenario.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[0.8125rem] transition-colors duration-150",
                  isSelected
                    ? "bg-surface font-medium text-foreground shadow-xs ring-1 ring-border"
                    : "text-foreground-secondary hover:bg-surface hover:text-foreground"
                )}
              >
                {scenario.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 py-5" role="tabpanel">
          {selected === "operating_cost" && <OperatingCostScenarioLab companyId={companyId} />}
          {selected === "collection_period" && <CollectionPeriodScenarioLab companyId={companyId} />}
          {selected === "compare" && <ScenarioComparisonLab companyId={companyId} />}
        </div>
      </Card>
    </SectionShell>
  );
}
