import { DefaultDocumentIntake } from "@/efos/application/intake";
import type { StatementConflict } from "@/efos/domain";
import type { RawFinancialDocument } from "@/efos/engines/data";
import { DefaultFinancialKnowledgeBuilder } from "@/efos/platform/builders";
import {
  annotateResourceLinesWithAsOfDate,
  DefaultFinancialLineClassifier,
  DefaultFinancialStatementClassifier,
} from "@/efos/platform/classifiers";
import { DefaultFinancialDocumentConsolidator } from "@/efos/platform/consolidators";
import { DefaultFinancialContextBuilder } from "@/efos/platform/context";
import { DefaultFinancialLineNormalizer } from "@/efos/platform/normalizers";
import { DefaultCsvParser, DefaultPdfParser } from "@/efos/platform/parsers";
import { DefaultFinancialEventResolver } from "@/efos/platform/resolvers";
import { DefaultFinancialRecordValidator } from "@/efos/platform/validators";
import { ANALYZABLE_FILE_EXTENSIONS, type AnalyzableFileExtension } from "@/modules/documents/constants";
import { getFileExtension } from "@/modules/documents/utils/file";

import type { ExcludedDocument } from "./resolveStatementConflicts";
import { resolveStatementConflicts } from "./resolveStatementConflicts";

export type { ExcludedDocument, ExcludedDocumentReasonCode } from "./resolveStatementConflicts";

/**
 * Arquivo a ser analisado, com a identidade canônica do documento já
 * persistido (`public.documents.id`) quando ela existe (Mission 108 —
 * Canonical Document Identity). `documentId` é opcional: `POST
 * /api/efos/upload` analisa arquivos efêmeros, nunca armazenados —
 * não há identidade canônica para passar adiante nesse caso, e o
 * Parser (`DefaultPdfParser`/`DefaultCsvParser`) continua gerando um
 * id próprio quando `documentId` está ausente.
 */
export interface FileToAnalyze {
  readonly file: File;
  readonly documentId?: string;
}

/**
 * `ExcludedDocument`/`ExcludedDocumentReasonCode` — documento
 * estruturalmente reconhecido mas EXCLUÍDO do lote enviado ao
 * Financial Model Engine (Mission 192 — Canonical Financial Statement
 * Ingestion & Period Semantics, Seção 23/38: "one invalid document
 * excluded, valid documents continue" — nunca silenciosamente
 * descartado, nunca silenciosamente aceito com um período fabricado).
 * Definidos em `./resolveStatementConflicts.ts` desde a Mission 192
 * Closure B — Deterministic Statement Conflict Governance, que fechou
 * o vocabulário de motivo (`code`) depois que um segundo e terceiro
 * motivo real passaram a existir (duplicata econômica, conflito
 * material) — reexportados aqui por compatibilidade, nenhuma mudança
 * de forma para quem já importava `ExcludedDocument` deste módulo.
 */
export interface PreparedFinancialDocuments {
  readonly documents: readonly RawFinancialDocument[];
  readonly excluded: readonly ExcludedDocument[];
  /**
   * Conflitos de identidade temporal detectados no lote (Mission 192
   * Closure B, D-113) — sempre `[]` quando nenhum documento do mesmo
   * período/data-base diverge materialmente de outro no mesmo lote.
   * Repassado adiante até `FinancialModelAggregate.statementConflicts`
   * (via `EFOSPlatform.analyzeCompany(companyId, documents, conflicts)`)
   * para que o Indicators Engine distinga "nenhum demonstrativo
   * jamais existiu" de "existiu, mas ficou sem resolução".
   */
  readonly conflicts: readonly StatementConflict[];
}

/**
 * Mission 195 Closure — Trusted Upload Boundary & Activation Integrity,
 * Seção 28/29. Um único mapa de dispatch por extensão, chaveado por
 * `ANALYZABLE_FILE_EXTENSIONS` (`modules/documents/constants.ts`) — a
 * MESMA lista fechada que `isAnalyzableDocumentName()` (UI) e
 * `listAnalyzableDocumentsByCompany()` (filtro SQL) já usam. Antes
 * desta missão, este dispatch reimplementava `getFileExtension()`
 * localmente e comparava `"pdf"`/`"csv"` como literais próprios — uma
 * quarta lista independente da mesma verdade, sujeita a divergir das
 * outras três numa futura mudança de formato suportado.
 */
const PARSERS_BY_EXTENSION: Record<
  AnalyzableFileExtension,
  { parse(file: File, companyId: string, documentId?: string): Promise<RawFinancialDocument> }
> = {
  pdf: new DefaultPdfParser(),
  csv: new DefaultCsvParser(),
};

function isAnalyzableExtension(extension: string): extension is AnalyzableFileExtension {
  return (ANALYZABLE_FILE_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Seleciona o parser correto por extensão de arquivo (Mission 083 —
 * EFOS Multi-Format Financial Document Intake). Um formato sem parser
 * real (XLSX/XLS/DOC/DOCX/PNG/JPG/JPEG — nenhuma capacidade técnica
 * hoje, ver `efos/platform/parsers/README.md`) devolve `undefined` —
 * nunca lança, nunca inventa `RawFinancialDocument` para um formato
 * que o EFOS não sabe processar; o arquivo é simplesmente ignorado
 * pela análise (upload aceito ≠ processamento suportado).
 *
 * Mission 193 Closure — Technical Status Ownership & Concurrent
 * Governance Safety, Seção 5: um PDF genuinamente corrompido faz
 * `DefaultPdfParser.parse()` (via `pdf-parse`) LANÇAR — confirmado por
 * leitura direta, nenhum try/catch interno ali. Sem a contenção abaixo,
 * essa exceção abortaria o `Promise.all()` de `prepareClassifiedDocuments()`
 * (mais abaixo neste módulo) INTEIRO, derrubando a preparação de TODOS
 * os documentos do lote por causa de UM arquivo tecnicamente ilegível —
 * exatamente o "failure ownership broader than the document-processing
 * boundary" que esta missão de fechamento corrige (Seção 1/5). Uma
 * falha de parsing é tratada de forma IDÊNTICA a um formato não
 * suportado para fins de continuidade do lote — `undefined`, nunca
 * propagado — porque o efeito é o mesmo (este documento específico não
 * produz `RawFinancialDocument` algum); `applyDocumentTechnicalStatus()`
 * (`applyDocumentGovernance.ts`) já infere `failed` para todo
 * `documentId` que nunca aparece nem entre os aceitos nem entre os
 * excluídos — nenhuma mudança adicional necessária ali.
 */
async function parseSupportedFile(
  { file, documentId }: FileToAnalyze,
  companyId: string
): Promise<RawFinancialDocument | undefined> {
  const extension = getFileExtension(file.name);

  if (!isAnalyzableExtension(extension)) {
    return undefined;
  }

  try {
    return await PARSERS_BY_EXTENSION[extension].parse(file, companyId, documentId);
  } catch {
    return undefined;
  }
}

/**
 * Dispatch entre os dois classificadores (Mission 192, Seção 13/14/16):
 * um documento é interpretado como demonstrativo agregado por período
 * (DRE) OU como transacional/extrato — NUNCA os dois, nunca ambos os
 * classificadores sobre o mesmo documento. A decisão é por CONTEÚDO
 * (`DefaultFinancialStatementClassifier.looksLikeFinancialStatement()`),
 * nunca pela `categoria` cosmética escolhida no upload (Mission 191,
 * achado confirmado — `categoria` nunca chega a este módulo, e
 * permanece assim deliberadamente: um arquivo marcado "DRE" cujo
 * conteúdo não é reconhecível como DRE nunca entra no caminho de
 * demonstrativo só por causa do rótulo).
 *
 * Quando reconhecido como demonstrativo mas o período não pôde ser
 * determinado com segurança (Seção 10/38), o documento é EXCLUÍDO do
 * lote — nunca classificado com um período fabricado, nunca deixado
 * para envenenar a validação atômica do Financial Model Engine com
 * linhas sem `statementCategory`/`period` (a causa raiz do achado
 * central da Mission 191: uma DRE malformada nunca mais pode derrubar
 * um Balancete válido processado no mesmo lote).
 */
function classifyDocument(
  document: RawFinancialDocument,
  statementClassifier: DefaultFinancialStatementClassifier,
  lineClassifier: DefaultFinancialLineClassifier
): { document: RawFinancialDocument } | { excluded: ExcludedDocument } {
  if (statementClassifier.looksLikeFinancialStatement(document)) {
    const summary = statementClassifier.summarize(document);

    if (!summary.periodResolved) {
      return {
        excluded: {
          documentId: document.documentId,
          source: document.source,
          code: "invalid_document",
          reason:
            "Documento reconhecido como demonstrativo financeiro (DRE), mas o período do demonstrativo não pôde ser determinado a partir do conteúdo — requer confirmação humana do período antes de poder ser incluído na análise.",
        },
      };
    }

    return { document: statementClassifier.classify(document) };
  }

  // Mission 192 Closure — Complete Statement Economics & Balance-Date
  // Semantics, D-111: anota `asOfDate` em linhas de recurso quando o
  // documento é um Balancete/Balanço com data-base reconhecível — é um
  // no-op para qualquer outro documento transacional (extrato, etc.).
  return { document: annotateResourceLinesWithAsOfDate(lineClassifier.classify(document)) };
}

/**
 * Mission 193 — Production Intake Governance & Permanent Regression
 * Gate. Extraída de `prepareFinancialDocuments()` — a MESMA sequência
 * (classificação → D-113 → Normalizer → Resolver → Consolidator →
 * KnowledgeBuilder → Validator → ContextBuilder → DocumentIntake),
 * porém a partir de `RawFinancialDocument[]` JÁ EXTRAÍDOS (texto de
 * linha já disponível), nunca de `File`/bytes. Isso torna a sequência
 * inteira testável sem depender de um PDF/CSV real — a suíte de
 * regressão permanente de ingestão (`tests/financial-ingestion/`)
 * chama exatamente esta função, nunca uma reimplementação paralela do
 * dispatch de classificadores (Seção 30/42 da missão: "no second
 * ingestion pipeline, no second conflict taxonomy"). `prepareFinancialDocuments()`
 * permanece a única responsável por decidir QUAL parser usar por
 * formato de arquivo — esta função nunca soube disso, nem antes desta
 * extração.
 */
export async function prepareClassifiedDocuments(
  documents: readonly RawFinancialDocument[]
): Promise<PreparedFinancialDocuments> {
  const statementClassifier = new DefaultFinancialStatementClassifier();
  const lineClassifier = new DefaultFinancialLineClassifier();

  const excluded: ExcludedDocument[] = [];
  const classifiedDocuments: RawFinancialDocument[] = [];

  for (const document of documents) {
    const result = classifyDocument(document, statementClassifier, lineClassifier);

    if ("excluded" in result) {
      excluded.push(result.excluded);
      continue;
    }

    classifiedDocuments.push(result.document);
  }

  // Mission 192 Closure B — Deterministic Statement Conflict
  // Governance, D-113 (corrigindo D-112): resolve identidade temporal
  // ENTRE documentos já classificados (períodos de DRE diferentes,
  // datas-base de Balancete diferentes, duplicatas econômicas,
  // conflitos materiais do MESMO período/data) antes de prosseguir —
  // nunca depois do Financial Model já formado.
  const temporalResolution = resolveStatementConflicts(classifiedDocuments);
  excluded.push(...temporalResolution.excluded);

  const normalizer = new DefaultFinancialLineNormalizer();
  const normalizedDocuments = temporalResolution.kept.map((document) =>
    normalizer.normalize(document)
  );

  const resolver = new DefaultFinancialEventResolver();
  const resolvedDocuments = normalizedDocuments.map((document) =>
    resolver.resolve(document)
  );

  const consolidator = new DefaultFinancialDocumentConsolidator();
  const consolidatedDocuments = consolidator.consolidate(resolvedDocuments);

  const knowledgeBuilder = new DefaultFinancialKnowledgeBuilder();
  const knowledgeDocuments: readonly RawFinancialDocument[] =
    knowledgeBuilder.build(consolidatedDocuments);

  const validator = new DefaultFinancialRecordValidator();
  const validatedDocuments = validator.validate(knowledgeDocuments);

  const contextBuilder = new DefaultFinancialContextBuilder();
  const contextualizedDocuments = contextBuilder.build(validatedDocuments);

  const documentIntake = new DefaultDocumentIntake();
  const preparedDocuments = documentIntake.prepareDocuments(contextualizedDocuments);

  return { documents: preparedDocuments, excluded, conflicts: temporalResolution.conflicts };
}

/**
 * Sequência oficial de preparação de documentos financeiros brutos —
 * `FileToAnalyze[]` (`File` + `documentId` canônico opcional, Mission
 * 108) → `PreparedFinancialDocuments` prontos para
 * `EFOSPlatform.analyzeCompany()` (Missions 042–052, estendida na
 * Mission 192 — Canonical Financial Statement Ingestion & Period
 * Semantics: Parser → [Statement|Line]Classifier (dispatch por
 * conteúdo, Seção 13/16) → Normalizer → Resolver → Consolidator →
 * KnowledgeBuilder → Validator → ContextBuilder → DocumentIntake).
 *
 * Extraída de `app/api/efos/upload/route.ts` (Mission 082 — NEXO
 * Document-to-Analysis Flow) para que `POST /api/efos/upload` e
 * `POST /api/efos/analyze/[companyId]` reutilizem exatamente a mesma
 * sequência — nunca um segundo pipeline/parser/classifier/normalizer.
 * Desde a Mission 083, orquestra também a seleção do parser por
 * formato (`parseSupportedFile()`) — apenas dispatch, a extração real
 * de cada formato continua isolada em seu próprio parser
 * (`efos/platform/parsers/`), nunca duplicada aqui. Desde a Mission
 * 193, apenas um wrapper fino sobre `prepareClassifiedDocuments()` —
 * resolve `File[]` para `RawFinancialDocument[]` e repassa adiante,
 * nunca uma segunda cópia da sequência de classificação/conflito.
 */
export async function prepareFinancialDocuments(
  files: readonly FileToAnalyze[],
  companyId: string
): Promise<PreparedFinancialDocuments> {
  const parsedDocuments = (
    await Promise.all(
      files.map((fileToAnalyze) => parseSupportedFile(fileToAnalyze, companyId))
    )
  ).filter((document): document is RawFinancialDocument => document !== undefined);

  return prepareClassifiedDocuments(parsedDocuments);
}
