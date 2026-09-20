"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
    <Card id="scenario-lab">
      <div className="flex flex-wrap gap-2 px-4 pt-4">
        {SUPPORTED_SCENARIOS.map((scenario) => (
          <Button
            key={scenario.value}
            type="button"
            size="sm"
            variant={selected === scenario.value ? "default" : "outline"}
            className={cn(selected !== scenario.value && "text-muted-foreground")}
            onClick={() => setSelected(scenario.value)}
          >
            {scenario.label}
          </Button>
        ))}
      </div>

      {selected === "operating_cost" && <OperatingCostScenarioLab companyId={companyId} />}
      {selected === "collection_period" && <CollectionPeriodScenarioLab companyId={companyId} />}
      {selected === "compare" && <ScenarioComparisonLab companyId={companyId} />}
    </Card>
  );
}
