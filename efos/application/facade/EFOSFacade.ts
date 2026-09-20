import type { ApplicationResult } from "../contracts";
import type { AnalyzeCompanyRequest } from "../dto";
import type { ExecutiveFinancialContext } from "../executive-context";
import type { ExecutiveReport } from "../report";
import type { StatementConflict } from "@/efos/domain";
import type { RawFinancialDocument } from "@/efos/engines/data";
import type { StatementArithmeticIssue } from "@/efos/engines/indicators";

/**
 * Ponto único de entrada da Application Layer (Mission 023 — EFOS
 * Facade). Toda a Plataforma NEXO deve conversar com o EFOS através
 * deste contrato — nenhum componente externo conhece
 * `AnalysisService`/`ReportService` individualmente. Primeira
 * implementação concreta: `DefaultEFOSFacade`
 * (`DefaultEFOSFacade.ts`).
 *
 * Único método público desta missão: `analyzeCompany()`, encadeando
 * `AnalyzeCompanyRequest → AnalysisService → PipelineExecution →
 * ReportService → ExecutiveReport → ApplicationResult<ExecutiveReport>`
 * — toda a orquestração de Services vive exclusivamente aqui, nunca
 * em quem chama a Facade.
 *
 * `documents` (Mission 044 — End-to-End Document Flow) é um segundo
 * parâmetro opcional, mesmo padrão já usado por
 * `AnalysisService.analyze()` (Mission 026, D-022) — não é um DTO
 * novo, reaproveita `RawFinancialDocument` (contrato oficial do Data
 * Engine). `analyzeCompany()` apenas repassa `documents` adiante para
 * `AnalysisService.analyze(request, documents)`, fechando a lacuna
 * registrada em D-031 (documentos preparados pelo Upload API não
 * chegavam ao Pipeline).
 */
export interface EFOSFacade {
  analyzeCompany(
    request: AnalyzeCompanyRequest,
    documents?: readonly RawFinancialDocument[],
    conflicts?: readonly StatementConflict[]
  ): Promise<ApplicationResult<ExecutiveReport>>;

  /**
   * Mission 173 — Production Executive Financial Context Orchestrator.
   * Método ADITIVO — `analyzeCompany()` permanece byte a byte
   * inalterado (nenhum consumidor de produção existente, incluindo
   * `ExecutiveAnalysisPanel.tsx`, é afetado). Executa exatamente a
   * mesma análise de `analyzeCompany()` e, adicionalmente, monta o
   * `ExecutiveFinancialContext` canônico (Mission 114/172) — incluindo
   * `financialEpisodes` (Mission 171/171 Fix/172) — a partir do
   * histórico comparável COMPLETO da empresa (D-089), nunca truncado.
   * `executiveContext` vem ausente (`undefined`) quando o pipeline não
   * alcançou todos os estágios necessários (`indicators`/`evidence`/
   * `context`/`reasoning`/`recommendation`) — nunca uma composição
   * parcial fabricada, mesmo princípio de omissão já usado por
   * `ReportService`.
   */
  analyzeCompanyWithExecutiveContext(
    request: AnalyzeCompanyRequest,
    documents?: readonly RawFinancialDocument[],
    conflicts?: readonly StatementConflict[]
  ): Promise<
    ApplicationResult<{
      readonly report: ExecutiveReport;
      readonly executiveContext?: ExecutiveFinancialContext;
      /**
       * Mission 193 — Production Intake Governance & Permanent
       * Regression Gate. Divergências aritméticas de um demonstrativo
       * já declarado (D-004/Seção 31 da Mission 192 —
       * `validateStatementArithmetic()`, Indicators Engine) — sempre
       * `[]` quando nenhum `FinancialModel` foi formado ou nenhuma
       * divergência existe. Nunca bloqueia a análise; permite que a
       * governança de documento (`app/api/efos/_shared/documentGovernance.ts`)
       * marque um documento tecnicamente aceito mas aritmeticamente
       * inconsistente como `needs_review`, em vez de "processado com
       * sucesso" silencioso (Seção 24 da missão).
       */
      readonly statementArithmeticIssues: readonly StatementArithmeticIssue[];
    }>
  >;
}
