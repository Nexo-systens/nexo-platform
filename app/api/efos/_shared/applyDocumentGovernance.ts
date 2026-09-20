import type { RawFinancialDocument } from "@/efos/engines/data";
import type { StatementArithmeticIssue } from "@/efos/engines/indicators";
import type { DocumentRow } from "@/modules/documents/services/document.service";
import {
  beginDocumentsProcessingAttempt,
  updateDocumentGovernance,
  updateDocumentsStatus,
} from "@/modules/documents/services/document.service";

import { buildDocumentGovernanceResults } from "./documentGovernance";
import type { DocumentGovernanceResult } from "./documentGovernance";
import type { ProcessingAttempt } from "./processingAttempt";
import type { ExcludedDocument } from "./resolveStatementConflicts";

export type { ProcessingAttempt } from "./processingAttempt";
export { beginProcessingAttempt } from "./processingAttempt";

/**
 * Mission 193 — Production Intake Governance & Permanent Regression
 * Gate. Únicas funções que gravam, em `public.documents`, o resultado
 * de uma análise sobre documentos já armazenados — reutilizadas pelas
 * duas rotas que leem `listAnalyzableDocumentsByCompany()`
 * (`analyze/[companyId]/route.ts` e `.../executive/route.ts`), nunca
 * duplicadas entre elas (mesmo princípio de "nunca um segundo
 * pipeline" já aplicado a `prepareFinancialDocuments()`).
 *
 * Duas escritas estruturalmente distintas, DELIBERADAMENTE separadas
 * em duas funções (Seção 5/15 da missão original — "technical error"
 * nunca é "financial limitation"/"normal governance"):
 *
 * 1. **Status técnico** (`applyDocumentTechnicalStatus()`) — reflete
 *    apenas se o arquivo foi tecnicamente lido/classificado pelo
 *    pipeline (`processed`) ou não (`failed`). Chamada assim que
 *    `prepareFinancialDocuments()` retorna com sucesso — ANTES de
 *    qualquer chamada ao pipeline financeiro (`platform.analyzeCompany*()`)
 *    — Mission 193 Closure, Seção 4/6: status técnico nunca pode ser
 *    reescrito por uma falha posterior e categoricamente diferente
 *    (Financial Model/Indicators/persistência/relatório).
 * 2. **Desfecho de governança** (`applyDocumentGovernanceOutcomes()`)
 *    — apenas quando a análise de fato produziu um `ExecutiveReport`;
 *    nunca escrito para um documento tecnicamente `failed`.
 *
 * Mission 193 Closure — Technical Status Ownership & Concurrent
 * Governance Safety: ambas as escritas agora são CONDICIONADAS a uma
 * `ProcessingAttempt` (`processingAttempt.ts`) — a tentativa mais
 * recentemente INICIADA (nunca a que TERMINA por último) é a única
 * autorizada a finalizar o status técnico e a substituir a governança
 * já persistida (D-116).
 *
 * Mission 193 Closure B — Database-Authoritative Processing Attempt
 * Ordering: a ordem passou a ser `ProcessingAttempt.revision` (bigint
 * de uma sequence do Postgres, obtida antes de qualquer I/O), nunca
 * mais `attemptId`/`startedAt` (relógio de aplicação, insuficiente sob
 * concorrência real — D-117).
 */
export async function beginDocumentProcessing(
  storedDocuments: readonly DocumentRow[],
  attempt: ProcessingAttempt
): Promise<void> {
  await beginDocumentsProcessingAttempt(
    storedDocuments.map((document) => document.id),
    attempt
  );
}

export async function applyDocumentTechnicalStatus(params: {
  readonly storedDocuments: readonly DocumentRow[];
  readonly preparedDocuments: readonly RawFinancialDocument[];
  readonly excluded: readonly ExcludedDocument[];
  readonly attempt: ProcessingAttempt;
}): Promise<void> {
  const { storedDocuments, preparedDocuments, excluded, attempt } = params;

  const technicallyClassifiedIds = new Set([
    ...preparedDocuments.map((document) => document.documentId),
    ...excluded.map((entry) => entry.documentId),
  ]);

  const processedIds = storedDocuments
    .filter((document) => technicallyClassifiedIds.has(document.id))
    .map((document) => document.id);
  const failedIds = storedDocuments
    .filter((document) => !technicallyClassifiedIds.has(document.id))
    .map((document) => document.id);

  await Promise.all([
    updateDocumentsStatus(processedIds, "processed", attempt),
    updateDocumentsStatus(failedIds, "failed", attempt),
  ]);
}

export async function applyDocumentGovernanceOutcomes(params: {
  readonly preparedDocuments: readonly RawFinancialDocument[];
  readonly excluded: readonly ExcludedDocument[];
  readonly statementArithmeticIssues: readonly StatementArithmeticIssue[];
  readonly executionId: string;
  readonly attempt: ProcessingAttempt;
}): Promise<readonly DocumentGovernanceResult[]> {
  const { preparedDocuments, excluded, statementArithmeticIssues, executionId, attempt } = params;

  const governanceResults = buildDocumentGovernanceResults(
    preparedDocuments,
    excluded,
    statementArithmeticIssues
  );

  const evaluatedAt = new Date().toISOString();

  await Promise.all(
    governanceResults.map((result) =>
      updateDocumentGovernance(
        result.documentId,
        {
          executionId,
          outcome: result.outcome,
          reason: result.reason,
          evaluatedAt,
        },
        attempt
      )
    )
  );

  return governanceResults;
}

/**
 * Melhor esforço para nunca deixar um documento preso em `processing`
 * (Seção 12/13 da missão original) — chamado SOMENTE do `catch` da FASE
 * DE PREPARAÇÃO (download/parse/classificação/D-113), quando uma
 * exceção verdadeiramente inesperada (não isolável por documento —
 * Seção 5 da missão de fechamento já isola download/parse por
 * documento antes disso) interrompeu a preparação ANTES de se saber o
 * status técnico de qualquer documento. Marca TODOS os documentos lidos
 * como `failed` — pessimista deliberadamente (nenhuma informação mais
 * fina disponível neste ponto) — mas ainda CONDICIONADO à
 * `ProcessingAttempt` (nunca sobrescreve uma tentativa mais nova que já
 * tenha assumido algum destes documentos). Mission 193 Closure, Seção
 * 6/18: NUNCA chamado a partir da fase de ANÁLISE financeira (pipeline/
 * persistência/relatório) — essa fase começa DEPOIS que o status
 * técnico já foi finalizado corretamente por `applyDocumentTechnicalStatus()`,
 * e uma falha ali nunca pode reescrever um status técnico já correto.
 */
export async function markDocumentsFailed(
  storedDocuments: readonly DocumentRow[],
  attempt: ProcessingAttempt
): Promise<void> {
  await updateDocumentsStatus(
    storedDocuments.map((document) => document.id),
    "failed",
    attempt
  );
}
