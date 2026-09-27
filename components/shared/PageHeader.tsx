import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Contexto curto acima do título (ex.: "Visão executiva", "Empresa"). */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Metadados discretos abaixo da descrição (datas, identificadores). */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Mission 203 — cabeçalho canônico de página. Um único `h1` por página,
 * hierarquia fixa (eyebrow → título → descrição → metadados) e ações à
 * direita. Nenhuma página inventa o próprio cabeçalho.
 */
export function PageHeader({ eyebrow, title, description, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <p className="type-eyebrow">{eyebrow}</p>}
        <h1 className="type-page-title text-balance">{title}</h1>
        {description && <p className="type-body max-w-2xl text-pretty">{description}</p>}
        {meta && <div className="type-meta flex flex-wrap items-center gap-x-3 gap-y-1">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
