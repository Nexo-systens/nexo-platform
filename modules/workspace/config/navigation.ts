import {
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Fonte unica de navegacao: alimenta a Sidebar e o Breadcrumb do Workspace.
// Ao trocar para rotas com contexto de empresa (multiempresa, futuro), o
// "href" e o unico ponto que precisa mudar.
export const workspaceNavigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Empresas", href: "/companies", icon: Building2 },
  { label: "Documentos", href: "/documents", icon: FileText },
  { label: "Central de Decisões", href: "/diagnostics", icon: Stethoscope },
  { label: "Relatórios", href: "/reports", icon: BarChart3 },
  { label: "Configurações", href: "/settings", icon: Settings },
];

/**
 * Um item de navegacao esta ativo tanto na sua propria rota quanto em
 * qualquer sub-rota dela (ex: /companies/[id] pertence a "Empresas").
 * Usado pela Sidebar (destaque do item) e pelo Header (breadcrumb).
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findActiveNavItem(pathname: string): NavItem | undefined {
  return workspaceNavigation.find((item) => isNavItemActive(pathname, item.href));
}
