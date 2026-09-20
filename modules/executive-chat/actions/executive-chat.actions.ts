"use server";

import { randomUUID } from "node:crypto";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { createClient } from "@/lib/supabase/server";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { DefaultHistoricalExecutionService, compareExecutions } from "@/efos/application/history";
import { buildExecutiveFinancialContext } from "@/efos/application/executive-context";
import { buildExecutiveKnowledgeContext } from "@/efos/application/executive-knowledge-context";
import { executeExecutiveChatAnalysis, type ExecutiveChatAnswer } from "@/efos/application/executive-chat";
import { AnthropicExecutiveChatProvider } from "@/efos/infrastructure/executive-chat";
import { getKnowledgeByCompany } from "@/modules/decisions/services/knowledge-persistence.service";
import { getKnowledgeEvaluationsGroupedByKnowledge } from "@/modules/decisions/services/knowledge-evaluation-persistence.service";
import {
  derivePeriodFromIndicators,
  hasCompleteFinancialTruth,
  resolveCurrentFinancialExecution,
} from "@/modules/decisions/lib/selectCurrentFinancialExecution";
import { sanitizePriorMessages, validateChatQuestion } from "@/modules/executive-chat/lib/sanitizeChatInput";

/**
 * Mission 188 — Executive Chat over Canonical EFOS Intelligence.
 *
 * Composição canônica única (`askExecutiveChatQuestionAction`) — mesmo
 * precedente estrutural de `activateExecutiveDiagnosisAction()`
 * (Mission 128/176/176 Closure, D-088/D-089/D-090): reaproveita, sem
 * nenhuma alteração, `resolveCurrentFinancialExecution()` (fail-closed
 * em verdade financeira ausente/ambígua/incompleta, Seção 17),
 * `buildExecutiveFinancialContext()` (Financial Truth, D-058),
 * `getKnowledgeByCompany()` + `buildExecutiveKnowledgeContext()`
 * (Knowledge GOVERNADO apenas, D-073/D-075 — Seção 7: `getLearningRecordsByCompany()`
 * nunca é chamado aqui, então `LearningRecord.humanStatement` bruto é
 * estruturalmente impossível de alcançar esta ação, nunca apenas por
 * convenção).
 *
 * **Fronteira cliente/servidor (Seção 8/11)**: o client fornece
 * exclusivamente `companyId`, `question` (texto livre, untrusted) e
 * `priorMessages?` (histórico session-local desta conversa, nunca
 * canônico, Seção 21/22) — nenhum valor financeiro, Indicator,
 * Evidence, Knowledge, confidence ou Recommendation é aceito do
 * client; toda verdade financeira é resolvida do zero, server-side, a
 * cada chamada. `user`/`company` são sempre revalidados
 * (`getCurrentUser()`/`getCompanyById()`, RLS-scoped) — `companyId` do
 * client nunca é aceito como autorização por si só (Seção 9/10).
 *
 * **Nunca**: cria `Recommendation`/`Decision`/`Scenario`/`Learning`/
 * `Knowledge` (nenhuma dessas funções é sequer importada aqui);
 * invoca o Scenario Engine (`runSingleScenario()` nunca importado);
 * persiste a conversa (Seção 39/D-103 — `ExecutiveChatAnswer` é
 * devolvido ao client e nunca gravado).
 */

export interface AskExecutiveChatQuestionInput {
  readonly companyId: string;
  readonly question: string;
  readonly priorMessages?: readonly { readonly role: string; readonly content: string }[];
}

export type AskExecutiveChatQuestionResult =
  | { readonly success: true; readonly answer: ExecutiveChatAnswer }
  | {
      readonly success: false;
      readonly stage: "auth" | "access" | "input" | "financial-truth" | "provider";
      readonly error: string;
    };

export async function askExecutiveChatQuestionAction(
  input: AskExecutiveChatQuestionInput
): Promise<AskExecutiveChatQuestionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, stage: "auth", error: "Sessão expirada. Faça login novamente." };
  }

  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, stage: "access", error: "Empresa não encontrada ou sem acesso." };
  }

  const questionValidation = validateChatQuestion(input.question);
  if (!questionValidation.valid) {
    return { success: false, stage: "input", error: questionValidation.error };
  }

  const supabaseClient = await createClient();
  const persistenceClient = new SupabasePersistenceClient(supabaseClient);
  const executionRepository = new SupabaseExecutionRepository(persistenceClient);
  const historicalExecutionService = new DefaultHistoricalExecutionService(executionRepository);

  const history = await historicalExecutionService.getHistory(input.companyId);
  const resolution = resolveCurrentFinancialExecution(input.companyId, history);

  if (resolution.outcome === "no-history") {
    return {
      success: false,
      stage: "financial-truth",
      error: "Nenhuma análise executada ainda para esta empresa — não há contexto financeiro suficiente para responder perguntas ainda.",
    };
  }

  if (resolution.outcome === "ambiguous") {
    // Mission 188 — mesma disciplina fail-closed de
    // `activateExecutiveDiagnosisAction()` (D-088/D-090): identidade de
    // execução nunca estabelece autoridade financeira; o Executive Chat
    // nunca responde com base em verdade financeira ambígua (Seção 17).
    const detail =
      resolution.reason === "malformed"
        ? "uma execução do período financeiro mais recente está incompleta"
        : resolution.reason === "unpositionable"
          ? "existe uma execução real desta empresa cujo período financeiro não pôde ser determinado"
          : "existem execuções conflitantes para o período financeiro mais recente, sem uma verdade financeira única defensável";
    return {
      success: false,
      stage: "financial-truth",
      error: `Não é possível estabelecer a verdade financeira atual desta empresa (${detail}) — reanalise o período mais recente antes de usar o Executive Chat.`,
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

  const priorExecutions = history.filter((h) => h.executionId !== currentHistoricalExecution.executionId);
  const comparison =
    priorExecutions.length > 0 ? compareExecutions(priorExecutions[priorExecutions.length - 1], currentHistoricalExecution) : undefined;

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

  // Mission 188, Seção 7/19 — apenas Knowledge GOVERNADO entra no
  // contexto de Chat, através do MESMO mecanismo canônico de relevância
  // (`selectRelevantKnowledge()`, D-074, nunca reimplementado).
  // `getLearningRecordsByCompany()` nunca é chamado nesta ação — o
  // `LearningRecord.humanStatement` bruto (D-100) é estruturalmente
  // inacessível a partir daqui.
  const [knowledgeRecords, evaluationsByKnowledge] = await Promise.all([
    getKnowledgeByCompany(input.companyId),
    getKnowledgeEvaluationsGroupedByKnowledge(input.companyId),
  ]);
  const knowledgeContext = buildExecutiveKnowledgeContext(
    knowledgeRecords,
    { companyId: input.companyId, asOf: new Date().toISOString() },
    evaluationsByKnowledge
  );

  const provider = new AnthropicExecutiveChatProvider();
  const result = await executeExecutiveChatAnalysis(
    provider,
    context,
    randomUUID(),
    { text: questionValidation.text },
    knowledgeContext,
    sanitizePriorMessages(input.priorMessages)
  );

  if (!result.success) {
    return { success: false, stage: "provider", error: result.error.message };
  }

  return { success: true, answer: result.value };
}
