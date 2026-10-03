"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  isNavItemActive,
  navItemsByGroup,
  workspaceNavGroups,
} from "@/modules/workspace/config/navigation";

function BrandMark() {
  return (
    <Link href="/dashboard" className="group flex items-center gap-2.5 rounded-md" aria-label="NEXO — Visão executiva">
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-md bg-primary text-[0.8125rem] font-semibold tracking-tight text-primary-foreground"
      >
        N
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.9375rem] font-semibold tracking-[0.12em] text-foreground">NEXO</span>
        <span className="mt-1 text-[0.625rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">
          Executive Financial OS
        </span>
      </span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-6 px-3 py-5">
      {workspaceNavGroups.map((group) => {
        const items = navItemsByGroup(group.id);
        const isAccount = group.id === "account";
        return (
          <div key={group.id} className={cn("flex flex-col gap-0.5", isAccount && "mt-auto")}>
            {group.label && <p className="type-eyebrow px-2.5 pb-1.5">{group.label}</p>}
            {items.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.8125rem] transition-colors duration-150",
                    isActive
                      ? "bg-accent font-medium text-foreground"
                      : "text-foreground-secondary hover:bg-surface-subtle hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                  )}
                  <Icon
                    className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.status === "soon" && (
                    <span className="rounded-full border border-border px-1.5 py-px text-[0.625rem] font-medium text-muted-foreground">
                      em breve
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

// Sidebar fixa no desktop. No mobile, o mesmo conteudo de navegacao e
// exibido via MobileSidebarTrigger (Sheet), evitando duplicar a lista.
export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-(--sidebar-width) shrink-0 flex-col border-r border-border bg-surface lg:flex print:hidden!">
      <div className="flex h-(--header-height) items-center border-b border-border px-5">
        <BrandMark />
      </div>
      <SidebarNav />
    </aside>
  );
}

export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" />}>
        <Menu className="size-5" aria-hidden="true" />
        <span className="sr-only">Abrir menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <SheetHeader className="border-b border-border px-5">
          <SheetTitle className="sr-only">NEXO</SheetTitle>
          <BrandMark />
          <SheetDescription className="sr-only">Menu de navegação principal</SheetDescription>
        </SheetHeader>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
