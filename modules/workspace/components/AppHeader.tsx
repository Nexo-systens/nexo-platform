"use client";

import type { User } from "@supabase/supabase-js";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

import { MobileSidebarTrigger } from "@/modules/workspace/components/AppSidebar";
import { UserMenu } from "@/modules/workspace/components/UserMenu";
import { describeRouteContext } from "@/modules/workspace/config/navigation";

/**
 * Mission 203 — cabeçalho leve: só o contexto necessário (onde o
 * usuário está) e o menu da conta. O título real da página vive no
 * `PageHeader` do conteúdo; aqui não se repete informação.
 */
export function AppHeader({ user }: { user: User | null }) {
  const pathname = usePathname();
  const context = describeRouteContext(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6 print:hidden!">
      <MobileSidebarTrigger />

      <nav aria-label="Contexto" className="flex min-w-0 flex-1 items-center gap-1.5 text-[0.8125rem]">
        <span className={context.page ? "text-muted-foreground" : "font-medium text-foreground"}>{context.section}</span>
        {context.page && (
          <>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-medium text-foreground" aria-current="page">
              {context.page}
            </span>
          </>
        )}
      </nav>

      <UserMenu user={user} />
    </header>
  );
}
