import { NextResponse } from "next/server";

import type { ApplicationResult } from "@/efos/application/contracts";
import type { ExecutiveReport } from "@/efos/application/report";
import type { StatementConflict } from "@/efos/domain";
import { EFOSPlatform } from "@/efos/platform";
import { createClient } from "@/lib/supabase/server";

import type { ExcludedDocument } from "../_shared/prepareFinancialDocuments";
import { prepareFinancialDocuments } from "../_shared/prepareFinancialDocuments";

/**
 * Mission 192 — Canonical Financial Statement Ingestion & Period
 * Semantics: `excludedDocuments` é aditivo — sempre presente (`[]`
 * quando nenhum documento foi excluído), nunca altera o formato de
 * `ApplicationResult<ExecutiveReport>` em si. `statementConflicts`
 * (Mission 192 Closure B, D-113) é o mesmo princípio — sempre presente
 * (`[]` quando nenhum conflito material foi detectado no lote).
 */
type UploadResponseBody = ApplicationResult<ExecutiveReport> & {
  readonly excludedDocuments?: readonly ExcludedDocument[];
  readonly statementConflicts?: readonly StatementConflict[];
};

// Mission 082 — NEXO Document-to-Analysis Flow: a sequência de
// preparação de documentos (Parser → Classifier → Normalizer →
// Resolver → Consolidator → KnowledgeBuilder → Validator →
// ContextBuilder → DocumentIntake) foi extraída para
// `../_shared/prepareFinancialDocuments.ts` — reutilizada também por
// `POST /api/efos/analyze/[companyId]`, que agora lê documentos já
// armazenados via `modules/documents` em vez de receber `File[]`
// diretamente. Nenhuma etapa foi alterada, apenas movida para um
// único ponto para nunca haver dois pipelines.
//
// Conecta definitivamente o Upload API ao EFOS Platform (Mission 043
// — Complete Financial Analysis Flow; documentos passam a chegar de
// fato ao Data Engine desde a Mission 044 — End-to-End Document Flow,
// que fechou D-031 ampliando EFOSPlatform.analyzeCompany()/
// EFOSFacade.analyzeCompany() para aceitar `documents`; `lines`
// deixou de ser sempre `[]` desde a Mission 045 — PDF Text
// Extraction, que introduziu `DefaultPdfParser`; cada linha ganha
// metadados detectáveis desde a Mission 046 — Financial Line
// Classification, que introduziu `DefaultFinancialLineClassifier`;
// cada linha classificada é limpa/padronizada desde a Mission 047 —
// Financial Line Normalization, que introduziu
// `DefaultFinancialLineNormalizer`; cada linha normalizada é
// consolidada em um evento financeiro desde a Mission 048 —
// Financial Event Resolution, que introduziu
// `DefaultFinancialEventResolver`; múltiplos documentos são
// consolidados estruturalmente desde a Mission 049 — Financial
// Document Consolidation, que introduziu
// `DefaultFinancialDocumentConsolidator`; a coleção final é
// certificada como conhecimento financeiro estruturado desde a
// Mission 050 — Financial Knowledge Builder, que introduziu
// `DefaultFinancialKnowledgeBuilder`, uma camada que nunca executa o
// Pipeline; a coleção certificada e validada (sem nenhuma alteracao)
// desde a Mission 051 — Financial Record Validation, que introduziu
// `DefaultFinancialRecordValidator`, uma camada que executa
// validacoes deterministicas mas sempre devolve a mesma colecao
// recebida; o contexto financeiro entre documentos e consolidado
// desde a Mission 052 — Financial Context Builder, que introduziu
// `DefaultFinancialContextBuilder`, uma camada que tambem nunca
// executa o Pipeline: confirma relacoes ja existentes (companyId,
// currency) e organiza a colecao de documentos por campos ja
// existentes, sem criar ou alterar documento/linha/valor algum).
// Fluxo: multipart/form-data (companyId + files[]) ->
// DefaultPdfParser -> RawFinancialDocument[] ->
// DefaultFinancialLineClassifier -> DefaultFinancialLineNormalizer ->
// DefaultFinancialEventResolver -> DefaultFinancialDocumentConsolidator
// -> DefaultFinancialKnowledgeBuilder -> DefaultFinancialRecordValidator
// -> DefaultFinancialContextBuilder -> DocumentIntake -> EFOSPlatform ->
// EFOSFacade -> AnalysisService -> PipelineContext.metadata.documents ->
// EFOSPipelineRuntime -> Data Engine -> ExecutionRepository
// (persistencia automatica, D-028) -> ExecutiveReport ->
// ApplicationResult devolvido exatamente como produzido. Nunca chama
// Runtime/Facade/Bootstrap diretamente — somente EFOSPlatform
// (Mission 040), que ja encapsula toda essa cadeia.
//
// `documentIntake.prepareDocuments()` continua sendo aplicado aos
// documentos ja classificados, normalizados, resolvidos, consolidados,
// certificados, validados e contextualizados (remove nulos/duplicatas
// por documentId, preserva ordem) — mesmo passo oficial ja usado em
// qualquer fluxo de preparacao de documentos (Mission 026, D-022); o
// resultado preparado e o que e repassado a EFOSPlatform.
//
// Somente PDF nesta missao — nenhum OCR/imagem/Excel/Word/CSV.
export async function POST(
  request: Request
): Promise<NextResponse<UploadResponseBody>> {
  const formData = await request.formData();
  const companyId = formData.get("companyId");

  if (typeof companyId !== "string" || companyId.length === 0) {
    return NextResponse.json({
      success: false,
      error: {
        code: "invalid_input",
        message: "companyId é obrigatório.",
      },
    });
  }

  const files = formData
    .getAll("files[]")
    .filter((entry): entry is File => entry instanceof File);

  try {
    // Arquivos efêmeros desta rota nunca foram persistidos em
    // `public.documents` — não existe id canônico para propagar aqui
    // (Mission 108 — Canonical Document Identity); `documentId` fica
    // ausente, e o Parser continua gerando um id próprio, exatamente
    // como antes.
    const filesToAnalyze = files.map((file) => ({ file }));
    const { documents: preparedDocuments, excluded, conflicts } =
      await prepareFinancialDocuments(filesToAnalyze, companyId);

    const supabaseClient = await createClient();
    const platform = new EFOSPlatform(supabaseClient);
    const result = await platform.analyzeCompany(companyId, preparedDocuments, conflicts);

    // Mission 192 — Canonical Financial Statement Ingestion & Period
    // Semantics, Seção 23: documentos excluídos (ex.: DRE cujo período
    // não pôde ser determinado) são reportados explicitamente ao lado
    // do resultado — nunca silenciosamente descartados, nunca
    // silenciosamente aceitos. Campo aditivo — `ApplicationResult` em
    // si permanece byte a byte igual ao de antes desta missão.
    // `statementConflicts` (Mission 192 Closure B, D-113) é o mesmo
    // princípio para conflitos materiais entre documentos do mesmo
    // período/data-base.
    return NextResponse.json({ ...result, excludedDocuments: excluded, statementConflicts: conflicts });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unexpected",
          message:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao processar os documentos.",
        },
      },
      { status: 500 }
    );
  }
}
