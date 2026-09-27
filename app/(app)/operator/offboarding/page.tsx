import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { OperatorOffboardingPanel } from "@/modules/companies/components/OperatorOffboardingPanel";
import { isOffboardingOperator } from "@/modules/companies/services/operator-offboarding.service";

/**
 * O título só é resolvido depois da mesma verificação da página. Com
 * metadados estáticos, o nome da rota ia no payload da resposta 404 de
 * quem não é operador (e, com o 404 próprio da Mission 203, aparecia na
 * aba) — a rota deixava de ser indistinguível de um endereço inexistente.
 */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  if (!(await isOffboardingOperator(supabase))) notFound();
  return { title: "Offboarding — Operador NEXO" };
}

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
      <PageHeader
        eyebrow="Operação NEXO"
        title="Offboarding de empresa"
        description="Uso exclusivo do operador NEXO, para concluir o encerramento solicitado por uma empresa pelo canal acordado. Informe o identificador técnico da empresa e a referência do registro privado. Nenhum dado da empresa é exibido aqui."
      />
      <OperatorOffboardingPanel />
    </div>
  );
}
