import { SectionShell } from "@/components/shared/SectionShell";

import { ExecutiveChatPanel } from "./ExecutiveChatPanel";

/**
 * Mission 188 — Executive Chat over Canonical EFOS Intelligence.
 *
 * Server Component apenas para consistência de convenção de seção com
 * o resto de `app/(app)/companies/[id]/page.tsx` (`ExecutiveDiagnosisSection`/
 * `KnowledgeSection`/`CompanyTimeline`/`ScenarioLab`, todas
 * `<h2 id="...">` + conteúdo) — não busca nenhum dado (Seção 39: nada
 * é persistido, então não há nada para ler aqui); toda a interação
 * real vive em `<ExecutiveChatPanel />` (Client Component).
 */
export function ExecutiveChatSection({ companyId }: { companyId: string }) {
  return (
    <SectionShell
      id="executive-chat"
      eyebrow="Conversa executiva"
      title="Executive Chat"
      description="Pergunte sobre esta empresa. As respostas se apoiam na análise e nas evidências da própria empresa; ações só acontecem com a sua confirmação."
    >
      <ExecutiveChatPanel companyId={companyId} />
    </SectionShell>
  );
}
