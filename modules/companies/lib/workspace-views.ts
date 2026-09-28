/**
 * Mission 204 — o workspace da empresa é organizado em VISÕES, uma por
 * capacidade, em vez de uma página única de ~14 mil pixels. A rota é a
 * mesma (`/companies/[id]`); a visão ativa vem de `?secao=`. Só a visão
 * ativa é renderizada no servidor.
 */

export const WORKSPACE_VIEWS = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "analise", label: "Análise" },
  { id: "decisoes", label: "Decisões" },
  { id: "cenarios", label: "Cenários" },
  { id: "conversa", label: "Executive Chat" },
  { id: "conhecimento", label: "Conhecimento" },
  { id: "documentos", label: "Documentos" },
  { id: "cadastro", label: "Cadastro" },
] as const;

export type WorkspaceViewId = (typeof WORKSPACE_VIEWS)[number]["id"];

/** Antes da primeira análise só fazem sentido documentos, análise, decisões e cadastro (Mission 195). */
const BEFORE_FIRST_ANALYSIS: readonly WorkspaceViewId[] = ["documentos", "analise", "decisoes", "cadastro"];

export function availableWorkspaceViews(hasFirstAnalysis: boolean) {
  return hasFirstAnalysis
    ? WORKSPACE_VIEWS
    : BEFORE_FIRST_ANALYSIS.map((id) => WORKSPACE_VIEWS.find((view) => view.id === id)!);
}

export function resolveWorkspaceView(requested: string | undefined, hasFirstAnalysis: boolean): WorkspaceViewId {
  const available = availableWorkspaceViews(hasFirstAnalysis);
  const match = available.find((view) => view.id === requested);
  if (match) return match.id;
  return hasFirstAnalysis ? "visao-geral" : "documentos";
}

export function companyWorkspaceHref(companyId: string, view?: WorkspaceViewId): string {
  return view ? `/companies/${companyId}?secao=${view}` : `/companies/${companyId}`;
}
