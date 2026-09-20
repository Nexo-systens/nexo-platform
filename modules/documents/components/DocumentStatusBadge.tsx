import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/types/database";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  uploaded: "Disponível",
  processing: "Processando",
  processed: "Processado",
  failed: "Falhou",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "failed"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : status === "processed"
            ? "border-success/30 bg-success/10 text-success"
            : "border-border bg-muted text-muted-foreground"
      )}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}
