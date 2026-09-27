import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "@/modules/auth/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Nova senha — NEXO" };

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg font-semibold tracking-tight">Definir nova senha</h1>
        </CardTitle>
        <CardDescription>
          Escolha uma nova senha para acessar sua conta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
