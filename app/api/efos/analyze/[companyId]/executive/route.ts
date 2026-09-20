import { NextResponse } from "next/server";

import type { RawFinancialDocument } from "@/efos/engines/data";
import type { StatementConflict } from "@/efos/domain";
import { createClient } from "@/lib/supabase/server";
import { EFOSPlatform } from "@/efos/platform";
import { getCompanyById } from "@/modules/companies/services/company.service";
import type { DocumentRow } from "@/modules/documents/services/document.service";
import {
  downloadDocumentFile,
  listAnalyzableDocumentsByCompany,
  listDocumentGovernanceByExecution,
} from "@/modules/documents/services/document.service";
import type { DocumentGovernanceOutcome } from "../../../_shared/documentGovernance";

import {
  applyDocumentGovernanceOutcomes,
  applyDocumentTechnicalStatus,
  beginDocumentProcessing,
  beginProcessingAttempt,
  markDocumentsFailed,
} from "../../../_shared/applyDocumentGovernance";
import type { ExcludedDocument } from "../../../_shared/resolveStatementConflicts";
import { prepareFinancialDocuments } from "../../../_shared/prepareFinancialDocuments";

// Mission 175 — Production Executive Analysis API. Endpoint canônico
// (único) de análise executiva da Plataforma — Mission 197 removeu os
// dois irmãos legados (`POST /api/efos/upload`, `POST /api/efos/analyze/
// [companyId]` sem contexto executivo) por não terem consumidor real
// algum (confirmado por busca em todo o código-fonte por chamadas
// client-side) e por dependerem de RLS para eventualmente rejeitar um
// `companyId` não autorizado, em vez de estabelecer autoridade de
// empresa deliberadamente na fronteira HTTP (Seção 5 da missão). Este
// arquivo permanece a única porta de entrada HTTP de análise executiva
// em produção.
//
// Mission 197, Seção 5 — Company Authority at HTTP Boundary:
// `getCompanyById(companyId)` (mesmo mecanismo canônico já usado por
// `app/(app)/companies/[id]/page.tsx`, RLS-scoped) é chamado ANTES de
// qualquer I/O de documento/Storage/pipeline — um `companyId` que não
// pertence ao usuário autenticado (ou que não existe) nunca aciona
// `beginProcessingAttempt()`/download/parsing/Engines, nunca apenas
// "descoberto" depois por uma escrita de `executions`/`documents`
// rejeitada pelo RLS. `getCompanyById()` devolve `null` tanto para
// "não existe" quanto para "não autorizado" (mesmo não-vazamento de
// informação já usado por `notFound()` na página da empresa) — a
// resposta aqui espelha essa ambiguidade deliberada, nunca distinguindo
// os dois casos para quem chama a API.
// erro — a ÚNICA diferença é a chamada final a
// `platform.analyzeCompanyWithExecutiveContext()` em vez de
// `platform.analyzeCompany()` (EFOSPlatform, Mission 175, repassando
// para o método ADITIVO já existente em EFOSFacade desde a Mission
// 173). Nunca uma segunda pipeline de análise, nunca um segundo
// parser/document-loader — reaproveita exatamente a mesma sequência
// oficial de preparação de documentos (`prepareFinancialDocuments()`,
// Mission 082/083) e a mesma leitura de documentos já armazenados via
// `modules/documents` (Mission 082), sob a mesma RLS de sempre —
// nenhuma checagem de autorização nova, nenhuma checagem de
// autorização removida.
//
// Endpoint DEDICADO (Option B, Seção 4 da missão), não uma extensão
// de `POST /api/efos/analyze/[companyId]`: `ExecutiveAnalysisPanel.tsx`
// (único consumidor real do endpoint existente) já depende, em
// produção, de que a resposta seja exatamente
// `ApplicationResult<ExecutiveReport>` no nível raiz — estender o
// endpoint existente para devolver `{report, executiveContext}`
// quebraria esse consumidor sem nenhum benefício de superfície de API
// (a mesma pipeline já é reaproveitada, apenas por um método ADITIVO
// diferente da Facade). Nenhuma Inteligência Artificial é acionada
// aqui — `ExecutiveDiagnosis`/`executeExecutiveAnalysis()` já são
// produzidos por um fluxo de produto separado e existente
// (`activateExecutiveDiagnosisAction()`, `modules/decisions/actions/
// executive-diagnosis.actions.ts`, Mission 128), acionado
// explicitamente pelo usuário DEPOIS que uma análise já foi
// executada — bundlar IA aqui introduziria um novo ciclo de vida de
// provider dentro de um endpoint que hoje é puramente determinístico,
// e duplicaria a única composição de IA já estabelecida em produção.
//
// Mission 193 Closure — Technical Status Ownership & Concurrent
// Governance Safety. Duas fases, DELIBERADAMENTE em blocos try/catch
// separados (Seção 4/6): (1) PREPARAÇÃO — lê documentos armazenados,
// declara uma nova tentativa de processamento (`beginProcessingAttempt()`,
// sempre incondicional), baixa cada arquivo do Storage de forma
// ISOLADA (`Promise.allSettled`, nunca `Promise.all` — uma falha de
// download em UM documento nunca aborta o lote inteiro, Seção 5),
// prepara/classifica/resolve conflitos, e finaliza o status TÉCNICO
// (`processed`/`failed`) — condicionado à tentativa ainda ser a ativa
// (nunca sobrescreve uma tentativa mais nova). (2) ANÁLISE FINANCEIRA —
// roda o pipeline EFOS inteiro e persiste governança; uma falha AQUI
// (Financial Model/Indicators/persistência/relatório) NUNCA toca
// `documents.status` — ele já foi corretamente finalizado na fase 1,
// e uma falha categoricamente diferente (financeira, não técnica)
// nunca pode reescrevê-lo (Seção 2/6/18 da missão de fechamento).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unauthorized",
          message: "Empresa não encontrada ou não autorizada.",
        },
      },
      { status: 404 }
    );
  }

  const attempt = await beginProcessingAttempt();

  let storedDocuments: readonly DocumentRow[] = [];
  let preparedDocuments: readonly RawFinancialDocument[] = [];
  let excluded: readonly ExcludedDocument[] = [];
  let conflicts: readonly StatementConflict[] = [];

  try {
    storedDocuments = await listAnalyzableDocumentsByCompany(companyId);
    await beginDocumentProcessing(storedDocuments, attempt);

    // Seção 5 da missão de fechamento: download isolado por documento —
    // `Promise.allSettled` nunca deixa a falha de Storage de UM
    // documento abortar o carregamento dos demais. Um documento cujo
    // download falhou nunca chega a `prepareFinancialDocuments()` — o
    // set-difference de `applyDocumentTechnicalStatus()` abaixo já o
    // infere corretamente como `failed` (nunca aparece nem entre os
    // aceitos, nem entre os excluídos por governança).
    const downloadOutcomes = await Promise.allSettled(
      storedDocuments.map(async (document) => {
        const blob = await downloadDocumentFile(document.storage_path);
        const file = new File([blob], document.nome_original, {
          type: document.tipo_arquivo,
        });
        return { file, documentId: document.id };
      })
    );
    const filesToAnalyze = downloadOutcomes
      .filter(
        (outcome): outcome is PromiseFulfilledResult<{ file: File; documentId: string }> =>
          outcome.status === "fulfilled"
      )
      .map((outcome) => outcome.value);

    ({ documents: preparedDocuments, excluded, conflicts } = await prepareFinancialDocuments(
      filesToAnalyze,
      companyId
    ));

    // Status TÉCNICO finalizado AQUI, antes de qualquer chamada ao
    // pipeline financeiro (fase 2) — nada depois deste ponto pode
    // reescrevê-lo (Seção 4/6).
    await applyDocumentTechnicalStatus({ storedDocuments, preparedDocuments, excluded, attempt });
  } catch (error) {
    try {
      await markDocumentsFailed(storedDocuments, attempt);
    } catch {
      // Melhor esforço — nunca mascara o erro original da preparação.
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unexpected",
          message:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao preparar os documentos para análise.",
        },
      },
      { status: 500 }
    );
  }

  try {
    const supabaseClient = await createClient();
    const platform = new EFOSPlatform(supabaseClient);
    const result = await platform.analyzeCompanyWithExecutiveContext(
      companyId,
      preparedDocuments,
      conflicts
    );

    // Desfecho de governança (`accepted`/`needs_review`/exclusões) só é
    // gravado quando a análise de fato produziu um `ExecutiveReport`
    // (única fonte de `executionId`/`statementArithmeticIssues`).
    const statementArithmeticIssues = result.success ? result.value.statementArithmeticIssues : [];
    const documentGovernance = result.success
      ? await applyDocumentGovernanceOutcomes({
          preparedDocuments,
          excluded,
          statementArithmeticIssues,
          executionId: result.value.report.metadata.executionId,
          attempt,
        })
      : [];

    // Mission 192, Seção 23 / Mission 192 Closure B, D-113 / Mission
    // 193, Seção 6-7: `documentGovernance` é o único vocabulário
    // server-autoritativo por documento (superset canônico de
    // `excludedDocuments`/`statementConflicts`, mantidos por
    // compatibilidade/depuração) — a UI nunca deve reclassificar por
    // conta própria.
    return NextResponse.json({
      ...result,
      excludedDocuments: excluded,
      statementConflicts: conflicts,
      documentGovernance,
    });
  } catch (error) {
    // Mission 193 Closure, Seção 6/18: NUNCA chama `markDocumentsFailed()`
    // aqui — o status técnico já foi finalizado corretamente na fase de
    // preparação (acima); uma falha financeira/de persistência/de
    // relatório nunca pode retroativamente marcar um documento
    // tecnicamente saudável como `failed`.
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unexpected",
          message:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao executar a análise executiva.",
        },
      },
      { status: 500 }
    );
  }
}

// Mission 199B Closure — Persisted Analysis Hydration (Bug P1:
// `ExecutiveAnalysisPanel` nunca lia a última execução já persistida
// ao montar — cada reload/retorno à página voltava a exibir "Nenhuma
// análise executada ainda" mesmo com uma execução canônica existindo).
// Companheira SOMENTE LEITURA do `POST` acima, no mesmo path (par
// REST padrão: POST cria/roda, GET lê o que já existe) — nunca chama
// `beginProcessingAttempt()`/Storage/o pipeline financeiro; repassa
// direto para `EFOSPlatform.getLatestExecutiveAnalysis()` (aditivo,
// Mission 199B), que por sua vez reaproveita a MESMA composição pura
// (`buildExecutiveFinancialContext()`) já usada pelo `POST`, aplicada
// sobre um snapshot lido de volta do repositório em vez de um
// recém-produzido. Mesma fronteira de autorização do `POST`
// (`getCompanyById()` antes de qualquer I/O de execução).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unauthorized",
          message: "Empresa não encontrada ou não autorizada.",
        },
      },
      { status: 404 }
    );
  }

  try {
    const supabaseClient = await createClient();
    const platform = new EFOSPlatform(supabaseClient);
    const result = await platform.getLatestExecutiveAnalysis(companyId);

    if (!result.success || !result.value) {
      return NextResponse.json({ ...result, documentGovernance: [] });
    }

    // Mesmo vocabulário server-autoritativo do `POST` (`documentGovernance`),
    // reconstruído por leitura pura de `documents.metadata->governance`
    // (Mission 193) para a execução identificada — nunca reclassificado,
    // nunca recalculado.
    const documentGovernanceRows = await listDocumentGovernanceByExecution(
      companyId,
      result.value.report.metadata.executionId
    );
    const documentGovernance = documentGovernanceRows.map((row) => ({
      documentId: row.documentId,
      source: row.source,
      outcome: row.outcome as DocumentGovernanceOutcome,
      reason: row.reason,
    }));

    return NextResponse.json({ ...result, documentGovernance });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unexpected",
          message:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao carregar a análise executiva já persistida.",
        },
      },
      { status: 500 }
    );
  }
}
