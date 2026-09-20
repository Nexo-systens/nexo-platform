"use client";

import { Clock, History } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { HistoryResponse } from "@/app/api/efos/_shared/HistoryResponse";
import type { ApplicationResult } from "@/efos/application/contracts";
import { formatExecutedAt } from "@/modules/history/lib/formatExecutedAt";
import { resolveExecutionLabel } from "@/modules/history/lib/resolveExecutionLabel";

import { ComparisonSummary } from "./ComparisonSummary";
import { ExecutionHistoryList } from "./ExecutionHistoryList";

type Status = "loading" | "error" | "loaded";

interface HistoricalAnalysisPanelProps {
  companyId: string;
  /**
   * Incrementado por um consumidor irmão (`ExecutiveAnalysisPanel`,
   * via `onAnalysisComplete`) sempre que uma nova análise é persistida
   * — força este painel a recarregar o histórico (Mission 099, Etapa
   * 6/10 — Correção D). Sem isso, este painel só busca uma vez ao
   * montar (`useEffect` original, Mission 087) e nunca sabe que uma
   * nova execução passou a existir na mesma sessão de página, exibindo
   * a execução/data anteriores até um reload manual — a causa raiz
   * confirmada da discrepância de datas observada na validação real da
   * Mission 098. Opcional — sem passar nada, o comportamento é
   * idêntico ao anterior (busca uma vez por `companyId`).
   */
  refreshKey?: number;
}

/**
 * Primeiro consumidor real da inteligência histórica/comparativa do
 * EFOS (Mission 087 — NEXO Historical & Comparative Intelligence
 * Experience; Missions 085/086, D-045/D-046). Único ponto de contato:
 * `GET /api/efos/history/{companyId}` — nunca importa
 * `ExecutionRepository`/`HistoricalExecutionService`/`compareExecutions()`
 * diretamente, nunca acessa Supabase/Domain/Infrastructure. Repassa o
 * `HistoryResponse` recebido para `ExecutionHistoryList`/
 * `ComparisonSummary` — puramente apresentacional, sem cálculo, sem
 * reclassificação, sem percentual.
 *
 * "Seleção de períodos" (Mission 087): o `Select` de execução anterior
 * apenas dispara uma nova chamada GET com `?previousExecutionId=...` —
 * a comparação em si sempre acontece no servidor
 * (`compareExecutions()`), nunca no cliente.
 */
export function HistoricalAnalysisPanel({
  companyId,
  refreshKey,
}: HistoricalAnalysisPanelProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [selectedPreviousId, setSelectedPreviousId] = useState<
    string | undefined
  >();

  // `fetchHistory()` nunca chama `setState` de forma síncrona — o
  // estado inicial `"loading"` já cobre a primeira renderização; esta
  // função só atualiza estado dentro do `.then`/`catch` da promessa
  // (assíncrono), permitindo chamá-la diretamente do corpo do efeito
  // sem disparar renders em cascata. Chamadas subsequentes (retry,
  // seleção de execução anterior) definem `"loading"` explicitamente
  // antes de chamar esta função.
  async function fetchHistory(previousExecutionId?: string) {
    try {
      const url = new URL(
        `/api/efos/history/${companyId}`,
        window.location.origin
      );
      if (previousExecutionId) {
        url.searchParams.set("previousExecutionId", previousExecutionId);
      }

      const response = await fetch(url.toString());
      const result: ApplicationResult<HistoryResponse> = await response.json();

      if (!result.success) {
        setStatus("error");
        setErrorMessage(result.error.message);
        return;
      }

      setData(result.value);
      setSelectedPreviousId(result.value.previousExecution?.executionId);
      setStatus("loaded");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao carregar o histórico."
      );
    }
  }

  useEffect(() => {
    // `queueMicrotask` garante que `fetchHistory()` (e os `setState`
    // dentro dela) nunca executam de forma sincrona durante o corpo do
    // efeito — satisfaz `react-hooks/set-state-in-effect` sem alterar
    // nenhum comportamento observável (o efeito ainda dispara a busca
    // uma vez por `companyId`, e novamente sempre que `refreshKey`
    // mudar — Mission 099, Correção D).
    queueMicrotask(() => {
      fetchHistory();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, refreshKey]);

  function reloadHistory(previousExecutionId?: string) {
    setStatus("loading");
    setErrorMessage(undefined);
    fetchHistory(previousExecutionId);
  }

  function handlePreviousChange(executionId: string) {
    setSelectedPreviousId(executionId);
    reloadHistory(executionId);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Análises</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {status === "loading" && (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {status === "error" && (
          <ErrorState
            title="Não foi possível carregar o histórico"
            description={errorMessage}
            onRetry={() => reloadHistory(selectedPreviousId)}
          />
        )}

        {status === "loaded" && data && data.availableExecutions.length === 0 && (
          <EmptyState
            icon={History}
            title="Ainda não existem análises para esta empresa"
            description="Execute a análise executiva, acima, para começar o histórico desta empresa."
          />
        )}

        {status === "loaded" && data && data.availableExecutions.length === 1 && (
          <>
            <ExecutionHistoryList
              executions={data.availableExecutions}
              currentExecutionId={data.currentExecution?.executionId}
            />
            <EmptyState
              icon={Clock}
              title="Esta é a primeira análise"
              description="Ainda não existe período anterior para comparação."
            />
          </>
        )}

        {status === "loaded" && data && data.availableExecutions.length >= 2 && (
          <>
            <ExecutionHistoryList
              executions={data.availableExecutions}
              currentExecutionId={data.currentExecution?.executionId}
            />

            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  O que mudou
                  {data.previousExecution &&
                    ` — comparado com ${formatExecutedAt(data.previousExecution.executedAt)}`}
                </h3>

                <Select
                  value={selectedPreviousId}
                  onValueChange={(value) => handlePreviousChange(String(value))}
                >
                  <SelectTrigger className="w-fit min-w-40" size="sm">
                    <SelectValue placeholder="Comparar com...">
                      {(value) =>
                        resolveExecutionLabel(
                          value as string | undefined,
                          data.availableExecutions
                        )
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {data.availableExecutions
                      .filter(
                        (execution) =>
                          execution.executionId !== data.currentExecution?.executionId
                      )
                      .map((execution) => (
                        <SelectItem
                          key={execution.executionId}
                          value={execution.executionId}
                        >
                          {formatExecutedAt(execution.executedAt)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {data.comparison && <ComparisonSummary comparison={data.comparison} />}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
