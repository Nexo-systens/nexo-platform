import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

interface PlaceholderPageProps {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  /** O que o usuário pode fazer hoje, enquanto a área não existe. */
  availableToday?: string;
  action?: ReactNode;
}

/**
 * Rotas do Workspace cuja capacidade ainda não existe. Mission 203:
 * dizem com honestidade que a área está "em breve" (a navegação marca o
 * mesmo) e apontam o que já é possível fazer hoje — nunca números ou
 * conteúdo simulados.
 */
export function PlaceholderPage({ icon, eyebrow, title, description, availableToday, action }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        icon={icon}
        title="Em breve"
        description={availableToday ?? "Esta área ainda não está disponível nesta fase do produto."}
        action={action}
      />
    </div>
  );
}
