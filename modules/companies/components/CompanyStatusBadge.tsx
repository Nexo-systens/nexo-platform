import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CompanyStatus } from "@/types/database";

const STATUS_LABEL: Record<CompanyStatus, string> = {
  active: "Ativa",
  archived: "Arquivada",
};

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "active"
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}
