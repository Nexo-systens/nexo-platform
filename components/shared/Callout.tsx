import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { SemanticTone } from "@/modules/analysis/lib/insight-semantics";

const TONE_STYLES: Readonly<Record<SemanticTone, { box: string; icon: string; Icon: LucideIcon }>> = {
  neutral: { box: "border-border bg-surface-subtle", icon: "text-muted-foreground", Icon: Info },
  info: { box: "border-info/25 bg-info-soft", icon: "text-info", Icon: Info },
  positive: { box: "border-positive/25 bg-positive-soft", icon: "text-positive", Icon: CheckCircle2 },
  warning: { box: "border-warning/35 bg-warning-soft", icon: "text-warning-soft-foreground", Icon: AlertTriangle },
  negative: { box: "border-negative/30 bg-negative-soft", icon: "text-negative", Icon: OctagonAlert },
};

interface CalloutProps {
  tone?: SemanticTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

/**
 * Mission 203 — aviso contextual com tom semântico (substitui cores
 * soltas como `amber-500` espalhadas pelos componentes). O tom comunica
 * significado (atenção, problema, confirmação), nunca decoração.
 */
export function Callout({ tone = "neutral", title, children, icon, className }: CalloutProps) {
  const style = TONE_STYLES[tone];
  const Icon = icon ?? style.Icon;

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", style.box, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.icon)} aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className="text-foreground-secondary">{children}</div>}
      </div>
    </div>
  );
}
