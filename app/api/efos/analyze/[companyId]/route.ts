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
} from "../../_shared/applyDocumentGovernance";
import type { ExcludedDocument } from "../../_shared/resolveStatementConflicts";
import { prepareFinancialDocuments } from "../../_shared/prepareFinancialDocuments";

// Primeiro endpoint oficial que usa EFOSPlatform (Mission 041 — HTTP
// Platform Integration). Recebe companyId, obtem um SupabaseClient
// pelo padrao ja existente do projeto (lib/supabase/server.ts),
// instancia EFOSPlatform e devolve exatamente o ApplicationResult
// produzido por analyzeCompany() — sem reinterpretar sucesso/erro em
// outro formato.
//
// Mission 082 — NEXO Document-to-Analysis Flow: ate esta missao, o
// fluxo sempre usava `documents = []` (nenhum documento real chegava
// ao Data Engine a partir desta rota). Agora le os documentos ja
// armazenados da empresa via `modules/documents`
// (`listAnalyzableDocumentsByCompany`, mesmo RLS de sempre — nenhuma
// checagem de autorizacao nova), baixa cada um do Storage
// (`downloadDocumentFile`) e os prepara pela mesma sequencia oficial
// ja usada por `POST /api/efos/upload`
// (`../_shared/prepareFinancialDocuments.ts`) — nunca um segundo
// pipeline. Nenhum documento e persistido novamente: apenas lido do
// que `modules/documents` ja armazenou.
//
// Mission 083 — EFOS Multi-Format Financial Document Intake:
// `listAnalyzableDocumentsByCompany()` so devolve formatos com parser
// real (PDF e, desde esta missao, CSV) — nenhum outro formato aceito
// pelo Upload da Plataforma (XLSX/XLS/DOC/DOCX/PNG/JPG/JPEG) e incluido
// aqui, mesmo que ja esteja armazenado; "upload aceito" nunca significa
// "analise financeira suportada" (ver efos/platform/parsers/README.md).
//
// Mission 081 — NEXO Executive Analysis Consumption: `analyzeCompany()`
// pode rejeitar (ex.: RLS de public.executions recusando o insert
// quando companyId nao pertence ao usuario autenticado — Caso 6 dos
// testes funcionais da missao) sem que isso seja um `ApplicationResult`
// de erro, ja que `DefaultEFOSFacade`/`ExecutionRepository` nunca
// capturam essa excecao (D-028/D-038, propagacao deliberada). Sem este
// try/catch, essa rejeicao virava um erro 500 nao tratado do Next.js,
// sem corpo JSON parseavel pelo primeiro consumidor real (Mission 081).
// Nenhuma logica de autorizacao nova foi criada aqui — apenas a mesma
// garantia de RLS ja existente (D-043) traduzida para uma resposta
// `ApplicationResult` limpa no limite HTTP.
//
// Mission 193 Closure — Technical Status Ownership & Concurrent
// Governance Safety: mesma estrutura de duas fases de
// `.../executive/route.ts` (ver esse arquivo para o racional completo)
// — preparação (download isolado por documento + status técnico
// finalizado) sempre em bloco try/catch SEPARADO da análise financeira,
// nunca a mesma falha categoricamente diferente reescrevendo o status
// técnico já correto.
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

    const downloadOutcomes = await Promise.allSettled(
      storedDocuments.map(async (document) => {
        const blob = await downloadDocumentFile(document.storage_path);
        const file = new File([blob], document.nome_original, {
          type: document.tipo_arquivo,
        });
        // `document.id` (Mission 108 — Canonical Document Identity):
        // id real e persistido de `public.documents`, propagado como a
        // identidade canônica do documento por toda a análise — nunca
        // descartado em favor de um `randomUUID()` efêmero.
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
    const result = await platform.analyzeCompany(companyId, preparedDocuments, conflicts);

    // Este endpoint (sem consumidor de produção real hoje —
    // `ExecutiveAnalysisPanel.tsx` usa `.../executive`, Mission 175)
    // nunca teve `statementArithmeticIssues` plumbed (ApplicationResult
    // <ExecutiveReport> não carrega o Financial Model) — governança
    // aqui nunca produz `needs_review`, apenas `accepted`/exclusões.
    // Mantido consistente propositalmente com o endpoint dedicado, nunca
    // uma segunda lógica de governança divergente.
    const documentGovernance = result.success
      ? await applyDocumentGovernanceOutcomes({
          preparedDocuments,
          excluded,
          statementArithmeticIssues: [],
          executionId: result.value.metadata.executionId,
          attempt,
        })
      : [];

    // Mission 192, Seção 23 / Mission 192 Closure B, D-113: ver
    // app/api/efos/upload/route.ts.
    return NextResponse.json({
      ...result,
      excludedDocuments: excluded,
      statementConflicts: conflicts,
      documentGovernance,
    });
  } catch (error) {
    // Mission 193 Closure, Seção 6/18: nunca toca documents.status —
    // já finalizado corretamente na fase de preparação (acima).
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unexpected",
          message:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao executar a análise.",
        },
      },
      { status: 500 }
    );
  }
}
