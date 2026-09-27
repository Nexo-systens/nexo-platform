import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "Configurações — NEXO" };

export default function SettingsPage() {
  return (
    <PlaceholderPage
      icon={Settings}
      eyebrow="Conta"
      title="Configurações"
      description="Conta, preferências e usuários."
      availableToday="As configurações da conta ainda não estão disponíveis nesta fase. Para trocar a senha, use “Esqueceu a senha?” na tela de entrada."
    />
  );
}
