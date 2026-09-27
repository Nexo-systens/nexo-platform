import { cn } from "@/lib/utils";

/**
 * Mission 203 — "indisponível" nunca é "0". Quando um valor não pode ser
 * determinado (dado insuficiente, análise ausente, contrato que não
 * fornece o dado), a interface diz isso explicitamente, com a razão
 * quando ela é conhecida — nunca mostra um zero no lugar.
 */
export function UnavailableValue({
  reason,
  className,
  compact = false,
}: {
  reason?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)}>
      <span className={cn("font-medium text-muted-foreground", compact ? "text-sm" : "text-base")}>Indisponível</span>
      {reason && !compact && <span className="type-meta text-pretty">{reason}</span>}
    </span>
  );
}
