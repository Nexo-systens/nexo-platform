"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { createClient } from "@/lib/supabase/server";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { AnthropicExecutiveAIProvider } from "@/efos/infrastructure/executive-ai";
import { buildExecutiveFinancialContext } from "@/efos/application/executive-context";
import { executeExecutiveAnalysis } from "@/efos/application/executive-ai";
import { buildExecutiveKnowledgeContext } from "@/efos/application/executive-knowledge-context";
import {
  DefaultHistoricalExecutionService,
  compareExecutions,
} from "@/efos/application/history";
import { saveExecutiveDiagnosis, type PersistedExecutiveDiagnosis } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { getKnowledgeByCompany } from "@/modules/decisions/services/knowledge-persistence.service";
import { getKnowledgeEvaluationsGroupedByKnowledge } from "@/modules/decisions/services/knowledge-evaluation-persistence.service";
import {
  derivePeriodFromIndicators,
  hasCompleteFinancialTruth,
  resolveCurrentFinancialExecution,
} from "@/modules/decisions/lib/selectCurrentFinancialExecution";

/**
 * Mission 128 — Executive Diagnosis Activation & Persistence
 * Integration. Composição canônica única (`activateExecutiveDiagnosisAction`)
 * que fecha a cadeia:
 *
 *   Financial Truth (histórico determinístico já persistido, D-023)
 *     → buildExecutiveFinancialContext() (D-058), com histórico COMPLETO (D-089)
 *     → executeExecutiveAnalysis() (D-060/D-061, provider Anthropic D-062)
 *     → validateExecutiveDiagnosis() (D-059, chamado internamente por
 *       executeExecutiveAnalysis, nunca duplicado aqui)
 *     → saveExecutiveDiagnosis() (D-066)
 *     → PersistedExecutiveDiagnosis devolvido ao client.
 *
 * Nenhuma outra função em `modules/decisions/` ou `app/` está
 * autorizada a repetir esta orquestração — componentes, rotas,
 * provider e repositórios permanecem apenas consumidores desta única
 * composição (Mission 128, Etapa 4).
 *
 * **Nunca**: persistir diagnóstico antes de `validateExecutiveDiagnosis()`
 * (garantido estruturalmente — `executeExecutiveAnalysis()` só devolve
 * `success:true` após validação completa, Result nunca lançado antes
 * disso); criar `DiagnosisReview`/`Decision` automaticamente (esta
 * ativação termina em `PersistedExecutiveDiagnosis`, Mission 128,
 * Etapa 10); aceitar `companyId` do client como autorização (sempre
 * revalidado via `getCompanyById()`, RLS-scoped) — nem, desde sempre,
 * qualquer outro dado financeiro do client: esta ação recebe
 * exclusivamente `{companyId}` e resolve TODA a verdade financeira do
 * lado do servidor a partir de execuções já persistidas — o client
 * nunca fornece `executionId`, `report`, indicadores, Evidence ou
 * `financialEpisodes` (Mission 176, fronteira de confiança confirmada
 * por auditoria, nunca alterada).
 *
 * **Mission 176 — Production Executive Diagnosis with Full EFOS
 * Context**: até esta missão, `buildExecutiveFinancialContext()` era
 * chamada aqui apenas com os 7 argumentos obrigatórios — nunca
 * `comparison`/`executions`/`currentExecutionId` — então
 * `ExecutiveDiagnosis` nunca via `financialEpisodes` (Mission 171/172),
 * mesmo quando a análise mais recente já os produzia (Mission
 * 173/174/175). Corrigido: esta ação agora busca o histórico COMPLETO
 * via `HistoricalExecutionService.getHistory()` (D-089, sem
 * limite/paginação — mesma abstração de Application Layer já usada
 * por `DefaultEFOSFacade`, nunca uma segunda consulta direta ao
 * repositório de infraestrutura para o mesmo propósito) e repassa
 * `executions`/`currentExecutionId` a `buildExecutiveFinancialContext()`
 * — nunca reconstruindo `financialEpisodes` manualmente, nunca
 * anexando-os ao prompt por fora do builder canônico (Requisito 6 da
 * missão).
 *
 * **Seleção de execução atual corrigida (D-088/D-090)**: a versão
 * original (Mission 128) escolhia a execução "mais recente" por
 * `metadata.startedAt` (`executedAt`) — confundindo tempo de execução
 * com verdade financeira. A Mission 176 corrigiu a cronologia (Period,
 * nunca `executedAt`) mas resolvia EMPATES de mesmo período (reanálise)
 * por desempate de `executionId` — o que ainda permitia que duas
 * execuções do MESMO período com valores MATERIALMENTE diferentes
 * fossem silenciosamente resolvidas para uma delas.
 *
 * **Mission 176 Closure — Current Financial Truth Canonicalization**:
 * `resolveCurrentFinancialExecution()` (`modules/decisions/lib/`)
 * separa duas perguntas nunca fundidas — (A) qual é o período
 * financeiro mais recente (cronologia pura, `Period`) e (B) existe UMA
 * verdade financeira defensável para esse período (nunca assumida).
 * Todas as execuções que compartilham o período mais recente são
 * classificadas: **malformed** (uma delas não tem os 6 agregados
 * completos — desconhecido ≠ equivalente, fail closed); **conflicting**
 * (todas completas, mas o conteúdo financeiro diverge materialmente
 * entre pelo menos duas — fail closed, NUNCA resolvido por
 * `executionId`/`executedAt`/ordem); **equivalent** (grupo de tamanho 1,
 * ou >1 com conteúdo financeiro comprovadamente idêntico — SOMENTE
 * então um desempate operacional por `executionId` escolhe qual objeto
 * concreto representa a classe já provada equivalente). Um
 * malformado/conflito num período MAIS ANTIGO nunca bloqueia a
 * resolução da verdade atual — isso permanece exclusivamente
 * responsabilidade de `deriveFinancialEpisodeState()` (Mission
 * 171/171 Fix), que recebe o histórico COMPLETO e pode legitimamente
 * produzir `NOT_DETERMINABLE`/`SAME_PERIOD_CONFLICT` para esse período
 * mais antigo sem nunca impedir o diagnóstico do período atual
 * genuinamente não-ambíguo.
 */

export type ActivateExecutiveDiagnosisResult =
  | { readonly success: true; readonly diagnosis: PersistedExecutiveDiagnosis }
  | { readonly success: false; readonly error: string; readonly stage: "auth" | "access" | "financial-truth" | "provider" | "persistence" };

export async function activateExecutiveDiagnosisAction(input: {
  readonly companyId: string;
}): Promise<ActivateExecutiveDiagnosisResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, stage: "auth", error: "Sessão expirada. Faça login novamente." };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, stage: "access", error: "Empresa não encontrada ou sem acesso." };
  }

  const supabaseClient = await createClient();
  const persistenceClient = new SupabasePersistenceClient(supabaseClient);
  const executionRepository = new SupabaseExecutionRepository(persistenceClient);
  // Mission 176 — mesma abstração de Application Layer já usada por
  // `DefaultEFOSFacade`/`GET /api/efos/history/[companyId]` (D-089,
  // sem limite/paginação) — nunca uma segunda consulta direta de
  // infraestrutura para o mesmo propósito.
  const historicalExecutionService = new DefaultHistoricalExecutionService(executionRepository);

  const history = await historicalExecutionService.getHistory(input.companyId);
  const resolution = resolveCurrentFinancialExecution(input.companyId, history);

  if (resolution.outcome === "no-history") {
    return {
      success: false,
      stage: "financial-truth",
      error: "Nenhuma análise executada ainda para esta empresa — execute a análise antes de ativar o diagnóstico executivo.",
    };
  }

  if (resolution.outcome === "ambiguous") {
    // Mission 176 Closure/Final Closure — fail closed ANTES de chamar
    // o provider: identidade de execução (executionId/executedAt/
    // ordem) nunca estabelece autoridade financeira. "malformed" = uma
    // execução do período mais recente não tem os 6 agregados
    // completos (desconhecido ≠ equivalente); "conflicting" = todas
    // completas, mas o conteúdo financeiro diverge materialmente entre
    // pelo menos duas; "unpositionable" = existe uma execução real
    // desta empresa sem período financeiro extraível que não pôde ser
    // provada irrelevante ao FinancialModel atual — sua ausência de
    // período nunca prova que ela é mais antiga que qualquer outra
    // (D-088/D-090) — nenhum dos três casos escolhe silenciosamente um
    // lado.
    const detail =
      resolution.reason === "malformed"
        ? "uma execução do período financeiro mais recente está incompleta"
        : resolution.reason === "unpositionable"
          ? "existe uma execução real desta empresa cujo período financeiro não pôde ser determinado, e que não é possível descartar como irrelevante ao período atual"
          : "existem execuções conflitantes para o período financeiro mais recente, sem uma verdade financeira única defensável";
    return {
      success: false,
      stage: "financial-truth",
      error: `Não é possível estabelecer a verdade financeira atual desta empresa (${detail}) — reanalise o período mais recente para resolver a ambiguidade antes de ativar o diagnóstico executivo.`,
    };
  }

  const currentHistoricalExecution = resolution.execution;
  const execution = currentHistoricalExecution.snapshot.execution;
  if (!hasCompleteFinancialTruth(execution)) {
    return {
      success: false,
      stage: "financial-truth",
      error: "A execução mais recente está incompleta — não é possível construir o contexto executivo a partir dela.",
    };
  }

  const period = derivePeriodFromIndicators(execution.indicators);
  if (!period) {
    return {
      success: false,
      stage: "financial-truth",
      error: "A execução mais recente não possui indicadores — não é possível derivar o período de referência.",
    };
  }

  // Mission 176 — Requisito 7 (D-089): `comparison` reaproveita o
  // MESMO histórico já buscado (nenhuma segunda consulta), comparando
  // a execução ATUAL contra a execução prévia mais recente — mesmo
  // critério já estabelecido por `DefaultEFOSFacade.buildExecutiveContext()`
  // (Mission 173). Reanálise legítima do mesmo período nunca é
  // resolvida aqui — o histórico COMPLETO (`history`, nunca truncado)
  // é repassado integralmente a `buildExecutiveFinancialContext()`
  // abaixo, que decide colapso/conflito de mesmo período via
  // `deriveFinancialEpisodeState()` (Mission 171/171 Fix).
  const priorExecutions = history.filter(
    (h) => h.executionId !== currentHistoricalExecution.executionId
  );
  const comparison =
    priorExecutions.length > 0
      ? compareExecutions(priorExecutions[priorExecutions.length - 1], currentHistoricalExecution)
      : undefined;

  const context = buildExecutiveFinancialContext(
    input.companyId,
    period,
    execution.indicators,
    execution.evidence,
    execution.context,
    execution.reasoning,
    execution.recommendation,
    comparison,
    history,
    currentHistoricalExecution.executionId
  );

  // Mission 143 — Knowledge Injection into Executive Analysis (D-075).
  // `getKnowledgeByCompany()` (Mission 141) + `buildExecutiveKnowledgeContext()`
  // (que reaproveita `selectRelevantKnowledge()`, Mission 142, sem
  // duplicar company/temporal/structural filtering) — `asOf` é "agora"
  // porque esta é uma análise ao vivo (não uma reconstrução histórica),
  // resolvido aqui (Server Action, tem permissão de ler o relógio),
  // nunca dentro de nenhuma função pura. Ausência de Knowledge real
  // (`knowledgeRecords.length === 0`) nunca bloqueia a análise —
  // `buildExecutiveKnowledgeContext()` devolve honestamente
  // `selectionOutcome: "NO_RELEVANT_KNOWLEDGE"` e o fluxo continua
  // normalmente, exatamente como antes desta missão.
  //
  // Mission 147 — Knowledge-Aware Executive Intelligence (D-079).
  // `getKnowledgeEvaluationsGroupedByKnowledge()` (Mission 146) fornece
  // o histórico real de avaliações por Knowledge — 3º argumento
  // aditivo de `buildExecutiveKnowledgeContext()`, que chama
  // internamente `deriveKnowledgeState()` (D-078, única fonte de
  // verdade, nunca recalculada aqui) para cada Knowledge selecionado.
  // Ausência de avaliações reais para um Knowledge específico produz
  // honestamente `state: "EMERGING"` para aquele item — nunca um erro,
  // nunca um estado fabricado.
  const [knowledgeRecords, evaluationsByKnowledge] = await Promise.all([
    getKnowledgeByCompany(input.companyId),
    getKnowledgeEvaluationsGroupedByKnowledge(input.companyId),
  ]);
  const knowledgeContext = buildExecutiveKnowledgeContext(
    knowledgeRecords,
    { companyId: input.companyId, asOf: new Date().toISOString() },
    evaluationsByKnowledge
  );

  const provider = new AnthropicExecutiveAIProvider();
  const analysis = await executeExecutiveAnalysis(provider, context, randomUUID(), knowledgeContext);

  if (!analysis.success) {
    return { success: false, stage: "provider", error: analysis.error.message };
  }

  try {
    const persisted = await saveExecutiveDiagnosis(input.companyId, analysis.value, {
      executionId: currentHistoricalExecution.executionId,
      providerName: provider.providerName,
    });

    revalidatePath(`/companies/${input.companyId}`);
    return { success: true, diagnosis: persisted };
  } catch {
    return {
      success: false,
      stage: "persistence",
      error: "O diagnóstico foi gerado e validado, mas não foi possível persisti-lo. Nenhum diagnóstico foi salvo — tente novamente.",
    };
  }
}
