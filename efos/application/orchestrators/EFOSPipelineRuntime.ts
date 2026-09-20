import { EFOS_PIPELINE } from "@/efos/types";
import type { EngineStatus } from "@/efos/types";
import type { EfosEngineContext } from "@/efos/interfaces";
import type { IndicatorsAggregate, StatementConflict } from "@/efos/domain";
import type { ApplicationErrorCode } from "../shared";

import { ContextEngine } from "@/efos/engines/context";
import { DataEngine } from "@/efos/engines/data";
import type { RawFinancialDocument } from "@/efos/engines/data";
import { DecisionEngine } from "@/efos/engines/decision";
import { EvidenceEngine, periodOf } from "@/efos/engines/evidence";
import type { EvidenceHistoricalPeriod } from "@/efos/engines/evidence";
import { FinancialKnowledgeGraphEngine } from "@/efos/engines/financial-knowledge-graph";
import { FinancialModelEngine } from "@/efos/engines/financial-model";
import { IndicatorsEngine } from "@/efos/engines/indicators";
import { LearningEngine } from "@/efos/engines/learning";
import { ReasoningEngine } from "@/efos/engines/reasoning";
import { RecommendationEngine } from "@/efos/engines/recommendation";

import type { EFOSPipelineOrchestrator } from "./EFOSPipelineOrchestrator";
import type { PipelineContext } from "./PipelineContext";
import type { PipelineExecution } from "./PipelineExecution";
import type { PipelineMetadata } from "./PipelineMetadata";
import type { PipelineResult } from "./PipelineResult";
import type { PipelineStage } from "./PipelineStage";

/**
 * Erro estrutural de uma execução do pipeline — reaproveita
 * `ApplicationErrorCode` (efos/application/shared/Errors.ts) como
 * vocabulário de código, sem criar um novo (mesmo princípio de
 * D-009/D-011/D-014/D-015: revisar vocabulário existente antes de
 * duplicar). `stage` é opcional — um erro pode ocorrer antes de
 * qualquer estágio começar (ex.: `PipelineContext` inválido) ou
 * durante um estágio específico (ex.: um Engine retornou
 * `status: "failed"` — Mission 020A).
 *
 * Usado apenas para permitir uma interrupção limpa de `execute()`
 * (retornar `PipelineResult` de falha) — nunca para retry, rollback
 * ou recovery, todos explicitamente fora do escopo desta missão.
 */
export interface PipelineError {
  readonly stage?: PipelineStage;
  readonly code: ApplicationErrorCode;
  readonly message: string;
}

/**
 * Estado interno mutável de uma execução em andamento — nunca
 * persistido, nunca exposto fora de `execute()`. É a estrutura que
 * `execute()` atualiza estágio a estágio antes de convertê-la em
 * `PipelineMetadata` (imutável) para compor o `PipelineResult` final.
 */
interface PipelineRuntimeState {
  status: EngineStatus;
  currentStage?: PipelineStage;
  readonly completedStages: PipelineStage[];
  failedStage?: PipelineStage;
  readonly startedAt: string;
  finishedAt?: string;
  duration?: number;
}

function toPipelineMetadata(state: PipelineRuntimeState): PipelineMetadata {
  return {
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    duration: state.duration,
    currentStage: state.currentStage,
    completedStages: state.completedStages,
    failedStage: state.failedStage,
    status: state.status,
  };
}

/**
 * Mesma forma de `PipelineExecution` (Mission 020B), sem `readonly` —
 * usada apenas internamente por `execute()` para preencher cada campo
 * incrementalmente, um por estágio concluído. Nunca exposta fora
 * deste arquivo; o valor retornado por `execute()` é sempre o
 * `PipelineExecution` (readonly) já preenchido até aquele ponto.
 */
type PipelineExecutionDraft = {
  -readonly [K in keyof PipelineExecution]: PipelineExecution[K];
};

/**
 * Documentos financeiros brutos que alimentam o primeiro estágio
 * (Data Engine) — a única entrada de negócio que `PipelineContext`
 * (`companyId`/`requestId`/`executionId`/`timestamp`/`metadata?`) não
 * carrega em campo próprio. Transportados via `context.metadata.documents`,
 * usando `RawFinancialDocument` — o contrato oficial já definido pelo
 * Data Engine (produtor, D-002) — em vez de adicionar um campo novo a
 * `PipelineContext` ou redeclarar a forma do dado (D-016,
 * docs/DECISIONS.md).
 */
function extractRawDocuments(
  context: PipelineContext
): readonly RawFinancialDocument[] {
  const documents = context.metadata?.documents;
  return Array.isArray(documents) ? (documents as RawFinancialDocument[]) : [];
}

/**
 * Mission 174 — Production Temporal Evidence Input. Mesmo mecanismo
 * exato de `extractRawDocuments()` acima — histórico financeiro
 * comparável já canonicalizado (`buildCanonicalPriorPeriods()`,
 * `efos/application/history/`, Mission 174) transportado via
 * `context.metadata.priorPeriods`, nunca um campo novo em
 * `PipelineContext` nem um parâmetro novo em `execute()` (D-016).
 * Ausente/vazio produz exatamente o comportamento anterior a esta
 * missão: `EvidenceEngine` recebe `priorPeriods: undefined`, nenhuma
 * Evidence temporal, byte a byte como antes.
 */
function extractPriorPeriods(
  context: PipelineContext
): readonly EvidenceHistoricalPeriod[] | undefined {
  const priorPeriods = context.metadata?.priorPeriods;
  return Array.isArray(priorPeriods)
    ? (priorPeriods as EvidenceHistoricalPeriod[])
    : undefined;
}

/**
 * Mission 192 Closure B — Deterministic Statement Conflict Governance,
 * D-113. Mesmo mecanismo exato de `extractRawDocuments()`/
 * `extractPriorPeriods()` acima — conflitos de identidade temporal
 * entre demonstrativos, ja detectados por `prepareFinancialDocuments()`
 * (Application layer) ANTES do pipeline rodar, transportados via
 * `context.metadata.conflicts`, nunca um campo novo em `PipelineContext`
 * nem um parametro novo em `EFOSPipelineOrchestrator.execute()` (D-016).
 * Ausente/vazio produz exatamente `FinancialModelAggregate.statementConflicts`
 * ausente — comportamento identico a qualquer analise sem conflito.
 */
function extractStatementConflicts(
  context: PipelineContext
): readonly StatementConflict[] | undefined {
  const conflicts = context.metadata?.conflicts;
  return Array.isArray(conflicts) ? (conflicts as StatementConflict[]) : undefined;
}

/**
 * Mission 175R — Reanalysis Safety & Temporal Degradation Closure.
 *
 * `priorPeriods` (Mission 174) é canonicalizado por
 * `buildCanonicalPriorPeriods()` (`efos/application/history/`) ANTES
 * de o pipeline rodar — nesse momento, o período financeiro que ESTA
 * execução vai descrever ainda não é conhecido (só existe depois que
 * o Indicators Engine, alguns estágios à frente, calcular
 * `execution.indicators`). Por isso, uma execução histórica JÁ
 * PERSISTIDA que descreve exatamente o MESMO período financeiro da
 * execução atual (reanálise — ex.: reenvio de um documento corrigido
 * para um mês já analisado) ou um período FUTURO (cronologicamente
 * posterior ao atual, por qualquer motivo de ordem de chegada) nunca
 * poderia ter sido excluída por `buildCanonicalPriorPeriods()` — essa
 * função não tem, e não pode ter, essa informação.
 *
 * Este filtro roda exatamente aqui — estágio `"evidence"`, com
 * `execution.indicators` (o período ATUAL) já disponível — para
 * aplicar o invariante canônico que `evidence.validator.ts` (Mission
 * 166) já impõe e que este Runtime deve GARANTIR antes de chamar o
 * Engine, nunca descobrir por rejeição: `priorPeriods` contém
 * exclusivamente períodos financeiros ESTRITAMENTE anteriores ao
 * período atual — nunca por `executedAt`/ordem de execução/ordem de
 * chegada (D-088), somente `Period.startDate`/`endDate`.
 *
 * Puro e aplicado ANTES de qualquer chamada ao Engine — nunca uma
 * tentativa-e-erro (nunca "roda, falha, tenta de novo sem
 * `priorPeriods`"): uma execução histórica de mesmo período ou de
 * período futuro simplesmente nunca chega a ser oferecida como
 * `priorPeriod`, então o validador nunca tem motivo para rejeitar a
 * chamada inteira por sobreposição. Os períodos genuinamente
 * anteriores restantes (ex.: P1/P2, quando P3 é reanalisado e P3-v1
 * já persistido é excluído) permanecem elegíveis — `buildCanonicalPriorPeriods()`
 * já garante que, entre si, os candidatos vêm ordenados e sem
 * sobreposição; um subconjunto de uma sequência já ordenada/sem
 * sobreposição continua ordenada/sem sobreposição, nenhuma
 * re-canonicalização é necessária aqui, apenas um filtro.
 *
 * Nunca resolve/oculta Financial Episode Intelligence (Mission
 * 171/172) — `deriveFinancialEpisodeState()`/`canonicalizeByPeriod()`
 * continuam operando sobre o histórico PERSISTIDO completo (via
 * `DefaultEFOSFacade.buildExecutiveContext()`), nunca sobre este
 * `priorPeriods` já filtrado para Evidence — são contratos
 * deliberadamente independentes (Seção 12 da missão): reanálise de
 * mesmo período pode legitimamente continuar aparecendo como
 * `NOT_DETERMINABLE`/`SAME_PERIOD_CONFLICT` na composição de episódio,
 * mesmo que aqui, na entrada de Evidence, P3-v1 nunca tenha sido
 * oferecido como período anterior a P3-v2.
 */
function restrictToPeriodsStrictlyBeforeCurrent(
  priorPeriods: readonly EvidenceHistoricalPeriod[] | undefined,
  currentIndicators: IndicatorsAggregate
): readonly EvidenceHistoricalPeriod[] | undefined {
  if (!priorPeriods || priorPeriods.length === 0) return priorPeriods;

  const currentPeriod = periodOf(currentIndicators);
  if (!currentPeriod) return priorPeriods;

  const currentStart = new Date(currentPeriod.startDate).getTime();

  return priorPeriods.filter((prior) => {
    const priorPeriod = periodOf(prior.indicators);
    if (!priorPeriod) return false;
    return new Date(priorPeriod.endDate).getTime() <= currentStart;
  });
}

/**
 * Primeira implementação concreta do contrato `EFOSPipelineOrchestrator`
 * (Mission 018) a efetivamente encadear os 10 Engines da cadeia
 * principal (Mission 020A — Engine Wiring) e a preservar o estado
 * completo produzido durante a execução (Mission 020B — Pipeline
 * Execution State). Ciclo de vida `prepare → validate → execute →
 * finalize` (Mission 019) preservado — apenas `execute()` ganhou o
 * encadeamento real e a construção de `PipelineExecution`. Ver
 * `README.md` deste diretório, seção "Runtime", para o racional
 * completo.
 *
 * Cada Engine é instanciado aqui e conhecido apenas através do
 * contrato comum `EfosEngine`/`EfosEngineContext`/`EfosEngineResult`
 * (`efos/interfaces/engine.ts`) — nenhum Engine é importado ou chamado
 * por outro Engine (D-002); o Runtime é a única peça autorizada a
 * encadear `execute()` de múltiplos Engines (`docs/ARCHITECTURE.md`,
 * "Camadas").
 */
export class EFOSPipelineRuntime implements EFOSPipelineOrchestrator {
  private readonly dataEngine = new DataEngine();
  private readonly financialModelEngine = new FinancialModelEngine();
  private readonly indicatorsEngine = new IndicatorsEngine();
  private readonly financialKnowledgeGraphEngine =
    new FinancialKnowledgeGraphEngine();
  private readonly evidenceEngine = new EvidenceEngine();
  private readonly contextEngine = new ContextEngine();
  private readonly reasoningEngine = new ReasoningEngine();
  private readonly recommendationEngine = new RecommendationEngine();
  private readonly decisionEngine = new DecisionEngine();
  private readonly learningEngine = new LearningEngine();

  /**
   * Ponto de extensão reservado para preparo de recursos antes da
   * execução (ex.: resolver Ports concretos, inicializar um Logger —
   * `efos/application/ports/Logger.ts`, ainda sem implementação).
   * Nesta missão é um no-op — nenhuma infraestrutura é tocada.
   */
  private async prepare(context: PipelineContext): Promise<void> {
    void context;
    // Ponto de extensão de log: "pipeline preparado" (execucao
    // `context.executionId`). Nenhum Logger implementado nesta missão.
  }

  /**
   * Ponto de extensão para validação estrutural do `PipelineContext`
   * antes da execução. Única verificação real desta missão — os
   * campos identificadores obrigatórios devem estar presentes. Nunca
   * valida regra de negócio (isso pertence aos Validators de cada
   * Engine, `efos/engines/<nome>/<nome>.validator.ts`).
   */
  private async validate(
    context: PipelineContext
  ): Promise<PipelineError | undefined> {
    if (!context.companyId || !context.requestId || !context.executionId) {
      // Ponto de extensão de log: "contexto de pipeline inválido".
      return {
        code: "invalid_input",
        message:
          "PipelineContext incompleto — companyId, requestId e executionId são obrigatórios.",
      };
    }

    return undefined;
  }

  /**
   * Fluxo desde a Mission 020A/020B: recebe `PipelineContext`, cria o
   * estado interno da execução e o rascunho de `PipelineExecution`, e
   * percorre `EFOS_PIPELINE` (única fonte da ordem oficial — nunca um
   * array próprio) chamando `Engine.execute()` de cada estágio na
   * ordem oficial. A saída de cada estágio alimenta a entrada do
   * próximo — exatamente os contratos de tipo já oficiais entre
   * Engines (D-002, `docs/ARCHITECTURE.md`, seção "Contracts") — e é
   * armazenada, pela mesma referência produzida pelo Engine, no campo
   * correspondente de `PipelineExecution` (nunca recalculada, nunca
   * modificada, D-017). Se qualquer estágio retornar `status:
   * "failed"`, a execução é interrompida imediatamente — sem retry,
   * sem rollback, sem recovery.
   */
  async execute(context: PipelineContext): Promise<PipelineResult> {
    await this.prepare(context);

    const validationError = await this.validate(context);
    if (validationError) {
      const failedState: PipelineRuntimeState = {
        status: "failed",
        completedStages: [],
        failedStage: validationError.stage,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        duration: 0,
      };

      await this.finalize(context, failedState);

      return {
        success: false,
        error: { code: validationError.code, message: validationError.message },
      };
    }

    const state: PipelineRuntimeState = {
      status: "running",
      completedStages: [],
      startedAt: new Date().toISOString(),
    };

    const engineContext: EfosEngineContext = {
      companyId: context.companyId,
      pipelineRunId: context.executionId,
    };

    // Estado completo da execução — construído incrementalmente, um
    // campo por estágio concluído (Mission 020B). Cada Aggregate é
    // guardado pela mesma referência produzida pelo Engine, nunca
    // copiado ou recalculado; usado também para alimentar a entrada
    // oficial do próximo estágio (D-002), eliminando a necessidade de
    // variáveis paralelas para o mesmo dado.
    const execution: PipelineExecutionDraft = { pipelineContext: context };

    const failWith = async (
      stage: PipelineStage,
      message: string
    ): Promise<PipelineResult> => {
      state.status = "failed";
      state.failedStage = stage;
      state.currentStage = undefined;
      state.finishedAt = new Date().toISOString();
      state.duration =
        new Date(state.finishedAt).getTime() -
        new Date(state.startedAt).getTime();

      await this.finalize(context, state);

      return {
        success: false,
        error: { code: "unexpected", message },
      };
    };

    for (const stage of EFOS_PIPELINE) {
      state.currentStage = stage;

      switch (stage) {
        case "data": {
          const result = await this.dataEngine.execute(
            { companyId: context.companyId, documents: extractRawDocuments(context) },
            engineContext
          );
          if (result.status === "failed") {
            return failWith(stage, result.error ?? "Data Engine falhou.");
          }
          execution.data = result.output;
          break;
        }
        case "financial-model": {
          const result = await this.financialModelEngine.execute(
            {
              companyId: context.companyId,
              records: execution.data!,
              conflicts: extractStatementConflicts(context),
            },
            engineContext
          );
          if (result.status === "failed") {
            return failWith(
              stage,
              result.error ?? "Financial Model Engine falhou."
            );
          }
          execution.financialModel = result.output;
          break;
        }
        case "indicators": {
          const result = await this.indicatorsEngine.execute(
            {
              companyId: context.companyId,
              financialModel: execution.financialModel!,
            },
            engineContext
          );
          if (result.status === "failed") {
            return failWith(stage, result.error ?? "Indicators Engine falhou.");
          }
          execution.indicators = result.output;
          break;
        }
        case "financial-knowledge-graph": {
          const result = await this.financialKnowledgeGraphEngine.execute(
            {
              companyId: context.companyId,
              financialModel: execution.financialModel!,
              indicators: execution.indicators!,
            },
            engineContext
          );
          if (result.status === "failed") {
            return failWith(
              stage,
              result.error ?? "Financial Knowledge Graph Engine falhou."
            );
          }
          execution.financialKnowledgeGraph = result.output;
          break;
        }
        case "evidence": {
          const priorPeriods = restrictToPeriodsStrictlyBeforeCurrent(
            extractPriorPeriods(context),
            execution.indicators!
          );
          const result = await this.evidenceEngine.execute(
            {
              companyId: context.companyId,
              financialModel: execution.financialModel!,
              indicators: execution.indicators!,
              financialKnowledgeGraph: execution.financialKnowledgeGraph!,
              ...(priorPeriods && priorPeriods.length > 0 ? { priorPeriods } : {}),
            },
            engineContext
          );
          if (result.status === "failed") {
            return failWith(stage, result.error ?? "Evidence Engine falhou.");
          }
          execution.evidence = result.output;
          break;
        }
        case "context": {
          const result = await this.contextEngine.execute(
            {
              companyId: context.companyId,
              financialModel: execution.financialModel!,
              indicators: execution.indicators!,
              financialKnowledgeGraph: execution.financialKnowledgeGraph!,
              evidence: execution.evidence!,
            },
            engineContext
          );
          if (result.status === "failed") {
            return failWith(stage, result.error ?? "Context Engine falhou.");
          }
          execution.context = result.output;
          break;
        }
        case "reasoning": {
          const result = await this.reasoningEngine.execute(
            {
              companyId: context.companyId,
              financialModel: execution.financialModel!,
              indicators: execution.indicators!,
              financialKnowledgeGraph: execution.financialKnowledgeGraph!,
              evidence: execution.evidence!,
              context: execution.context!,
            },
            engineContext
          );
          if (result.status === "failed") {
            return failWith(stage, result.error ?? "Reasoning Engine falhou.");
          }
          execution.reasoning = result.output;
          break;
        }
        case "recommendation": {
          const result = await this.recommendationEngine.execute(
            {
              companyId: context.companyId,
              financialModel: execution.financialModel!,
              indicators: execution.indicators!,
              financialKnowledgeGraph: execution.financialKnowledgeGraph!,
              evidence: execution.evidence!,
              context: execution.context!,
              reasoning: execution.reasoning!,
            },
            engineContext
          );
          if (result.status === "failed") {
            return failWith(
              stage,
              result.error ?? "Recommendation Engine falhou."
            );
          }
          execution.recommendation = result.output;
          break;
        }
        case "decision": {
          const result = await this.decisionEngine.execute(
            {
              companyId: context.companyId,
              evidence: execution.evidence!,
              context: execution.context!,
              reasoning: execution.reasoning!,
              recommendation: execution.recommendation!,
            },
            engineContext
          );
          if (result.status === "failed") {
            return failWith(stage, result.error ?? "Decision Engine falhou.");
          }
          execution.decision = result.output;
          break;
        }
        case "learning": {
          const result = await this.learningEngine.execute(
            {
              companyId: context.companyId,
              evidence: execution.evidence!,
              context: execution.context!,
              reasoning: execution.reasoning!,
              recommendation: execution.recommendation!,
              decision: execution.decision!,
            },
            engineContext
          );
          if (result.status === "failed") {
            return failWith(stage, result.error ?? "Learning Engine falhou.");
          }
          execution.learning = result.output;
          break;
        }
      }

      state.completedStages.push(stage);
    }

    state.status = "completed";
    state.currentStage = undefined;
    state.finishedAt = new Date().toISOString();
    state.duration =
      new Date(state.finishedAt).getTime() - new Date(state.startedAt).getTime();

    await this.finalize(context, state);

    return {
      success: true,
      value: { metadata: toPipelineMetadata(state), execution },
    };
  }

  /**
   * Ponto de extensão reservado para limpeza pós-execução (ex.:
   * liberar recursos abertos por `prepare()`, registrar a conclusão
   * via Logger). Nesta missão é um no-op — não persiste nada, não
   * acessa infraestrutura.
   */
  private async finalize(
    context: PipelineContext,
    state: PipelineRuntimeState
  ): Promise<void> {
    void context;
    void state;
    // Ponto de extensão de log: "pipeline finalizado" (status
    // `state.status`, `state.completedStages.length` estágios
    // concluídos). Nenhum Logger implementado nesta missão.
  }
}
