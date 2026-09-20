"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/shared/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Não foi possível carregar o dashboard"
      description="Ocorreu um erro inesperado. Tente novamente em instantes."
      onRetry={reset}
    />
  );
}
