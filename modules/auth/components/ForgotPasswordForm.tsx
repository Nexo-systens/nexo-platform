"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/modules/auth/actions/auth.actions";
import { initialAuthActionState } from "@/modules/auth/types";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/modules/auth/validators/auth.schemas";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    forgotPassword,
    initialAuthActionState
  );

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: ForgotPasswordInput) {
    const formData = new FormData();
    formData.append("email", values.email);
    formAction(formData);
  }

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        <Link
          href="/login"
          className="text-center text-sm text-foreground underline underline-offset-4"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!form.formState.errors.email}
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="mt-2 w-full">
        {isPending ? "Enviando..." : "Enviar link de recuperação"}
      </Button>

      <Link
        href="/login"
        className="text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Voltar para o login
      </Link>
    </form>
  );
}
