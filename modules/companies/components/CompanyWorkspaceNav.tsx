import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  companyWorkspaceHref,
  type WorkspaceViewId,
} from "@/modules/companies/lib/workspace-views";

export interface WorkspaceNavItem {
  readonly id: WorkspaceViewId;
  readonly label: string;
  /** Contador opcional (ex.: itens aguardando decisão) — só quando > 0. */
  readonly count?: number;
  readonly countLabel?: string;
}

/**
 * Mission 204 — navegação entre as visões do workspace da empresa. Links
 * reais (cada visão tem URL própria, compartilhável e com voltar do
 * navegador), fixa sob o cabeçalho, com rolagem horizontal em telas
 * estreitas. Substitui a navegação por âncoras da Mission 203.
 */
export function CompanyWorkspaceNav({
  companyId,
  items,
  active,
}: {
  companyId: string;
  items: readonly WorkspaceNavItem[];
  active: WorkspaceViewId;
}) {
  return (
    <nav
      aria-label="Visões da empresa"
      className="sticky top-(--header-height) z-20 -mx-4 border-b border-border bg-background/92 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
    >
      {/* Abaixo de xl as visões podem não caber: a borda direita esmaece para indicar que a lista continua. */}
      <ul className="-mb-px flex gap-5 overflow-x-auto pr-10 [mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] [scrollbar-width:none] sm:gap-6 xl:pr-0 xl:[mask-image:none]">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <Link
                href={companyWorkspaceHref(companyId, item.id)}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 border-b-2 py-3 text-[0.8125rem] whitespace-nowrap transition-colors duration-150",
                  isActive
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-foreground-secondary hover:border-border-strong hover:text-foreground"
                )}
              >
                {item.label}
                {item.count !== undefined && item.count > 0 && (
                  <span className="num inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.625rem] font-semibold text-primary-foreground">
                    <span aria-hidden="true">{item.count}</span>
                    <span className="sr-only">{item.countLabel ?? String(item.count)}</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
