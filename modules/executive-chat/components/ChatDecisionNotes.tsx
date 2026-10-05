import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { companyWorkspaceHref } from "@/modules/companies/lib/workspace-views";

/**
 * Mission 210 (D-135) — mensagens comuns aos cartões de cenário e de
 * comparação do Executive Chat.
 */

/** A decisão foi registrada pela pessoa: é da empresa e vive na Central de Decisões. */
export function ChatDecisionRecorded({ companyId }: { companyId: string }) {
  return (
    <div role="status" className="flex flex-col gap-1.5 rounded-md border border-positive/25 bg-positive-soft p-2.5">
      <p className="text-xs text-positive-soft-foreground">
        Decisão registrada pela empresa, com origem no Executive Chat. O acompanhamento continua na Central de Decisões.
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit gap-1"
        render={<Link href={companyWorkspaceHref(companyId, "decisoes")} />}
        nativeButton={false}
      >
        Ver na Central de Decisões
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

/** A análise usada pela resposta não tem Modelo Financeiro: nenhum cenário pode partir dela. */
export function ChatProposalWithoutBaseline() {
  return (
    <p className="text-xs text-muted-foreground">
      Simulação indisponível para esta resposta: a análise usada não tem o modelo financeiro completo.
    </p>
  );
}
