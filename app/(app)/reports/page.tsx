import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "Relatórios — NEXO" };

export default function ReportsPage() {
  return (
    <PlaceholderPage
      icon={BarChart3}
      title="Relatórios"
      description="Consolide e compartilhe a situação financeira das suas empresas."
    />
  );
}
