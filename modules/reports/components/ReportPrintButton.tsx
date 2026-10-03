"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Mission 208 — impressão pelo navegador (inclui "Salvar como PDF"), sem
 * serviço externo. Antes de imprimir — pelo botão ou por Ctrl+P — abre todo
 * `<details>` do documento (demonstrações e detalhes recolhidos) e fecha de
 * novo depois: o papel não tem "clique para expandir".
 */
export function ReportPrintButton({ documentId }: { documentId: string }) {
  useEffect(() => {
    const opened: HTMLDetailsElement[] = [];
    const expand = () => {
      document
        .getElementById(documentId)
        ?.querySelectorAll<HTMLDetailsElement>("details:not([open])")
        .forEach((details) => {
          details.open = true;
          opened.push(details);
        });
    };
    const restore = () => {
      for (const details of opened.splice(0)) details.open = false;
    };
    window.addEventListener("beforeprint", expand);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", expand);
      window.removeEventListener("afterprint", restore);
    };
  }, [documentId]);

  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      Imprimir ou salvar PDF
    </Button>
  );
}
