import { Activity } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardActivityItem } from "@/modules/dashboard/services/dashboard.service";

export function RecentActivity({
  items,
}: {
  items: DashboardActivityItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividades recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Nenhuma atividade ainda"
            description="Assim que você cadastrar empresas e gerar diagnósticos, o histórico aparecerá aqui."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.occurredAt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
