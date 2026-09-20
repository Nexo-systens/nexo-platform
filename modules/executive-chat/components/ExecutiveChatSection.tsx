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
    <div id="executive-chat" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Executive Chat</h2>
      <ExecutiveChatPanel companyId={companyId} />
    </div>
  );
}
