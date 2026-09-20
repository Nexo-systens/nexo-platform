"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/shared/ErrorState";

export default function CompanyProfileError({
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
      title="Não foi possível carregar esta empresa"
      description="Ocorreu um erro inesperado. Tente novamente em instantes."
      onRetry={reset}
    />
  );
}
