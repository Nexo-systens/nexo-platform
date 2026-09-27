import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ForgotPasswordForm } from "@/modules/auth/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Recuperar senha — NEXO" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg font-semibold tracking-tight">Recuperar senha</h1>
        </CardTitle>
        <CardDescription>
          Informe seu e-mail para receber um link de recuperação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
