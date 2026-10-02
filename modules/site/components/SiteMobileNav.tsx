"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Mission 205 — navegação da página institucional em telas estreitas. Única
 * ilha client da página: abre/fecha o painel, fecha ao escolher um destino
 * ou com Esc. O restante da página é Server Component.
 */
export function SiteMobileNav({
  items,
  contact,
}: {
  items: readonly { href: string; label: string }[];
  contact: { href: string; label: string; external: boolean };
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex size-10 items-center justify-center rounded-full border border-foreground-inverse/20 text-foreground-inverse transition-colors hover:border-foreground-inverse/50"
      >
        {open ? <X className="size-4.5" aria-hidden="true" /> : <Menu className="size-4.5" aria-hidden="true" />}
        <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className={cn("absolute inset-x-0 top-full border-b border-foreground-inverse/10 bg-surface-inverse px-4 pt-2 pb-6 sm:px-8")}
      >
        <nav aria-label="Seções da página">
          <ul className="flex flex-col divide-y divide-foreground-inverse/10">
            {items.map((item) => (
              <li key={item.href}>
                <a href={item.href} onClick={close} className="block py-3.5 text-[0.9375rem] text-foreground-inverse/85 hover:text-foreground-inverse">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-5 flex flex-col gap-3">
          <a
            href={contact.href}
            onClick={close}
            className="inline-flex h-11 items-center justify-center rounded-full bg-foreground-inverse px-5 text-sm font-medium text-surface-inverse"
            {...(contact.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {contact.label}
            {contact.external && <span className="sr-only"> (abre em nova aba)</span>}
          </a>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-full border border-foreground-inverse/25 px-5 text-sm font-medium text-foreground-inverse"
          >
            Entrar na plataforma
          </Link>
        </div>
      </div>
    </div>
  );
}
