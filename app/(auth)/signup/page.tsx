import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "@/modules/auth/components/SignupForm";

export const metadata: Metadata = { title: "Criar conta — NEXO" };

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg font-semibold tracking-tight">Criar conta</h1>
        </CardTitle>
        <CardDescription>
          Comece a organizar a inteligência financeira da sua empresa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  );
}
