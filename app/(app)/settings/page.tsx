import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "Configurações — NEXO" };

export default function SettingsPage() {
  return (
    <PlaceholderPage
      icon={Settings}
      title="Configurações"
      description="Gerencie sua conta, preferências e usuários."
    />
  );
}
