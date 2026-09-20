import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";

interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Usado pelas rotas do Workspace cujo modulo de negocio ainda nao foi
// implementado (Empresas, Documentos, Diagnosticos, Relatorios,
// Configuracoes) — mantem a navegacao funcional e consistente ate cada
// modulo ser desenvolvido em sua propria sprint.
export function PlaceholderPage({
  icon,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <EmptyState
        icon={icon}
        title="Módulo em construção"
        description="Esta área ainda não foi implementada. Ela chegará em uma próxima sprint."
      />
    </div>
  );
}
