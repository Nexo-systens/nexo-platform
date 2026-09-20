import { DOCUMENT_GOVERNANCE_LABELS } from "@/app/api/efos/_shared/documentGovernance";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { readDocumentGovernance } from "@/modules/documents/utils/governance";
import type { DocumentStatus, Json } from "@/types/database";

/**
 * Mission 193 — Production Intake Governance & Permanent Regression
 * Gate, Seção 16. Desfecho de governança financeira MAIS RECENTE do
 * documento (aceito/duplicado/conflitante/requer revisão/etc.) —
 * DISTINTO do status técnico já exibido por `DocumentStatusBadge`
 * (Seção 5/15: "technical error" nunca é a mesma coisa que "financial
 * limitation"/"normal governance"). Ausente quando o documento nunca
 * foi avaliado por nenhuma análise ainda (`metadata` sem `governance`)
 * — nenhum badge é renderizado nesse caso, nunca um "desconhecido"
 * fabricado.
 *
 * Mission 193 Closure, Seção 21: `status` é sempre recebido junto —
 * quando `status === "processing"`, a governança exibida é
 * NECESSARIAMENTE de uma tentativa ANTERIOR (uma tentativa em
 * andamento nunca grava governança até terminar) — o rótulo deixa isso
 * explícito ("análise anterior") para nunca ser lido como o resultado
 * da tentativa ATIVA ("Do not show stale governance as if produced by
 * the active processing attempt").
 */
export function DocumentGovernanceBadge({
  metadata,
  status,
}: {
  metadata: Json;
  status: DocumentStatus;
}) {
  const governance = readDocumentGovernance(metadata);
  if (!governance) return null;

  const label = DOCUMENT_GOVERNANCE_LABELS[governance.outcome] ?? governance.outcome;
  const isStaleAttempt = status === "processing";

  return (
    <Badge
      variant="outline"
      title={
        isStaleAttempt
          ? `${governance.reason} (resultado da análise anterior — uma nova análise está em andamento)`
          : governance.reason
      }
      className={cn(
        isStaleAttempt
          ? "border-border bg-muted text-muted-foreground opacity-70"
          : governance.outcome === "same_period_conflict"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
            : governance.outcome === "needs_review"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
              : governance.outcome === "accepted"
                ? "border-success/30 bg-success/10 text-success"
                : "border-border bg-muted text-muted-foreground"
      )}
    >
      {isStaleAttempt ? `${label} (análise anterior)` : label}
    </Badge>
  );
}
