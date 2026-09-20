import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface InsightItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly badges: readonly string[];
  // "Ver origem" (Mission 109) — opcional: só Evidence passa isso hoje.
  // Ausente para Context/Reasoning/Recommendation/Decision (nenhum
  // deles carrega `EvidenceSource[]` rastreável).
  readonly onViewSource?: () => void;
}

interface InsightListProps {
  items: readonly InsightItem[];
  emptyMessage: string;
}

// Lista de cartoes de insight (Evidencia/Contexto/Raciocinio/
// Recomendacao/Decisao) — apenas exibe campos ja existentes na
// entidade (title/description/severity/confidence/priority), nenhuma
// interpretacao nova e feita aqui.
export function InsightList({ items, emptyMessage }: InsightListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              {item.title}
            </span>
            <div className="flex flex-wrap gap-1">
              {item.badges.map((badge) => (
                <Badge key={badge} variant="outline">
                  {badge}
                </Badge>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{item.description}</p>
          {item.onViewSource && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto self-start px-0 text-xs font-normal text-muted-foreground underline-offset-2 hover:underline"
              onClick={item.onViewSource}
            >
              Ver origem
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
