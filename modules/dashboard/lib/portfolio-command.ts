import type { ExecutiveSituation, HeadlineMetric, SituationSignal } from "@/modules/analysis/lib/executive-situation";
import type { CompanyOverview } from "@/modules/dashboard/lib/executive-overview";
import type { DecisionCenterSummary } from "@/modules/decisions/services/decision-center.service";

/**
 * Mission 204 — Visão executiva como superfície de comando.
 *
 * Função pura sobre o que o EFOS já produziu por empresa (situação da
 * última análise × anterior, sinais, fila de decisões). Nenhum juízo
 * novo: "piorou/melhorou" é a contagem das métricas que o próprio EFOS
 * classifica (D-087); as prioridades são as evidências mais graves que
 * os Engines emitiram. Empresa sem análise continua "sem análise" —
 * nunca zero.
 */

export interface CompanyCommandInput {
  readonly company: CompanyOverview;
  readonly situation?: ExecutiveSituation;
  readonly decisions?: DecisionCenterSummary | null;
}

export interface PortfolioRow {
  readonly company: CompanyOverview;
  readonly periodShort?: string;
  readonly netMargin?: HeadlineMetric;
  readonly currentLiquidity?: HeadlineMetric;
  readonly pendingDecisions: number;
  readonly trend: "worsening" | "improving" | "mixed" | "stable" | "unknown";
}

export interface PortfolioPriority {
  readonly companyId: string;
  readonly companyName: string;
  readonly href: string;
  readonly signal: SituationSignal;
}

export interface PortfolioCommand {
  readonly headline: string;
  readonly rows: readonly PortfolioRow[];
  readonly priorities: readonly PortfolioPriority[];
  readonly pendingDecisions: number;
}

const SEVERITY_RANK: Readonly<Record<string, number>> = {
  "Severidade crítica": 0,
  "Severidade alta": 1,
  "Severidade média": 2,
  "Severidade baixa": 3,
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function trendOf(situation: ExecutiveSituation | undefined): PortfolioRow["trend"] {
  if (!situation?.movement) return "unknown";
  const { improved, worsened } = situation.movement;
  if (improved === 0 && worsened === 0) return "stable";
  if (worsened > 0 && improved === 0) return "worsening";
  if (improved > 0 && worsened === 0) return "improving";
  return worsened > improved ? "worsening" : improved > worsened ? "improving" : "mixed";
}

export function buildPortfolioCommand(inputs: readonly CompanyCommandInput[], activeCount: number): PortfolioCommand {
  const rows: PortfolioRow[] = inputs.map(({ company, situation, decisions }) => ({
    company,
    periodShort: situation?.period?.short,
    netMargin: situation?.headline.find((metric) => metric.name === "Margem Líquida"),
    currentLiquidity: situation?.headline.find((metric) => metric.name === "Liquidez Corrente"),
    pendingDecisions: decisions?.pending ?? 0,
    trend: trendOf(situation),
  }));

  const priorities: PortfolioPriority[] = inputs
    .flatMap(({ company, situation }) =>
      (situation?.signals ?? [])
        .filter((signal) => !signal.favorable)
        .map((signal) => ({ companyId: company.id, companyName: company.name, href: `${company.href}?secao=analise`, signal }))
    )
    .sort((a, b) => (SEVERITY_RANK[a.signal.tag.label] ?? 9) - (SEVERITY_RANK[b.signal.tag.label] ?? 9));

  const worsening = rows.filter((row) => row.trend === "worsening").length;
  const improving = rows.filter((row) => row.trend === "improving").length;
  const withoutAnalysis = rows.filter((row) => !row.company.lastAnalysisAt).length;
  const pendingDecisions = rows.reduce((total, row) => total + row.pendingDecisions, 0);

  const parts: string[] = [];
  const movementParts: string[] = [];
  if (worsening > 0) movementParts.push(plural(worsening, "piorou", "pioraram"));
  if (improving > 0) movementParts.push(plural(improving, "melhorou", "melhoraram"));
  parts.push(
    movementParts.length > 0
      ? `Das ${plural(activeCount, "empresa ativa", "empresas ativas")}, ${movementParts.join(" e ")} desde a análise anterior.`
      : `${plural(activeCount, "empresa ativa", "empresas ativas")}, sem mudança de direção desde a análise anterior.`
  );
  if (withoutAnalysis > 0) {
    parts.push(`${plural(withoutAnalysis, "ainda não tem análise", "ainda não têm análise")}.`);
  }
  parts.push(
    pendingDecisions > 0
      ? `${plural(pendingDecisions, "item aguarda", "itens aguardam")} sua decisão.`
      : "Nenhum item aguarda decisão agora."
  );

  return { headline: parts.join(" "), rows, priorities, pendingDecisions };
}
