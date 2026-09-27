import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { PlaceholderPage } from "@/components/shared/PlaceholderPage";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Relatórios — NEXO" };

export default function ReportsPage() {
  return (
    <PlaceholderPage
      icon={BarChart3}
      eyebrow="Relatórios"
      title="Relatórios"
      description="Consolidação e compartilhamento da situação financeira das suas empresas."
      availableToday="Relatórios consolidados ainda não estão disponíveis. Hoje, a análise, o histórico e as decisões de cada empresa ficam no workspace da própria empresa."
      action={
        <Button variant="outline" render={<Link href="/companies" />} nativeButton={false}>
          Abrir empresas
        </Button>
      }
    />
  );
}
