import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** Falha ao carregar ou executar — nunca mostra texto interno (D-129). */
export function ErrorState({
  title = "Algo deu errado",
  description = "Não foi possível carregar esta informação. Tente novamente.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-negative/25 bg-negative-soft/50 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full border border-negative/25 bg-surface">
        <AlertTriangle className="size-5 text-negative" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="type-subsection-title">{title}</p>
        <p className="type-body max-w-md text-pretty">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
