import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionShellProps {
  /** Âncora estável (links internos e navegação da empresa). */
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Mission 203 — moldura canônica de uma seção de trabalho (análise,
 * decisões, cenários, conversa, documentos...). Todas as capacidades do
 * workspace da empresa usam o mesmo enquadramento: rótulo de função,
 * título, uma frase de propósito e o conteúdo. `scroll-mt-32` deixa o
 * título visível ao navegar por âncora sob o cabeçalho fixo (3,5rem) e a
 * navegação de seções da empresa (3rem), com folga.
 */
export function SectionShell({ id, eyebrow, title, description, actions, children, className }: SectionShellProps) {
  const headingId = id ? `${id}-titulo` : undefined;

  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex scroll-mt-32 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow && <p className="type-eyebrow">{eyebrow}</p>}
          <h2 id={headingId} className="type-section-title">
            {title}
          </h2>
          {description && <p className="type-body max-w-3xl text-pretty">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
