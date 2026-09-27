import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

/**
 * Mission 203 — 404 dentro do shell autenticado (`notFound()` de qualquer
 * página do grupo `(app)`). Texto único para toda ausência — rota
 * inexistente, recurso de outra conta ou superfície restrita (D-131):
 * a resposta nunca revela qual dos casos aconteceu.
 */
export default function AppNotFound() {
  return (
    <PageHeader
      eyebrow="Erro 404"
      title="Página não encontrada"
      description="Este endereço não existe ou não está disponível para a sua conta."
      actions={
        <Button variant="outline" render={<Link href="/dashboard" />} nativeButton={false}>
          Ir para a visão executiva
        </Button>
      }
    />
  );
}
