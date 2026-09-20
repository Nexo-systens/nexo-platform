import { CheckCircle2, FileWarning, Sparkles, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { ActivationState } from "@/modules/activation/resolveActivationState";

const STATE_ICON: Record<ActivationState, LucideIcon> = {
  no_documents: UploadCloud,
  documents_not_analyzable: FileWarning,
  ready_for_analysis: Sparkles,
  analysis_available: Sparkles,
  diagnosis_available: CheckCircle2,
};

/**
 * Mission 195 — Founding Company Production Onboarding & First
 * Executive Value, Seção 6/8/9/12/23/38. Único ponto de orientação
 * contextual da jornada de ativação — nunca um tutorial de múltiplas
 * páginas (Seção 38: "keep guidance contextual... Do not build a
 * multi-page tutorial"), apenas uma frase do estado atual mais a
 * PRÓXIMA ação, derivadas puramente por `resolveActivationState()`
 * (nenhum texto novo inventado aqui, apenas apresentação). Nunca
 * renderizado no estado `diagnosis_available` — uma empresa madura já
 * tem sua própria interface falando por si (Seção 60: nenhuma
 * "completude" fabricada quando não há nada de útil a orientar).
 */
export function ActivationGuidanceCard({
  state,
  description,
}: {
  state: ActivationState;
  description: string;
}) {
  if (state === "diagnosis_available") return null;

  const Icon = STATE_ICON[state];

  return (
    <Card className="border-border bg-muted/30">
      <CardContent className="flex items-start gap-3 py-4">
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
