import { CheckCircle2, FileWarning, Sparkles, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Callout } from "@/components/shared/Callout";
import type { SemanticTone } from "@/modules/analysis/lib/insight-semantics";
import type { ActivationState } from "@/modules/activation/resolveActivationState";

const STATE: Record<ActivationState, { icon: LucideIcon; tone: SemanticTone }> = {
  no_documents: { icon: UploadCloud, tone: "neutral" },
  documents_not_analyzable: { icon: FileWarning, tone: "warning" },
  ready_for_analysis: { icon: Sparkles, tone: "info" },
  analysis_available: { icon: Sparkles, tone: "info" },
  diagnosis_available: { icon: CheckCircle2, tone: "positive" },
};

/**
 * Mission 195 (Seção 36) — orientação de ativação, derivada só do estado
 * canônico (`resolveActivationState()`). Mission 203: apresentada como
 * "próximo passo", com tom semântico; some quando a empresa já tem
 * diagnóstico (nenhuma orientação de onboarding para empresa madura).
 */
export function ActivationGuidanceCard({
  state,
  description,
  primaryAction,
}: {
  state: ActivationState;
  description: string;
  primaryAction?: string;
}) {
  if (state === "diagnosis_available") return null;

  const { icon, tone } = STATE[state];

  return (
    <Callout tone={tone} icon={icon} title={primaryAction ? `Próximo passo: ${primaryAction}` : "Próximo passo"}>
      {description}
    </Callout>
  );
}
