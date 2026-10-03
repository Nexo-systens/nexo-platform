"use client";

import { Clock, History } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
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
import { comparisonUnavailableText } from "@/modules/analysis/lib/temporal-comparison-language";
import { describeExecution } from "@/modules/history/lib/formatExecutedAt";
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
    <section aria-labelledby="historico-titulo" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="type-eyebrow">Análise após análise</p>
        <h3 id="historico-titulo" className="type-section-title">
          Histórico e comparação
        </h3>
      </div>
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
              compact
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

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="type-subsection-title">
                  {data.samePeriod && data.currentExecution
                    ? `Diferença entre versões — ${describeExecution(data.currentExecution).title}`
                    : "O que mudou"}
                  {!data.samePeriod &&
                    data.currentExecution &&
                    data.previousExecution &&
                    ` — ${describeExecution(data.currentExecution).title} comparado com ${describeExecution(data.previousExecution).title}`}
                </h4>

                <Select
                  value={selectedPreviousId}
                  onValueChange={(value) => handlePreviousChange(String(value))}
                >
                  <SelectTrigger aria-label="Comparar com a análise de" className="w-fit min-w-40" size="sm">
                    <SelectValue placeholder="Comparar com...">
                      {(value) =>
                        (() => {
                          const match = data.availableExecutions.find((execution) => execution.executionId === value);
                          return match
                            ? `${describeExecution(match).title}${match.earlierVersion ? " · versão anterior" : ""}`
                            : resolveExecutionLabel(value as string | undefined, data.availableExecutions);
                        })()
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
                          {describeExecution(execution).title}
                          {execution.earlierVersion ? " · versão anterior" : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Mission 209 (D-134): sem escolha explícita, só o período anterior canônico; sem ele, a ausência é dita. */}
              {data.comparison ? (
                <>
                  {data.comparisonBasis === "previous-period" && (
                    <p className="type-meta">Período anterior comparável. Escolha outra análise para comparar com ela.</p>
                  )}
                  {data.samePeriod && (
                    <p className="type-meta">As duas são versões do mesmo período (reanálise): a diferença não é variação no tempo.</p>
                  )}
                  <ComparisonSummary comparison={data.comparison} samePeriod={data.samePeriod} />
                </>
              ) : (
                <p className="type-body">
                  {comparisonUnavailableText(data.previousPeriodState ?? "first-period")}. Escolha uma análise acima para
                  comparar com ela.
                </p>
              )}
            </div>
          </>
        )}
    </section>
  );
}
