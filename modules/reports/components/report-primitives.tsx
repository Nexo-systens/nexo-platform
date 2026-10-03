import type { ReactNode } from "react";

import { KindMarker } from "@/components/shared/KindMarker";
import { cn } from "@/lib/utils";
import type { InsightKind } from "@/modules/analysis/lib/insight-semantics";

/**
 * Mission 208 — primitivas do documento executivo: seção numerada com filete,
 * itens em lista com divisores (nunca um card por item), metadados em texto.
 * A natureza de cada bloco (fato, evidência, análise, hipótese...) aparece
 * pelo `KindMarker`, em palavra e forma — nunca só pela cor.
 */

export function DocSection({
  id,
  number,
  title,
  lead,
  children,
}: {
  id: string;
  number: number;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="report-section flex scroll-mt-24 flex-col gap-6">
      <header className="report-keep flex flex-col gap-2 border-t border-border-strong pt-5">
        <p className="type-eyebrow num" aria-hidden="true">
          {String(number).padStart(2, "0")}
        </p>
        <h2 id={`${id}-titulo`} className="type-section-title">
          {title}
        </h2>
        {lead && <p className="type-body max-w-3xl text-pretty">{lead}</p>}
      </header>
      {children}
    </section>
  );
}

export function DocBlock({
  kind,
  title,
  aside,
  children,
  className,
}: {
  kind?: InsightKind;
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(kind || title || aside) && (
        <div className="report-keep flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex flex-col gap-1">
            {kind && <KindMarker kind={kind} />}
            {title && <h3 className="type-subsection-title">{title}</h3>}
          </div>
          {aside && <div className="type-meta">{aside}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function DocList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("flex flex-col divide-y divide-border border-y border-border", className)}>{children}</ul>;
}

export function DocItem({
  title,
  children,
  meta,
}: {
  title: ReactNode;
  children?: ReactNode;
  meta?: readonly (string | undefined | false)[];
}) {
  const metaParts = (meta ?? []).filter((part): part is string => Boolean(part));
  return (
    <li className="report-item flex flex-col gap-1.5 py-3.5">
      <p className="text-sm font-medium text-pretty text-foreground">{title}</p>
      {children}
      {metaParts.length > 0 && <p className="type-meta text-pretty">{metaParts.join(" · ")}</p>}
    </li>
  );
}

export function Basis({ label = "Apoia-se em", items }: { label?: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <p className="text-[0.75rem] text-pretty text-foreground-secondary">
      <span className="text-muted-foreground">{label}: </span>
      {items.join(" · ")}
    </p>
  );
}
