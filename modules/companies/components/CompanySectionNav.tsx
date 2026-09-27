"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export interface CompanySectionLink {
  id: string;
  label: string;
}

/**
 * Mission 203 — navegação interna do workspace da empresa. Âncoras
 * estáveis (as mesmas usadas por links de outras telas), fixa sob o
 * cabeçalho, com rolagem horizontal em telas estreitas. A seção visível
 * fica marcada (`aria-current`) conforme a rolagem.
 */
export function CompanySectionNav({ sections }: { sections: readonly CompanySectionLink[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0 }
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Seções da empresa"
      className="sticky top-(--header-height) z-20 -mx-4 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
    >
      <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
        {sections.map((section) => {
          const isActive = active === section.id;
          return (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-[0.8125rem] whitespace-nowrap transition-colors duration-150",
                  isActive
                    ? "bg-accent font-medium text-foreground"
                    : "text-foreground-secondary hover:bg-surface-subtle hover:text-foreground"
                )}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
