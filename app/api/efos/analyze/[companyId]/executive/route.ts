import { NextResponse } from "next/server";

import type { RawFinancialDocument } from "@/efos/engines/data";
import type { StatementConflict } from "@/efos/domain";
import { createClient } from "@/lib/supabase/server";
import { EFOSPlatform } from "@/efos/platform";
import type { DocumentRow } from "@/modules/documents/services/document.service";
import {
  downloadDocumentFile,
  listAnalyzableDocumentsByCompany,
} from "@/modules/documents/services/document.service";

import {
  applyDocumentGovernanceOutcomes,
  applyDocumentTechnicalStatus,
  beginDocumentProcessing,
  beginProcessingAttempt,
  markDocumentsFailed,
} from "../../../_shared/applyDocumentGovernance";
import type { ExcludedDocument } from "../../../_shared/resolveStatementConflicts";
import { prepareFinancialDocuments } from "../../../_shared/prepareFinancialDocuments";

// Mission 175 — Production Executive Analysis API. Espelha
// `../route.ts` (POST /api/efos/analyze/[companyId], Mission 041/081/
// 082) byte a byte no carregamento de documentos e no tratamento de
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
