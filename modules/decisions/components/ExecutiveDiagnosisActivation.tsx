"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { activateExecutiveDiagnosisAction } from "@/modules/decisions/actions/executive-diagnosis.actions";

type Status =
  | "idle"
  | "activating"
  | "provider-failed"
  | "persistence-failed"
  | "ambiguous-truth";

/**
 * Mission 128, Etapa 9 — UI Integration. Único ponto de ativação
 * visível para um humano: mostrado apenas quando ainda não existe
 * nenhum `PersistedExecutiveDiagnosis` para a empresa
 * (`ExecutiveDiagnosisSection` só renderiza este componente no ramo
 * vazio). Estados mínimos exigidos pela missão: `no diagnosis`
 * (`idle`), `activating`, `provider failed`, `persistence failed` —
 * `diagnosis available` é responsabilidade do componente pai
 * (`ExecutiveDiagnosisSection`), que recarrega o estado canônico via
 * `router.refresh()` após sucesso, nunca via diagnóstico local
 * inventado no client.
 *
 * A causa real de erro (`stage: "provider" | "persistence" |
 * "financial-truth" | "auth" | "access"`, devolvida por
 * `activateExecutiveDiagnosisAction`) nunca é escondida atrás de uma
 * mensagem genérica "diagnóstico indisponível" (Mission 128, Etapa 9,
 * proibição explícita).
 *
 * **Mission 177 — Executive Intelligence Experience, Seção 10**:
 * `stage: "financial-truth"` (Mission 176/176 Closure/176 Final
 * Closure — ambiguidade de verdade financeira atual, fail closed antes
 * de qualquer chamada ao provider) agora tem um estado visual próprio,
 * distinto de falha de provider/persistência — "tentar novamente"
 * sozinho não resolve uma ambiguidade real, então o título e a
 * descrição orientam o usuário a reanalisar o período mais recente,
 * nunca escolhem uma execução "vencedora" nem expõem `executionId`
 * (o próprio backend já nunca os inclui na mensagem, D-090/Mission 176
 * Final Closure).
 */
export function ExecutiveDiagnosisActivation({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function activate() {
    setStatus("activating");
    setErrorMessage(undefined);

    const result = await activateExecutiveDiagnosisAction({ companyId });

    if (!result.success) {
      const nextStatus =
        result.stage === "persistence"
          ? "persistence-failed"
          : result.stage === "financial-truth"
            ? "ambiguous-truth"
            : "provider-failed";
      setStatus(nextStatus);
      setErrorMessage(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-base">Diagnósticos Executivos</CardTitle>
        <Button size="sm" onClick={activate} disabled={status === "activating"}>
          {status === "activating" ? "Gerando diagnóstico..." : "Gerar diagnóstico executivo"}
        </Button>
      </CardHeader>
      <CardContent>
        {status === "idle" && (
          <EmptyState
            icon={Sparkles}
            title="Nenhum diagnóstico executivo ainda"
            description="Diagnósticos são produzidos pela Executive AI a partir da análise já executada nesta empresa. Nenhum diagnóstico real foi produzido até agora."
          />
        )}

        {status === "activating" && (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {status === "provider-failed" && (
          <ErrorState
            title="Não foi possível gerar o diagnóstico"
            description={errorMessage}
            onRetry={activate}
          />
        )}

        {status === "persistence-failed" && (
          <ErrorState
            title="Diagnóstico gerado, mas não foi possível salvá-lo"
            description={errorMessage}
            onRetry={activate}
          />
        )}

        {status === "ambiguous-truth" && (
          <ErrorState
            title="Diagnóstico indisponível — verdade financeira ambígua"
            description={errorMessage}
            onRetry={activate}
          />
        )}
      </CardContent>
    </Card>
  );
}
