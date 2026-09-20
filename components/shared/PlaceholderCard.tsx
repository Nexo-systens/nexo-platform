import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Variante compacta de EmptyState dentro de um Card, usada pelos espacos
// reservados a modulos ainda nao integrados (Saude Financeira, Diagnosticos,
// Documentos, Relatorios, IA Financeira no perfil da empresa). Reutilizavel
// por qualquer pagina futura que precise do mesmo padrao "card reservado".
export function PlaceholderCard({
  icon: Icon,
  title,
  description,
}: PlaceholderCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
