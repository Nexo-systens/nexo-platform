import { SemanticBadge } from "@/components/shared/SemanticBadge";
import type { CompanyStatus } from "@/types/database";

const STATUS: Record<CompanyStatus, { label: string; tone: "positive" | "neutral" }> = {
  active: { label: "Ativa", tone: "positive" },
  archived: { label: "Arquivada", tone: "neutral" },
};

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  return <SemanticBadge tone={STATUS[status].tone}>{STATUS[status].label}</SemanticBadge>;
}
