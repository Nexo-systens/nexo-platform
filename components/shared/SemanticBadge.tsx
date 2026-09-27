import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { SemanticTone } from "@/modules/analysis/lib/insight-semantics";

const TONE_CLASSES: Readonly<Record<SemanticTone, string>> = {
  neutral: "border-border bg-surface-subtle text-foreground-secondary",
  info: "border-info/20 bg-info-soft text-info-soft-foreground",
  positive: "border-positive/20 bg-positive-soft text-positive-soft-foreground",
  warning: "border-warning/30 bg-warning-soft text-warning-soft-foreground",
  negative: "border-negative/25 bg-negative-soft text-negative-soft-foreground",
};

/**
 * Mission 203 — rótulo de status com tom semântico e texto sempre em
 * português (nunca o valor cru de um enum do domínio).
 */
export function SemanticBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: SemanticTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[0.6875rem] leading-none font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
