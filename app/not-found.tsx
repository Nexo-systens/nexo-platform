import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Mission 203 — 404 para endereços que não correspondem a nenhuma rota.
 * Substitui a página padrão do Next, cujo CSS embutido pinta o texto de
 * branco no esquema escuro do sistema e ignora os tokens do design system.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-4 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        N
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <p className="type-eyebrow">Erro 404</p>
        <h1 className="type-page-title">Página não encontrada</h1>
        <p className="type-body text-pretty">Este endereço não existe ou não está disponível para a sua conta.</p>
      </div>
      <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
        Voltar para a NEXO
      </Button>
    </main>
  );
}
