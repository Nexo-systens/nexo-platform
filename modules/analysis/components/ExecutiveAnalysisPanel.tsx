"use client";

import { AlertTriangle, FileWarning, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentGovernanceResult } from "@/app/api/efos/_shared/documentGovernance";
import { DOCUMENT_GOVERNANCE_LABELS } from "@/app/api/efos/_shared/documentGovernance";
import type { ApplicationResult } from "@/efos/application/contracts";
import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";
import type { ExecutiveReport } from "@/efos/application/report";
import {
  deriveFinancialCompletenessSummary,
  summarizeDocumentGovernance,
} from "@/modules/analysis/lib/financialGovernance";
import { hasNoSections } from "@/modules/analysis/lib/report-view";

import { ExecutiveReportView } from "./ExecutiveReportView";
import { ExecutiveTrajectoryPanel } from "./ExecutiveTrajectoryPanel";

type Status = "idle" | "loading" | "error" | "empty" | "success";

interface ExecutiveAnalysisPanelProps {
  companyId: string;
  hasDocuments: boolean;
  /**
   * Chamado após uma análise concluída com sucesso (persistida
   * automaticamente pelo backend, D-028) — permite que um componente
   * irmão (`HistoricalAnalysisPanel`) saiba que uma nova execução
   * existe e deve recarregar. Nunca chamado em erro (nenhuma execução
   * nova foi persistida). Opcional — sem isso, o componente continua
   * funcionando exatamente como antes (Mission 099).
   */
  onAnalysisComplete?: () => void;
}

/**
 * Primeiro consumidor real do EFOS (Mission 081 — NEXO Executive
 * Analysis Consumption; conectado aos documentos já armazenados da
 * empresa desde a Mission 082 — NEXO Document-to-Analysis Flow).
 * Único ponto de contato com o motor financeiro: `POST
 * /api/efos/analyze/{companyId}/executive` — endpoint dedicado
 * (Mission 175) sobre a mesma fronteira oficial já declarada por D-043
 * (`EFOSFacade`, via `EFOSPlatform`), migrado nesta missão (Mission 177)
 * do endpoint irmão `POST /api/efos/analyze/{companyId}` (preservado
 * intocado para compatibilidade, D-043 — nenhum outro consumidor o usa
 * hoje) exatamente porque devolve, na MESMA execução, tanto
 * `ExecutiveReport` quanto `ExecutiveFinancialContext.financialEpisodes`
 * (Mission 172) — a única forma de mostrar trajetória financeira sem
 * disparar uma segunda análise para a mesma ação do usuário. Nunca
 * importa Engine, Repository ou Supabase internals — só o contrato
 * HTTP já existente. Este componente nunca calcula/classifica/soma
 * nenhum dado financeiro — apenas dispara a análise e repassa
 * `report`/`executiveContext` para `ExecutiveReportView`/
 * `ExecutiveTrajectoryPanel` (ambos puramente apresentacionais).
 *
 * `hasDocuments` (calculado pela página, `countDocumentsByCompany`)
 * distingue o estado "nenhum documento enviado ainda" (a análise nem
 * chegaria a produzir nada) do estado pós-análise "concluída sem
 * dados" (documentos existem, mas nenhuma seção foi produzida) — dois
 * estados vazios com causas diferentes, nunca confundidos.
 */
export function ExecutiveAnalysisPanel({
  companyId,
  hasDocuments,
  onAnalysisComplete,
}: ExecutiveAnalysisPanelProps) {
  // Mission 199B Closure — Persisted Analysis Hydration (Bug P1):
  // começa em "loading", nunca "idle" — o estado inicial real não é
  // conhecido até a hidratação (abaixo) responder; assumir "idle" de
  // cara é exatamente o que fazia este painel esquecer uma execução já
  // persistida a cada reload/retorno à página.
  const [status, setStatus] = useState<Status>("loading");
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [executiveContext, setExecutiveContext] = useState<
    ExecutiveFinancialContext | undefined
  >();
  const [documentGovernance, setDocumentGovernance] = useState<
    readonly DocumentGovernanceResult[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Mission 199B Closure — Persisted Analysis Hydration (Bug P1). Lê a
  // última execução já persistida (`GET /api/efos/analyze/{companyId}/executive`,
  // companheiro somente-leitura do `POST` que `runAnalysis()` já usa)
  // uma vez ao montar/trocar de empresa — nunca dispara o pipeline,
  // nunca persiste nada, apenas HIDRATA o mesmo estado que `runAnalysis()`
  // já preenche após uma análise real. Uma falha aqui (rede, erro
  // inesperado) nunca bloqueia a tela com um estado de erro — apenas
  // volta para "idle" (o usuário sempre pode clicar "Executar análise"
  // manualmente), porque isto é uma conveniência de leitura, não a
  // única forma de obter o relatório.
  useEffect(() => {
    let cancelled = false;

    async function hydrateFromPersistedExecution() {
      setStatus("loading");

      try {
        const response = await fetch(`/api/efos/analyze/${companyId}/executive`);
        const result: ApplicationResult<{
          readonly report: ExecutiveReport;
          readonly executiveContext?: ExecutiveFinancialContext;
        } | undefined> & {
          readonly documentGovernance?: readonly DocumentGovernanceResult[];
        } = await response.json();

        if (cancelled) return;

        if (!result.success || !result.value) {
          setStatus("idle");
          return;
        }

        setDocumentGovernance(result.documentGovernance ?? []);
        setReport(result.value.report);
        setExecutiveContext(result.value.executiveContext);
        setStatus(hasNoSections(result.value.report) ? "empty" : "success");
      } catch {
        if (!cancelled) setStatus("idle");
      }
    }

    hydrateFromPersistedExecution();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function runAnalysis() {
    setStatus("loading");
    setErrorMessage(undefined);

    try {
      const response = await fetch(`/api/efos/analyze/${companyId}/executive`, {
        method: "POST",
      });
      const result: ApplicationResult<{
        readonly report: ExecutiveReport;
        readonly executiveContext?: ExecutiveFinancialContext;
      }> & { readonly documentGovernance?: readonly DocumentGovernanceResult[] } =
        await response.json();

      // Mission 193 — Production Intake Governance & Permanent
      // Regression Gate, Seção 6/16/17: `documentGovernance` é o único
      // vocabulário server-autoritativo por documento — sempre lido,
      // mesmo quando a análise falha, para que o usuário nunca perca a
      // visibilidade de POR QUE (Seção 3: "identify exactly where
      // processing/governance information currently disappears from
      // user visibility" — este componente era exatamente o ponto onde
      // isso desaparecia desde a Mission 192).
      setDocumentGovernance(result.documentGovernance ?? []);

      if (!result.success) {
        setStatus("error");
        setErrorMessage(result.error.message);
        return;
      }

      setReport(result.value.report);
      setExecutiveContext(result.value.executiveContext);
      setStatus(hasNoSections(result.value.report) ? "empty" : "success");
      onAnalysisComplete?.();
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao executar a análise."
      );
    }
  }

  const governanceSummary = summarizeDocumentGovernance(documentGovernance);
  const conflictingDocuments = documentGovernance.filter(
    (result) => result.outcome === "same_period_conflict"
  );
  // Mission 194 — Production Executive Report Truth & Presentation
  // Audit, Seção 36. `needs_review` já aparecia na contagem compacta
  // acima ("X requer revisão"), mas sem nenhuma explicação do que isso
  // significa — ao contrário de `same_period_conflict`, que já ganhava
  // um alerta dedicado desde a Mission 193. Um documento `needs_review`
  // FOI aceito e contribuiu para a verdade financeira desta análise
  // (nunca excluído) — o alerta abaixo precisa deixar isso explícito,
  // nunca sugerir rejeição.
  const needsReviewDocuments = documentGovernance.filter(
    (result) => result.outcome === "needs_review"
  );
  const completeness = executiveContext
    ? deriveFinancialCompletenessSummary(executiveContext.financialTruth.indicators)
    : undefined;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>Análise Executiva</CardTitle>
        <Button
          size="sm"
          onClick={runAnalysis}
          disabled={status === "loading" || !hasDocuments}
        >
          {status === "loading" ? "Processando análise..." : "Executar análise"}
        </Button>
      </CardHeader>
      <CardContent>
        {status !== "idle" && status !== "loading" && documentGovernance.length > 0 && (
          <div className="mb-4 flex flex-col gap-3">
            {/* Mission 193, Seção 17: resumo compacto, nunca uma
                contagem fabricada — cada número vem diretamente de
                `documentGovernance`, o mesmo vocabulário
                server-autoritativo devolvido pela rota. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{documentGovernance.length} documento(s) analisado(s)</span>
              {(Object.keys(governanceSummary) as (keyof typeof governanceSummary)[]).map(
                (outcome) => (
                  <span key={outcome}>
                    · {governanceSummary[outcome]} {DOCUMENT_GOVERNANCE_LABELS[outcome].toLowerCase()}
                  </span>
                )
              )}
            </div>

            {conflictingDocuments.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-foreground">
                    Encontramos demonstrações diferentes para o mesmo período/data-base.
                  </span>
                  <span className="text-muted-foreground">
                    Nenhuma delas foi usada como autoridade até que o conflito seja corrigido — remova o
                    documento incorreto ou envie a versão correta na seção Documentos e execute a análise
                    novamente.
                  </span>
                </div>
              </div>
            )}

            {needsReviewDocuments.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-foreground">
                    Um demonstrativo enviado foi considerado nesta análise, mas seus próprios valores
                    declarados não se reconciliam entre si.
                  </span>
                  <span className="text-muted-foreground">
                    Isto não é um erro de processamento — os números abaixo já refletem o documento como
                    enviado. Revise o documento de origem (ex.: Lucro Líquido declarado divergindo da soma
                    dos componentes) e reenvie a versão corrigida, se necessário.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {status === "idle" && !hasDocuments && (
          <EmptyState
            icon={FileWarning}
            title="Nenhum documento enviado"
            description="Envie ao menos um documento financeiro (PDF ou CSV) nesta empresa antes de executar a análise — a seção Documentos, abaixo, permite o envio."
          />
        )}

        {status === "idle" && hasDocuments && (
          <EmptyState
            icon={Sparkles}
            title="Nenhuma análise executada ainda"
            description="Execute a análise para ver a inteligência executiva produzida pelo EFOS: saúde financeira, risco, KPIs, demonstrações, evidências, raciocínio, recomendações e decisões."
          />
        )}

        {status === "loading" && (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {status === "error" && (
          <ErrorState
            title="Não foi possível executar a análise"
            description={errorMessage}
            onRetry={runAnalysis}
          />
        )}

        {status === "empty" && (
          <EmptyState
            icon={Sparkles}
            title="Análise concluída sem dados financeiros"
            description="A execução terminou, mas nenhuma seção foi produzida — os documentos enviados não continham dados financeiros reconhecíveis pelo EFOS nesta execução."
          />
        )}

        {status === "success" && report && (
          <div className="flex flex-col gap-6">
            <ExecutiveTrajectoryPanel
              financialEpisodes={executiveContext?.financialEpisodes}
            />

            <ExecutiveReportView report={report} />

            {completeness && !completeness.crossSourceCompatible && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">
                  Alguns indicadores que combinam Demonstração de Resultado e Balanço (ex.: ROA, Giro do
                  Ativo, prazos médios) estão indisponíveis — o período do demonstrativo e a data-base do
                  balanço enviados não descrevem o mesmo recorte temporal.
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {report.summary.recommendationCount > 0
                  ? `${report.summary.recommendationCount} recomendação(ões) determinística(s) identificada(s) nesta análise.`
                  : "Nenhuma recomendação determinística identificada nesta análise."}
              </span>
              <Button
                variant="outline"
                size="sm"
                render={<a href="#diagnostico-executivo" />}
                nativeButton={false}
              >
                Ver diagnóstico executivo e decisões
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
