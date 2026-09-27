import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Versão compacta para dentro de seções (sem grande área vazia). */
  compact?: boolean;
}

/**
 * Estado vazio: ainda não existe nada aqui — diferente de "indisponível"
 * (dado que não pôde ser determinado) e de erro. Sempre diz o próximo
 * passo quando existe um.
 */
export function EmptyState({ icon: Icon, title, description, action, className, compact = false }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-subtle/60 px-6 text-center",
        compact ? "py-8" : "py-14",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full border border-border bg-surface">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="type-subsection-title">{title}</p>
        {description && <p className="type-body max-w-md text-pretty">{description}</p>}
      </div>
      {action}
    </div>
  );
}
