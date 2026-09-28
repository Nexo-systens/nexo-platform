import { SemanticBadge } from "@/components/shared/SemanticBadge";
import {
  INSIGHT_KIND_META,
  type InsightKind,
  type SemanticTag,
} from "@/modules/analysis/lib/insight-semantics";

export interface InsightItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Rótulos já traduzidos (severidade, confiança, prioridade) — nunca o enum cru. */
  readonly tags: readonly SemanticTag[];
  // "Ver origem" (Mission 109) — opcional: só Evidence passa isso hoje.
  // Ausente para Context/Reasoning/Recommendation/Decision (nenhum
  // deles carrega `EvidenceSource[]` rastreável).
  readonly onViewSource?: () => void;
}

interface InsightListProps {
  kind: InsightKind;
  items: readonly InsightItem[];
  emptyMessage: string;
}

const KIND_VAR: Readonly<Record<InsightKind, string>> = {
  statement: "--kind-fact",
  indicator: "--kind-fact",
  evidence: "--kind-evidence",
  interpretation: "--kind-interpretation",
  hypothesis: "--kind-hypothesis",
  recommendation: "--kind-recommendation",
  decision: "--kind-decision",
};

/**
 * Lista de insights de UMA natureza (Mission 203). Apenas exibe campos
 * já existentes na entidade — nenhuma interpretação nova. A marca
 * lateral separa visualmente o que é sabido (traço cheio: evidência)
 * do que é inferido (traço pontilhado: interpretação, hipótese,
 * recomendação, proposta de decisão).
 */
export function InsightList({ kind, items, emptyMessage }: InsightListProps) {
  if (items.length === 0) {
    return <p className="type-meta">{emptyMessage}</p>;
  }

  const inferred = INSIGHT_KIND_META[kind].layer === "inferred";
  const color = `var(${KIND_VAR[kind]})`;
  const accent = inferred
    ? { backgroundImage: `repeating-linear-gradient(to bottom, ${color} 0 4px, transparent 4px 7px)` }
    : { backgroundColor: color };

  return (
    <ul className="flex flex-col divide-y divide-border border-y border-border">
      {items.map((item) => (
        <li
          key={item.id}
          className="relative flex flex-col gap-1.5 py-3.5 pr-1 pl-5"
        >
          <span aria-hidden="true" className="absolute inset-y-4 left-1 w-0.5 rounded-full" style={accent} />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <SemanticBadge key={tag.label} tone={tag.tone}>
                    {tag.label}
                  </SemanticBadge>
                ))}
              </div>
            )}
          </div>
          <p className="type-body text-pretty">{item.description}</p>
          {item.onViewSource && (
            <button
              type="button"
              className="self-start text-[0.75rem] text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-primary hover:underline"
              onClick={item.onViewSource}
            >
              Ver origem
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
