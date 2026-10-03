import {
  BookOpenText,
  Building2,
  FileText,
  Gauge,
  Scale,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavGroupId = "overview" | "companies" | "decision" | "account";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Capacidade ainda não disponível: o item continua navegável e diz isso. */
  status?: "soon";
}

export interface NavGroup {
  id: NavGroupId;
  /** Rótulo do grupo na sidebar; `null` quando o grupo dispensa título. */
  label: string | null;
}

/**
 * Mission 203 — navegação organizada por função executiva, não por
 * módulo técnico: acompanhar (visão executiva), operar as empresas e
 * seus documentos, decidir; conta e itens ainda não disponíveis ficam
 * separados, no rodapé. As rotas são as mesmas de antes (nenhum
 * bookmark quebra); só o rótulo "Dashboard" passa a "Visão executiva",
 * que é o que a página entrega.
 */
export const workspaceNavGroups: NavGroup[] = [
  { id: "overview", label: null },
  { id: "companies", label: "Empresas" },
  { id: "decision", label: "Decisão" },
  { id: "account", label: null },
];

// Fonte única de navegação: alimenta a Sidebar e o contexto do Header.
// Mission 208 — Relatórios deixa de ser "em breve" e passa a acompanhar a
// Visão executiva: é onde o executivo lê o que o EFOS sabia de cada período.
export const workspaceNavigation: NavItem[] = [
  { label: "Visão executiva", href: "/dashboard", icon: Gauge, group: "overview" },
  { label: "Relatórios", href: "/reports", icon: BookOpenText, group: "overview" },
  { label: "Empresas", href: "/companies", icon: Building2, group: "companies" },
  { label: "Documentos", href: "/documents", icon: FileText, group: "companies" },
  { label: "Central de Decisões", href: "/diagnostics", icon: Scale, group: "decision" },
  { label: "Configurações", href: "/settings", icon: Settings, group: "account", status: "soon" },
];

/**
 * Um item de navegacao esta ativo tanto na sua propria rota quanto em
 * qualquer sub-rota dela (ex: /companies/[id] pertence a "Empresas").
 * Usado pela Sidebar (destaque do item) e pelo Header (contexto).
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findActiveNavItem(pathname: string): NavItem | undefined {
  return workspaceNavigation.find((item) => isNavItemActive(pathname, item.href));
}

export function navItemsByGroup(group: NavGroupId): NavItem[] {
  return workspaceNavigation.filter((item) => item.group === group);
}

/**
 * Contexto exibido no Header para rotas que não estão na navegação.
 * `/operator/offboarding` fica de fora de propósito: para quem não é
 * operador a rota não existe (404, D-131), e o Header não pode tratá-la
 * diferente de um endereço qualquer — a página já traz o próprio contexto.
 */
export function describeRouteContext(pathname: string): { section: string; page?: string } {
  if (pathname === "/companies/closed") return { section: "Empresas", page: "Empresas encerradas" };
  const item = findActiveNavItem(pathname);
  if (!item) return { section: "NEXO" };
  if (item.href === "/companies" && pathname !== "/companies") return { section: "Empresas", page: "Empresa" };
  if (item.href === "/reports" && pathname !== "/reports") return { section: "Relatórios", page: "Relatório executivo" };
  return { section: item.label };
}
