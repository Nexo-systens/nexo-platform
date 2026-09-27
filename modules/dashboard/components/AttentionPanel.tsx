import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { AttentionItem, StageTone } from "@/modules/dashboard/lib/executive-overview";

const TONE_DOT: Readonly<Record<StageTone, string>> = {
  neutral: "bg-border-strong",
  info: "bg-info",
  warning: "bg-warning",
  positive: "bg-positive",
};

/**
 * "O que exige atenção" — só itens acionáveis derivados do estágio real
 * de cada empresa; nenhum alerta financeiro é inventado aqui.
 */
export function AttentionPanel({ items }: { items: readonly AttentionItem[] }) {
  return (
    <section aria-labelledby="atencao-titulo" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="flex flex-col gap-1">
        <p className="type-eyebrow">Prioridades</p>
        <h2 id="atencao-titulo" className="type-section-title">
          O que exige atenção
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg bg-positive-soft px-3 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden="true" />
          <p className="text-sm text-positive-soft-foreground">
            Nenhuma pendência de ativação. Acompanhe diagnósticos e decisões em cada empresa.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={`${item.companyId}-${item.title}`} className="flex flex-col gap-1.5 py-3 first:pt-1 last:pb-0">
              <div className="flex items-start gap-2.5">
                <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[item.tone])} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="type-meta truncate">{item.companyName}</p>
                  <p className="type-meta text-pretty">{item.detail}</p>
                </div>
              </div>
              <Link
                href={item.action.href}
                className="ml-4.5 inline-flex w-fit items-center gap-1 text-[0.8125rem] font-medium text-primary underline-offset-4 hover:underline"
              >
                {item.action.label}
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
