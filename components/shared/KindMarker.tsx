import { cn } from "@/lib/utils";
import { INSIGHT_KIND_META, type InsightKind } from "@/modules/analysis/lib/insight-semantics";

const KIND_COLOR: Readonly<Record<InsightKind, string>> = {
  statement: "bg-kind-fact",
  indicator: "bg-kind-fact",
  evidence: "bg-kind-evidence",
  interpretation: "bg-kind-interpretation",
  hypothesis: "bg-kind-hypothesis",
  recommendation: "bg-kind-recommendation",
  decision: "bg-kind-decision",
};

/** Barra lateral que marca a natureza de um bloco (usada por cartões de insight). */
export function kindAccentClass(kind: InsightKind): string {
  return KIND_COLOR[kind];
}

/**
 * Mission 203 — marcador da natureza da informação (fato, indicador,
 * evidência, interpretação, hipótese, recomendação, proposta de
 * decisão). A forma é a mesma; cor e rótulo mudam — o executivo
 * distingue "o que sabemos" de "o que inferimos" sem ler o conteúdo.
 * Inferências usam traço vazado (anel) em vez de ponto cheio.
 */
export function KindMarker({ kind, className }: { kind: InsightKind; className?: string }) {
  const meta = INSIGHT_KIND_META[kind];
  const inferred = meta.layer === "inferred";

  return (
    <span className={cn("inline-flex items-center gap-1.5 type-eyebrow", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-2 shrink-0 rounded-full",
          inferred ? "bg-transparent ring-2 ring-inset" : KIND_COLOR[kind],
          inferred && ringColor(kind)
        )}
      />
      {meta.label}
    </span>
  );
}

function ringColor(kind: InsightKind): string {
  switch (kind) {
    case "interpretation":
      return "ring-kind-interpretation";
    case "hypothesis":
      return "ring-kind-hypothesis";
    case "recommendation":
      return "ring-kind-recommendation";
    case "decision":
      return "ring-kind-decision";
    default:
      return "ring-kind-fact";
  }
}
