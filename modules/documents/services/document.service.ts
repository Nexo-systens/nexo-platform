import { createClient } from "@/lib/supabase/server";
import { ANALYZABLE_FILE_EXTENSIONS, STORAGE_BUCKET } from "@/modules/documents/constants";
import type {
  CreateDocumentInput,
  DocumentListFilters,
} from "@/modules/documents/validators/document.schemas";
import type { Database, DocumentStatus } from "@/types/database";
import type { ProcessingAttempt } from "@/app/api/efos/_shared/processingAttempt";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

type DocumentMetadataUpdate = Database["public"]["Tables"]["documents"]["Update"]["metadata"];

const SORT_COLUMN_MAP: Record<DocumentListFilters["sort"], string> = {
  nome_original: "nome_original",
  categoria: "categoria",
  created_at: "created_at",
};

// Mesma necessidade de escaping do modulo Empresas (docs em
// modules/companies/services/company.service.ts): PostgREST exige aspas
// duplas em valores de .or() que podem conter virgula/parenteses.
function escapeOrFilterValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/**
 * Camada de servico do modulo Documentos (docs/06_BACKEND.md secao 2.4).
 * Isolamento por empresa/usuario garantido pelo RLS de public.documents
 * (subquery em companies), nao por filtros manuais aqui.
 */
export async function listDocumentsByCompany(
  companyId: string,
  filters: DocumentListFilters
): Promise<DocumentRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("documents")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (filters.q) {
    const pattern = escapeOrFilterValue(`%${filters.q}%`);
    query = query.or(
      `nome_original.ilike.${pattern},categoria.ilike.${pattern}`
    );
  }

  const column = SORT_COLUMN_MAP[filters.sort];
  query = query.order(column, { ascending: filters.order === "asc" });

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function insertDocumentRecord(
  input: CreateDocumentInput
): Promise<DocumentRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .insert({
      id: input.documentId,
      company_id: input.companyId,
      nome_original: input.nomeOriginal,
      nome_armazenado: input.nomeArmazenado,
      categoria: input.categoria,
      tipo_arquivo: input.tipoArquivo,
      tamanho_bytes: input.tamanhoBytes,
      storage_path: input.storagePath,
      hash_arquivo: input.hashArquivo,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeleteDocument(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

/** URL assinada de curta duracao — o bucket e privado. */
export async function getSignedDownloadUrl(
  storagePath: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Mission 195 — Founding Company Production Onboarding & First
 * Executive Value, Seção 11. Melhor esforço para remover um objeto do
 * Storage que nunca deveria ter sido registrado como `public.documents`
 * (ex.: `createDocumentAction()` rejeitando uma extensão não permitida
 * detectada apenas no servidor — o upload em si já aconteceu direto do
 * cliente para o Storage antes desta validação rodar, D-030/Mission
 * 042). Todo chamador já envolve esta função em `.catch(() => {})`
 * (nunca bloqueia a rejeição do registro em si — a garantia real é
 * "nunca vira um `public.documents` válido", não "nunca sobra bytes no
 * bucket") — mas a função em si precisa OBSERVAR a falha real para que
 * "melhor esforço" seja uma garantia honesta, nunca um sucesso
 * fabricado (Mission 197, Seção 8, item D: "cleanup failure does not
 * falsely claim success").
 *
 * Mission 197 — `documents_storage_delete_own` (Migration 015) é a
 * primeira policy de DELETE já criada em `storage.objects` — antes
 * desta migration, toda chamada a esta função era um no-op silencioso
 * sob RLS (nenhuma exceção, porque `.remove()` nunca lançava por conta
 * própria e o `error` devolvido nunca era verificado aqui). Mesmo
 * padrão `if (error) throw error` já usado por toda outra função deste
 * arquivo.
 */
export async function removeStorageObject(storagePath: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
  if (error) throw error;
}

/**
 * Documentos ja armazenados de uma empresa que o EFOS consegue
 * processar hoje (Mission 082 — NEXO Document-to-Analysis Flow;
 * matriz de formatos ampliada na Mission 083 — EFOS Multi-Format
 * Financial Document Intake): PDF (`DefaultPdfParser`, Mission 045) e
 * CSV (`DefaultCsvParser`, Mission 083) — os dois unicos formatos com
 * parser real hoje (ver `efos/platform/parsers/README.md`). XLSX/XLS/
 * DOC/DOCX/PNG/JPG/JPEG continuam aceitos pelo Upload da Plataforma
 * mas sao deliberadamente excluidos aqui — "upload aceito" nunca deve
 * significar "analise financeira suportada" (Mission 083, Auditoria
 * 9). Nao excluidos (`deleted_at is null`). Nenhuma paginacao — a
 * analise precisa da colecao completa, nao de uma pagina de listagem.
 * Isolamento por empresa/usuario garantido pelo mesmo RLS de
 * `public.documents` (subquery em `companies`) usado por
 * `listDocumentsByCompany`.
 */
export async function listAnalyzableDocumentsByCompany(
  companyId: string
): Promise<DocumentRow[]> {
  const supabase = await createClient();

  // Mission 195 Closure — Trusted Upload Boundary & Activation
  // Integrity, Seção 28/29. Filtro construído a partir de
  // `ANALYZABLE_FILE_EXTENSIONS` (única fonte de verdade, compartilhada
  // com `isAnalyzableDocumentName()`/`parseSupportedFile()`) — nunca
  // mais uma string SQL hardcoded própria que pudesse divergir das
  // outras duas em uma futura mudança de formato suportado.
  const analyzableFilter = ANALYZABLE_FILE_EXTENSIONS.map(
    (extension) => `nome_original.ilike.%.${extension}`
  ).join(",");

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .or(analyzableFilter)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Baixa o conteudo binario de um documento ja armazenado no Storage
 * (Mission 082). Mesmo bucket privado/RLS ja usado por
 * `getSignedDownloadUrl` — nenhum acesso privilegiado, apenas o client
 * de sessao ja escopado pelo usuario autenticado.
 */
export async function downloadDocumentFile(storagePath: string): Promise<Blob> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);

  if (error) throw error;
  return data;
}

/**
 * Metadados mínimos de documentos já armazenados, resolvidos pelo
 * `id` real (`documents.id`) — nunca pelo nome do arquivo (Mission 109
 * — Source Traceability Experience, Etapa 11: "documentId real →
 * documents → storage_path → download URL existente", explicitamente
 * nunca "source filename → buscar por nome"). Mesmo RLS de
 * `public.documents` (subquery em `companies`) de todo o módulo —
 * `ids` de outra empresa simplesmente não retornam, sem checagem
 * manual adicional. `ids` vazio devolve `[]` sem consultar o banco.
 */
export async function getDocumentsByIds(
  ids: readonly string[]
): Promise<Pick<DocumentRow, "id" | "nome_original" | "storage_path">[]> {
  if (ids.length === 0) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, nome_original, storage_path")
    .in("id", ids)
    .is("deleted_at", null);

  if (error) throw error;
  return data ?? [];
}

/**
 * Mission 193 Closure B — Database-Authoritative Processing Attempt
 * Ordering. Única chamada de rede da RPC `acquire_processing_attempt_revision()`
 * (`supabase/migrations/20260918120000_document_processing_authority.sql`)
 * — devolve o próximo valor de uma sequence do Postgres, atômico e
 * estritamente crescente sob qualquer concorrência por definição do
 * próprio banco. Chamada uma única vez por requisição, dentro de
 * `beginProcessingAttempt()` (`processingAttempt.ts`), antes de
 * qualquer outro I/O — é essa ordem de OBTENÇÃO, nunca a ordem em que
 * a posse é fisicamente escrita depois, que define "mais nova" entre
 * duas tentativas concorrentes.
 */
export async function acquireProcessingAttemptRevision(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("acquire_processing_attempt_revision");
  if (error) throw error;
  return data;
}

/**
 * Mission 193 — Production Intake Governance & Permanent Regression
 * Gate, Seção 12 (Mission 193 Closure B, Seção 8: finalização
 * atômica). Atualiza o status TÉCNICO de processamento
 * (`uploaded → processing → processed|failed`) — nunca confundido com
 * o desfecho de GOVERNANÇA financeira: este campo reflete exclusivamente
 * se o pipeline conseguiu TECNICAMENTE ler/classificar o arquivo, nunca
 * se seu conteúdo foi aceito como verdade financeira. `ids` vazio é um
 * no-op deliberado.
 *
 * `UPDATE` condicionado, em UMA ÚNICA instrução, a
 * `processing_revision = attempt.revision` — só aplica às linhas cuja
 * revisão ativa ainda seja EXATAMENTE esta tentativa (comparação
 * numérica atômica no próprio filtro do PostgREST, nunca
 * ler-decidir-escrever em passos separados). Se uma tentativa mais
 * nova (revisão maior, obtida por `acquire_processing_attempt_revision()`)
 * já assumiu o documento nesse meio-tempo, esta escrita afeta
 * silenciosamente 0 linhas, nunca sobrescrevendo um resultado mais
 * novo. Devolve os ids efetivamente atualizados (Seção 27: "applied |
 * stale" observável, nunca um erro fatal por perda de posse).
 */
export async function updateDocumentsStatus(
  ids: readonly string[],
  status: DocumentStatus,
  attempt: ProcessingAttempt
): Promise<readonly string[]> {
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ status })
    .in("id", ids)
    .eq("processing_revision", attempt.revision)
    .select("id");

  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

/**
 * Mission 193 Closure, Seção 13/14 (Mission 193 Closure B, Seção 7:
 * aquisição atômica). Declara uma NOVA tentativa de processamento
 * ativa para cada documento — em UMA ÚNICA instrução `UPDATE`,
 * condicionada a `processing_revision < attempt.revision` (nunca
 * ler-decidir-escrever): como `attempt.revision` foi obtida ANTES de
 * qualquer I/O (`beginProcessingAttempt()`), uma tentativa criada antes
 * de outra nunca pode ter uma revisão maior, não importa quando sua
 * escrita física a este método aconteça depois — a própria condição do
 * `UPDATE` rejeita a escrita atrasada (Seção 1 da missão de
 * fechamento). Avaliada POR LINHA: um lote com documentos parcialmente
 * sobrepostos entre duas tentativas (Seção 21/22 — ex.: E1=[A,B],
 * E2=[B]) é resolvido corretamente em uma única chamada — cada
 * documento só é reclamado se sua PRÓPRIA revisão atual for menor que
 * a desta tentativa, nunca um resultado tudo-ou-nada sobre o lote
 * inteiro.
 *
 * `metadata` nunca precisa mais ser lido/mesclado (Mission 193 Closure
 * B: posse deixou de viver em `metadata.activeAttempt` e passou para
 * colunas estruturadas — `processing_revision`/`active_attempt_id`/
 * `active_attempt_started_at`, Migration 013) — `metadata` continua
 * existindo apenas para `governance` (`updateDocumentGovernance`
 * abaixo), nunca tocado por esta função.
 */
export async function beginDocumentsProcessingAttempt(
  ids: readonly string[],
  attempt: ProcessingAttempt
): Promise<readonly string[]> {
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .update({
      status: "processing",
      processing_revision: attempt.revision,
      active_attempt_id: attempt.attemptId,
      active_attempt_started_at: attempt.startedAt,
    })
    .in("id", ids)
    .lt("processing_revision", attempt.revision)
    .select("id");

  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

/**
 * Desfecho de governança financeira de UMA execução específica —
 * nunca uma verdade contínua/eterna do documento (Seção 10/11 da
 * Mission 193: "do NOT incorrectly persist an execution-relative truth
 * as an eternal property of the Document"). `executionId`/`evaluatedAt`
 * permanecem informativos (observabilidade); a ORDEM ("mais recente
 * vence") é decidida inteiramente por `documents.governance_revision`
 * (coluna estruturada, Migration 013 — Mission 193 Closure B), nunca
 * mais por um campo dentro deste snapshot (o `attemptStartedAt` da
 * Mission 193 Closure foi removido daqui — relógio de aplicação nunca
 * é autoridade canônica, Seção 3 da missão de fechamento).
 */
export interface DocumentGovernanceSnapshot {
  readonly executionId: string;
  readonly outcome: string;
  readonly reason: string;
  readonly evaluatedAt: string;
}

/**
 * Mission 193, Seção 9 (Mission 193 Closure B, Seção 10/11: CAS
 * inteiramente em UMA instrução, nunca mais ler-decidir-escrever).
 * Grava o desfecho de governança apenas quando `attempt.revision` supera
 * `governance_revision` já persistido (ou nenhum ainda existe) — a
 * própria condição do `UPDATE` (`.or()`, avaliada pelo Postgres, nunca
 * em TypeScript) decide isso; se outra escrita concorrente já avançou
 * `governance_revision` para um valor maior ou igual, este `UPDATE`
 * afeta 0 linhas (falha silenciosa e segura, nunca uma sobrescrita,
 * nunca uma segunda tentativa/retry — Seção 26 da missão de fechamento:
 * nenhuma trava distribuída). Devolve `true`/`false` (Seção 27:
 * "applied | stale" observável).
 *
 * `metadata` é substituído por inteiro (`{governance}`) — seguro desde
 * a Mission 193 Closure B, já que `activeAttempt` deixou de viver em
 * `metadata` (agora em colunas estruturadas); nenhuma outra chave é
 * armazenada em `documents.metadata` hoje.
 */
export async function updateDocumentGovernance(
  documentId: string,
  governance: DocumentGovernanceSnapshot,
  attempt: ProcessingAttempt
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .update({
      metadata: { governance } as unknown as DocumentMetadataUpdate,
      governance_revision: attempt.revision,
    })
    .eq("id", documentId)
    .or(`governance_revision.is.null,governance_revision.lt.${attempt.revision}`)
    .select("id");

  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Contagem simples de documentos ativos de uma empresa (Mission 082)
 * — usada pela Experiencia (`modules/analysis`) para distinguir o
 * estado "nenhum documento enviado" do estado "analise concluida sem
 * dados". Mesmo padrao de `count`/`head: true` ja usado por
 * `getCompanyCounts` (`modules/companies/services/company.service.ts`).
 */
export async function countDocumentsByCompany(companyId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (error) throw error;
  return count ?? 0;
}
