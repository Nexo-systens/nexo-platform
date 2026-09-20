import type { ApplicationResult } from "../contracts";
import type { AnalyzeCompanyRequest } from "../dto";
import { buildExecutiveFinancialContext } from "../executive-context";
import type { ExecutiveFinancialContext } from "../executive-context";
import { buildCanonicalPriorPeriods, compareExecutions } from "../history";
import type { HistoricalExecution, HistoricalExecutionService } from "../history";
import type { ExecutionRepository, ExecutionSnapshot } from "../persistence";
import type { ExecutiveReport } from "../report";
import type { AnalysisService, ReportService } from "../services";
import { periodOf } from "@/efos/engines/evidence";
import type { StatementConflict } from "@/efos/domain";
import type { RawFinancialDocument } from "@/efos/engines/data";
import { validateStatementArithmetic } from "@/efos/engines/indicators";
import type { StatementArithmeticIssue } from "@/efos/engines/indicators";

import type { EFOSFacade } from "./EFOSFacade";

/**
 * Primeira implementação concreta de `EFOSFacade` (Mission 023 — EFOS
 * Facade). Coordena exclusivamente `AnalysisService` e
 * `ReportService` — nunca executa Engines, nunca aciona o Orchestrator
 * ou o Runtime diretamente (essa autorização pertence só ao
 * `EFOSPipelineOrchestrator`, já usado internamente por
 * `AnalysisService`, D-002/D-018).
 *
 * Ambos os Services são recebidos via construtor — inversão de
 * dependência, nunca instanciados internamente (nunca `new
 * DefaultAnalysisService(...)`/`new DefaultReportService()` dentro
 * desta classe), para que a Facade permaneça válida com qualquer
 * implementação futura de `AnalysisService`/`ReportService`.
 *
 * Desde a Mission 044, `analyzeCompany()` repassa `documents` (quando
 * recebido) diretamente para `AnalysisService.analyze(request,
 * documents)` — nenhuma transformação, nenhuma validação própria;
 * `DocumentIntake` (acionado dentro de `AnalysisService`, D-022)
 * continua sendo a única camada que prepara documentos.
 *
 * Desde a Mission 066 (Executive Report Persistence, D-038, revisando
 * D-028), a Facade também recebe `ExecutionRepository`
 * (`efos/application/persistence/`, Mission 027) via construtor — a
 * persistência automática de uma execução (antes feita por
 * `DefaultAnalysisService`, com `report` sempre `undefined`) migrou
 * para cá, porque este é o único ponto que já possui
 * `metadata`+`execution`+`report` juntos, depois de
 * `ReportService.generateReport()` retornar. `analyzeCompany()` monta
 * um `ExecutionSnapshot` completo (reaproveitando `metadata`/
 * `execution`/`report` por referência, nenhum campo copiado ou
 * recalculado) e chama `ExecutionRepository.save()` uma única vez, já
 * com o relatório presente. Se `save()` rejeitar, o erro propaga
 * normalmente (sem `try/catch`, sem fallback, sem retry — mesmo
 * comportamento que D-028 já estabelecera). Nenhum Engine e nenhum
 * Builder é executado novamente para isso — `report` é o mesmo objeto
 * já produzido por `reportService.generateReport()`, exatamente como
 * está.
 *
 * **Mission 173 — Production Executive Financial Context
 * Orchestrator**: recebe também `historicalExecutionService`
 * (Mission 085) via construtor — usado por
 * `analyzeCompanyWithExecutiveContext()` (novo método ADITIVO da
 * Mission 173) e, desde a Mission 174, também por
 * `runAnalysisAndPersist()` (compartilhado pelos dois métodos
 * públicos).
 *
 * **Mission 174 — Production Temporal Evidence Input**: `runAnalysisAndPersist()`
 * agora busca o histórico comparável ANTES de rodar a análise,
 * canonicaliza-o (`buildCanonicalPriorPeriods()`,
 * `efos/application/history/`) e repassa como `priorPeriods` para
 * `AnalysisService.analyze()` — que os transporta até `EvidenceEngine`
 * através do mesmo mecanismo já usado para `documents` (D-016). Esta é
 * a primeira mudança de comportamento OBSERVÁVEL de `analyzeCompany()`
 * desde a Mission 173: toda análise real passa a poder produzir
 * Evidence temporal (D-087) quando há histórico comparável suficiente
 * e não-ambíguo — Evidence absoluta permanece inalterada em qualquer
 * cenário (aditivo, nunca substitutivo). `analyzeCompanyWithExecutiveContext()`
 * busca o histórico uma SEGUNDA vez, depois de persistir (Mission 173,
 * inalterado) — as duas janelas são estruturalmente diferentes
 * (excluindo vs. incluindo a execução atual) e nunca podem ser
 * unificadas sem reintroduzir o risco de duplicar a execução atual;
 * aceito como ineficiência mínima em nome de clareza (REGRA 15).
 */
export class DefaultEFOSFacade implements EFOSFacade {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly reportService: ReportService,
    private readonly executionRepository: ExecutionRepository,
    private readonly historicalExecutionService: HistoricalExecutionService
  ) {}

  async analyzeCompany(
    request: AnalyzeCompanyRequest,
    documents: readonly RawFinancialDocument[] = [],
    conflicts?: readonly StatementConflict[]
  ): Promise<ApplicationResult<ExecutiveReport>> {
    const result = await this.runAnalysisAndPersist(request, documents, conflicts);

    if (!result.success) {
      return result;
    }

    return { success: true, value: result.value.report };
  }

  /**
   * Mission 173 — método ADITIVO, nunca invocado pelo caminho
   * existente de `analyzeCompany()`. Executa a mesma análise e,
   * adicionalmente, monta o `ExecutiveFinancialContext` canônico
   * (Mission 114/172) a partir do histórico comparável COMPLETO da
   * empresa (D-089) — nunca uma segunda pipeline, nunca um segundo
   * cálculo financeiro.
   */
  async analyzeCompanyWithExecutiveContext(
    request: AnalyzeCompanyRequest,
    documents: readonly RawFinancialDocument[] = [],
    conflicts?: readonly StatementConflict[]
  ): Promise<
    ApplicationResult<{
      readonly report: ExecutiveReport;
      readonly executiveContext?: ExecutiveFinancialContext;
      readonly statementArithmeticIssues: readonly StatementArithmeticIssue[];
    }>
  > {
    const result = await this.runAnalysisAndPersist(request, documents, conflicts);

    if (!result.success) {
      return result;
    }

    const { report, snapshot } = result.value;
    const executiveContext = await this.buildExecutiveContext(
      request.companyId,
      snapshot
    );

    // Mission 193 — Production Intake Governance & Permanent Regression
    // Gate: mesma leitura pura já feita pelo Indicators Engine
    // internamente (`extractFinancialStatementInputs()`), reaplicada
    // aqui apenas para SUPERFÍCIE o resultado — nenhuma segunda regra
    // de validação, apenas o mesmo `validateStatementArithmetic()` já
    // oficial (D-004/Mission 192, Seção 31), lido sobre o
    // `FinancialModel` já produzido por esta MESMA execução. `[]`
    // quando o Financial Model Engine não rodou (estágio nunca
    // alcançado) ou nenhuma divergência existe.
    const statementArithmeticIssues = validateStatementArithmetic(
      snapshot.execution.financialModel?.statementLines ?? []
    );

    return { success: true, value: { report, executiveContext, statementArithmeticIssues } };
  }

  /**
   * Lógica compartilhada entre `analyzeCompany()` e
   * `analyzeCompanyWithExecutiveContext()` — roda a análise, gera o
   * `ExecutiveReport`, persiste o `ExecutionSnapshot` completo. Devolve
   * também `snapshot` para que `analyzeCompanyWithExecutiveContext()`
   * possa compor o `ExecutiveFinancialContext` sem reconstruir nada.
   *
   * **Mission 174 — Production Temporal Evidence Input**: ao contrário
   * da busca de histórico da Mission 173 (feita DEPOIS de persistir,
   * para compor `ExecutiveFinancialContext`), o histórico usado para
   * Evidence temporal precisa existir ANTES da execução atual
   * terminar — Evidence é parte da PRÓPRIA execução (D-087), nunca algo
   * composto depois dela. Por isso `historicalExecutionService.getHistory()`
   * é chamado AQUI, antes de `analysisService.analyze()` — a execução
   * atual estruturalmente NUNCA aparece neste histórico (ela ainda não
   * existe). `buildCanonicalPriorPeriods()` (`efos/application/history/`)
   * resolve reanálise de mesmo período e aborta (devolve `undefined`)
   * diante de qualquer ambiguidade real — nesse caso, a análise
   * prossegue SEM `priorPeriods` (apenas Evidence absoluta, mesmo
   * comportamento de antes desta missão), nunca bloqueada. Este é o
   * único ponto de mudança de comportamento observável de
   * `analyzeCompany()` desde a Mission 173 — intencional: toda análise
   * real passa a poder produzir Evidence temporal quando há histórico
   * comparável suficiente e não-ambíguo.
   *
   * **Mission 175R — Reanalysis Safety & Temporal Degradation
   * Closure**: `buildCanonicalPriorPeriods()` só pode canonicalizar
   * conflitos ENTRE execuções já persistidas — o período que ESTA
   * execução vai descrever só é conhecido depois que Financial
   * Model/Indicators já rodarem, dentro do próprio pipeline (D-088:
   * cronologia financeira nunca é conhecida antes de o Indicators
   * Engine calcular `Period`). Por isso a exclusão de um histórico que
   * coincide com o período atual (reanálise) ou que é
   * cronologicamente futuro é feita DENTRO do `EFOSPipelineRuntime`
   * (estágio `"evidence"`, `restrictToPeriodsStrictlyBeforeCurrent()`),
   * nunca aqui — esta função chama `analysisService.analyze()`
   * EXATAMENTE UMA VEZ, sempre; nunca há uma segunda tentativa de
   * análise como recuperação de erro (removido nesta correção — uma
   * versão anterior tentava novamente sem `priorPeriods` após
   * qualquer falha, mascarando potencialmente falhas genuínas do
   * pipeline como se fossem ambiguidade de histórico). Uma falha real
   * do pipeline (Data/Financial Model/Indicators/Evidence por motivo
   * não-temporal/Report/persistência) sempre propaga como falha real,
   * sem retry.
   */
  private async runAnalysisAndPersist(
    request: AnalyzeCompanyRequest,
    documents: readonly RawFinancialDocument[],
    conflicts?: readonly StatementConflict[]
  ): Promise<ApplicationResult<{ readonly report: ExecutiveReport; readonly snapshot: ExecutionSnapshot }>> {
    const priorHistory = await this.historicalExecutionService.getHistory(request.companyId);
    const priorPeriods = buildCanonicalPriorPeriods(request.companyId, priorHistory);

    const analysisResult = await this.analysisService.analyze(
      request,
      documents,
      priorPeriods,
      conflicts
    );

    if (!analysisResult.success) {
      return analysisResult;
    }

    const report = await this.reportService.generateReport(
      analysisResult.value.execution
    );

    const snapshot: ExecutionSnapshot = {
      metadata: analysisResult.value.metadata,
      execution: analysisResult.value.execution,
      report,
    };

    await this.executionRepository.save(snapshot);

    return { success: true, value: { report, snapshot } };
  }

  /**
   * Mission 173, Etapa 5/8/9 — compõe o `ExecutiveFinancialContext`
   * (com `financialEpisodes`) a partir do `snapshot` recém-persistido
   * e do histórico comparável COMPLETO da empresa, cumprindo D-089.
   *
   * **Caso A confirmado (Etapa 8 da missão)**: no momento em que este
   * método roda, `executionRepository.save(snapshot)` já foi concluído
   * por `runAnalysisAndPersist()` — a execução ATUAL já está
   * persistida. Por isso `historicalExecutionService.getHistory(companyId)`
   * já devolve a execução atual como parte do histórico (leitura após
   * escrita, mesma garantia que `ExecutionRepository.save()`/
   * `findByCompany()` já oferecem para qualquer outro consumidor,
   * ex.: `GET /api/efos/history/:companyId`). **Nunca apensar uma
   * segunda representação da execução atual aqui** — isso duplicaria a
   * mesma observação no histórico comparável (exatamente o erro que a
   * canonicalização de mesmo período, Mission 171, existe para
   * capturar como conflito/colapso, mas que é desnecessário provocar
   * de propósito). A identidade exata da execução atual
   * (`currentExecutionId`, D-089/Mission 172 Fix) é sempre
   * `execution.pipelineContext.executionId` — já conhecida, nunca
   * inferida do histórico.
   *
   * `history` (via `getHistory()`) não tem limite/paginação
   * (confirmado por auditoria — Mission 172 Fix) — nunca truncado por
   * esta função, cumprindo D-089 diretamente.
   *
   * `historicalIntelligence.comparison` (Mission 114/D-045/D-046) é
   * computado reaproveitando o MESMO histórico já buscado — nenhuma
   * segunda consulta ao repositório (Etapa 10 da missão) — comparando
   * a execução atual contra a execução prévia mais recente (mesmo
   * critério de ordenação já usado por `HistoricalExecutionService`,
   * inalterado por esta missão). Reanálise legítima do mesmo período
   * (Mission 171) nunca é resolvida aqui — `history` é repassado
   * integralmente para `buildExecutiveFinancialContext()`/
   * `deriveFinancialEpisodeState()`, que já decidem colapso/conflito
   * de mesmo período (Etapa 9 da missão: "the orchestrator must not
   * resolve financial truth itself").
   *
   * Devolve `undefined` (nunca uma composição parcial fabricada)
   * quando o pipeline não alcançou todos os 5 estágios necessários
   * (`indicators`/`evidence`/`context`/`reasoning`/`recommendation`)
   * ou quando o período atual não pode ser determinado — mesmo
   * princípio de omissão já usado por `ReportService`.
   */
  private async buildExecutiveContext(
    companyId: string,
    currentSnapshot: ExecutionSnapshot
  ): Promise<ExecutiveFinancialContext | undefined> {
    const { execution } = currentSnapshot;
    const { indicators, evidence, context, reasoning, recommendation } = execution;

    if (!indicators || !evidence || !context || !reasoning || !recommendation) {
      return undefined;
    }

    const period = periodOf(indicators);
    if (!period) {
      return undefined;
    }

    const currentExecutionId = execution.pipelineContext.executionId;
    const history: readonly HistoricalExecution[] =
      await this.historicalExecutionService.getHistory(companyId);

    const priorExecutions = history.filter((h) => h.executionId !== currentExecutionId);
    const currentExecution = history.find((h) => h.executionId === currentExecutionId);

    const comparison =
      priorExecutions.length > 0 && currentExecution
        ? compareExecutions(priorExecutions[priorExecutions.length - 1], currentExecution)
        : undefined;

    return buildExecutiveFinancialContext(
      companyId,
      period,
      indicators,
      evidence,
      context,
      reasoning,
      recommendation,
      comparison,
      history,
      currentExecutionId
    );
  }
}
