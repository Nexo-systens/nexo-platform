import type { ExecutiveReportSectionType } from "@/efos/application/report";

/**
 * Mission 203 — hierarquia epistêmica da apresentação (docs/DESIGN_SYSTEM.md,
 * princípio "Financial hierarchy").
 *
 * O `ExecutiveReport` já chega com seções de naturezas diferentes. A UI
 * precisa deixar evidente, em segundos, o que a NEXO SABE (valores dos
 * documentos, indicadores calculados, evidências rastreáveis) e o que o
 * EFOS INFERE (interpretação, hipótese, recomendação, proposta de
 * decisão). Este módulo só NOMEIA a natureza de cada seção e traduz os
 * enums do domínio para português executivo — nunca reclassifica,
 * reordena ou recalcula nada (a ordem continua a de `report.sections`).
 */

export type InsightKind =
  | "statement"
  | "indicator"
  | "evidence"
  | "interpretation"
  | "hypothesis"
  | "recommendation"
  | "decision";

/** "known": fato documental, cálculo ou evidência rastreável. "inferred": leitura do EFOS. */
export type InsightLayer = "known" | "inferred";

export interface InsightKindMeta {
  readonly label: string;
  readonly layer: InsightLayer;
  /** Uma frase curta que explica ao executivo a natureza do bloco. */
  readonly description: string;
}

export const INSIGHT_KIND_META: Readonly<Record<InsightKind, InsightKindMeta>> = {
  statement: {
    label: "Dado do documento",
    layer: "known",
    description: "Valores lidos dos demonstrativos enviados.",
  },
  indicator: {
    label: "Indicador calculado",
    layer: "known",
    description: "Calculado deterministicamente a partir dos dados; indisponível quando falta dado.",
  },
  evidence: {
    label: "Evidência",
    layer: "known",
    description: "Fato identificado por regra determinística, com origem rastreável.",
  },
  interpretation: {
    label: "Interpretação",
    layer: "inferred",
    description: "Leitura do EFOS que agrupa evidências relacionadas numa situação.",
  },
  hypothesis: {
    label: "Hipótese",
    layer: "inferred",
    description: "Conclusão provável a partir das interpretações — não é um fato contábil.",
  },
  recommendation: {
    label: "Recomendação",
    layer: "inferred",
    description: "Ação sugerida pelo EFOS para avaliação executiva.",
  },
  decision: {
    label: "Proposta de decisão",
    layer: "inferred",
    description: "Priorização proposta pelo EFOS. A decisão final é sempre da empresa.",
  },
};

export const INSIGHT_LAYER_LABELS: Readonly<Record<InsightLayer, { title: string; description: string }>> = {
  known: {
    title: "O que sabemos",
    description: "Dados dos documentos, indicadores calculados e evidências com origem rastreável.",
  },
  inferred: {
    title: "O que o EFOS infere",
    description: "Interpretações, hipóteses e propostas — apoio à decisão, não fatos contábeis.",
  },
};

const SECTION_KIND: Readonly<Record<ExecutiveReportSectionType, InsightKind>> = {
  balanceSheet: "statement",
  incomeStatement: "statement",
  cashFlow: "statement",
  financialHealth: "indicator",
  financialRisk: "indicator",
  kpi: "indicator",
  indicators: "indicator",
  evidence: "evidence",
  context: "interpretation",
  reasoning: "hypothesis",
  recommendation: "recommendation",
  decision: "decision",
};

export function sectionKind(type: ExecutiveReportSectionType): InsightKind {
  return SECTION_KIND[type];
}

export function sectionLayer(type: ExecutiveReportSectionType): InsightLayer {
  return INSIGHT_KIND_META[SECTION_KIND[type]].layer;
}

/** Tom visual de um rótulo: nunca decorativo, sempre ligado ao significado. */
export type SemanticTone = "neutral" | "info" | "positive" | "warning" | "negative";

export interface SemanticTag {
  readonly label: string;
  readonly tone: SemanticTone;
}

const LEVEL_LABELS: Readonly<Record<string, string>> = {
  low: "baixa",
  medium: "média",
  high: "alta",
  critical: "crítica",
  verified: "verificada",
  weak: "fraca",
  moderate: "moderada",
  very_high: "muito alta",
};

/** Valor desconhecido nunca vaza cru em inglês com sublinhado. */
function humanize(value: string): string {
  return LEVEL_LABELS[value] ?? value.replace(/_/g, " ");
}

const SEVERITY_TONE: Readonly<Record<string, SemanticTone>> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "negative",
};

export function severityTag(severity: string): SemanticTag {
  return { label: `Severidade ${humanize(severity)}`, tone: SEVERITY_TONE[severity] ?? "neutral" };
}

export function confidenceTag(confidence: string): SemanticTag {
  return { label: `Confiança ${humanize(confidence)}`, tone: "neutral" };
}

const PRIORITY_TONE: Readonly<Record<string, SemanticTone>> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "negative",
};

export function priorityTag(priority: string): SemanticTag {
  return { label: `Prioridade ${humanize(priority)}`, tone: PRIORITY_TONE[priority] ?? "neutral" };
}
