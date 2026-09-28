import type { ExecutiveReport } from "@/efos/application/report";

/**
 * Mission 204 — proveniência legível do diagnóstico executivo.
 *
 * O diagnóstico cita a base de cada afirmação por id técnico
 * (`indicator-financial-model-<uuid>-liquidez-corrente`). Para o
 * executivo, a base é "Liquidez Corrente", "Margem Líquida negativa",
 * "Rentabilidade comprometida". Este módulo só TRADUZ ids em nomes, a
 * partir do relatório da própria análise que originou o diagnóstico e do
 * conhecimento já formado — nunca inventa uma referência. Id que não é
 * encontrado continua sinalizado como tal (nunca vira outro nome).
 */

export type ReferenceKind = "indicator" | "evidence" | "context" | "conflict" | "knowledge";

export const REFERENCE_KIND_LABELS: Readonly<Record<ReferenceKind, string>> = {
  indicator: "Indicador",
  evidence: "Evidência",
  context: "Interpretação do EFOS",
  conflict: "Conflito",
  knowledge: "Conhecimento histórico",
};

export interface ReferenceLabel {
  readonly kind: ReferenceKind;
  readonly label: string;
  /** `false` quando o id não foi encontrado na análise de origem. */
  readonly resolved: boolean;
}

export type ReferenceLabels = ReadonlyMap<string, string>;

export function buildReferenceLabels(
  report: ExecutiveReport | undefined,
  knowledge: readonly { readonly id: string; readonly statement: string }[] = []
): ReferenceLabels {
  const labels = new Map<string, string>();
  for (const section of report?.sections ?? []) {
    switch (section.type) {
      case "indicators":
        for (const indicator of section.indicators.indicators) labels.set(indicator.id, indicator.name);
        break;
      case "evidence":
        for (const evidence of section.evidence.evidences) labels.set(evidence.id, evidence.title);
        break;
      case "context":
        for (const context of section.context.contexts) labels.set(context.id, context.title);
        break;
      default:
        break;
    }
  }
  for (const record of knowledge) labels.set(record.id, record.statement);
  return labels;
}

export function resolveReference(labels: ReferenceLabels, kind: ReferenceKind, id: string): ReferenceLabel {
  const label = labels.get(id);
  return label
    ? { kind, label, resolved: true }
    : { kind, label: `${REFERENCE_KIND_LABELS[kind]} não localizado na análise de origem`, resolved: false };
}

export const CONFIDENCE_LABELS: Readonly<Record<string, string>> = {
  low: "Confiança baixa",
  medium: "Confiança média",
  high: "Confiança alta",
};

export const ACTION_KIND_LABELS: Readonly<Record<string, string>> = {
  POSSIBLE_ACTION: "Ação possível",
  OPTION: "Opção",
  INVESTIGATE: "Investigar",
  CONSIDER: "Considerar",
  VALIDATE: "Validar",
};

export const QUESTION_ORIGIN_LABELS: Readonly<Record<string, string>> = {
  unknown: "Dado ausente",
  uncertainty: "Incerteza",
  conflict: "Conflito",
  hypothesis: "Hipótese",
};
