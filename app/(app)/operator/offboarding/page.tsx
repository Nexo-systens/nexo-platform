import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { OperatorOffboardingPanel } from "@/modules/companies/components/OperatorOffboardingPanel";
import { isOffboardingOperator } from "@/modules/companies/services/operator-offboarding.service";

export const metadata: Metadata = { title: "Offboarding — Operador NEXO" };

/**
 * Mission 202B (D-131) — superfície única da autoridade de offboarding
 * do operador NEXO. Não é painel administrativo: não lista empresas nem
 * mostra dados. O operador informa o identificador técnico e a
 * referência do registro privado; só vê estado, frases e contagens.
 * Para quem não é operador, a rota não existe (404).
 */
export default async function OperatorOffboardingPage() {
  const supabase = await createClient();
  if (!(await isOffboardingOperator(supabase))) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Offboarding de empresa</h1>
        <p className="text-sm text-muted-foreground">
          Uso exclusivo do operador NEXO, para concluir o encerramento solicitado por uma empresa pelo canal
          acordado. Informe o identificador técnico da empresa e a referência do registro privado. Nenhum dado
          da empresa é exibido aqui.
        </p>
      </div>
      <OperatorOffboardingPanel />
    </div>
  );
}
