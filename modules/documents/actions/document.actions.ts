"use server";

import { revalidatePath } from "next/cache";

import {
  downloadDocumentFile,
  getDocumentsByIds,
  getSignedDownloadUrl,
  insertDocumentRecord,
  removeStorageObject,
  softDeleteDocument,
} from "@/modules/documents/services/document.service";
import type { DocumentActionState } from "@/modules/documents/types";
import { createDocumentSchema } from "@/modules/documents/validators/document.schemas";
import { isAllowedFileExtension } from "@/modules/documents/utils/file";
import { validateDocumentContent } from "@/modules/documents/utils/content-validation";

export async function createDocumentAction(
  companyId: string,
  _prevState: DocumentActionState,
  formData: FormData
): Promise<DocumentActionState> {
  const parsed = createDocumentSchema.safeParse({
    companyId,
    documentId: formData.get("documentId"),
    categoria: formData.get("categoria"),
    nomeOriginal: formData.get("nomeOriginal"),
    nomeArmazenado: formData.get("nomeArmazenado"),
    tipoArquivo: formData.get("tipoArquivo"),
    tamanhoBytes: Number(formData.get("tamanhoBytes")),
    storagePath: formData.get("storagePath"),
    hashArquivo: formData.get("hashArquivo"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Mission 195 — Founding Company Production Onboarding & First
  // Executive Value, Seção 11 (achado da Mission 193 reauditado):
  // `UploadDocumentSheet.tsx` já valida a extensão no cliente ANTES de
  // enviar os bytes diretamente ao Storage (D-030/Mission 042) — mas um
  // cliente adulterado pode contornar essa checagem e chamar esta
  // Server Action diretamente com `nomeOriginal` de qualquer extensão.
  // Nunca confiar em metadado só declarado pelo cliente para o que vira
  // um `public.documents` real e visível (Seção 3 desta missão: "MIME/
  // type/size largely originated from client-declared metadata").
  // Reaproveita a MESMA lista fechada (`ALLOWED_FILE_EXTENSIONS`) já
  // usada no cliente — nunca uma segunda convenção divergente. Os bytes
  // já estarão no Storage neste ponto (upload direto do cliente); a
  // garantia real desta checagem é "nunca vira um registro válido em
  // `public.documents`", nunca "nenhum byte chega ao bucket" — por isso
  // o objeto órfão é removido em melhor esforço (`removeStorageObject`),
  // nunca uma varredura de antivírus/assinatura de arquivo (fora de
  // escopo, Seção 11: "Do not build antivirus scanning").
  if (!isAllowedFileExtension(parsed.data.nomeOriginal)) {
    await removeStorageObject(parsed.data.storagePath).catch(() => {
      // Melhor esforço — nunca mascara a rejeição por uma falha de limpeza.
    });
    return {
      status: "error",
      message: "Tipo de arquivo não suportado.",
    };
  }

  // Mission 195 Closure — Trusted Upload Boundary & Activation
  // Integrity, Seção 6/8/9. A checagem acima só prova que o NOME do
  // arquivo termina em uma extensão permitida — nunca que os BYTES
  // genuinamente correspondem a esse tipo (`DefaultCsvParser.parse()`
  // nunca lança para conteúdo binário, decodificando qualquer coisa
  // como texto; `DefaultPdfParser` só lançaria mais tarde, na análise
  // real, nunca no upload). Os bytes já estão no Storage neste ponto
  // (upload direto do cliente, D-030) — baixados aqui apenas para a
  // verificação mais barata defensável (assinatura `%PDF-`/heurística
  // de binário para CSV, `validateDocumentContent()`), nunca uma
  // segunda implementação de parser real. Um PDF com assinatura válida
  // mas estruturalmente corrompido continua passando por aqui — cabe
  // ao processamento técnico real (Mission 193) decidir isso depois,
  // isolado por documento, nunca a este limite de upload.
  try {
    const blob = await downloadDocumentFile(parsed.data.storagePath);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const contentValidation = validateDocumentContent(parsed.data.nomeOriginal, bytes);

    if (!contentValidation.valid) {
      await removeStorageObject(parsed.data.storagePath).catch(() => {
        // Melhor esforço — nunca mascara a rejeição por uma falha de limpeza.
      });
      return {
        status: "error",
        message: contentValidation.reason,
      };
    }
  } catch {
    // Falha ao baixar/ler o objeto recém-enviado — nunca registra um
    // documento cujo conteúdo não pôde ser verificado (fail-closed,
    // mesmo princípio de D-113: ausência de sinal nunca vira "aceito").
    await removeStorageObject(parsed.data.storagePath).catch(() => {});
    return {
      status: "error",
      message: "Não foi possível verificar o arquivo enviado. Tente novamente.",
    };
  }

  try {
    await insertDocumentRecord(parsed.data);
  } catch {
    // Mission 195 Closure, Seção 13. Achado pré-existente à esta
    // missão (não introduzido pela validação de conteúdo acima): uma
    // falha no `insert` (ex.: violação de constraint) deixava o objeto
    // já validado no Storage órfão para sempre — mesma limpeza em
    // melhor esforço já aplicada às duas rejeições acima.
    await removeStorageObject(parsed.data.storagePath).catch(() => {});
    return {
      status: "error",
      message: "Não foi possível registrar o documento. Tente novamente.",
    };
  }

  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/documents");
  return { status: "success", message: "Documento enviado com sucesso." };
}

export async function deleteDocumentAction(
  companyId: string,
  documentId: string
): Promise<void> {
  await softDeleteDocument(documentId);
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/documents");
}

export async function getDocumentDownloadUrlAction(
  storagePath: string
): Promise<string> {
  return getSignedDownloadUrl(storagePath);
}

/**
 * Resolve nome original + caminho de Storage de documentos reais a
 * partir de `documentId`s canônicos (`public.documents.id`, Mission
 * 108 — Canonical Document Identity) — usado pelo painel "Ver origem"
 * (Mission 109) para abrir o documento real, nunca por correspondência
 * de nome. Reaproveita o mesmo RLS/mecanismo de acesso já existente —
 * nenhuma URL pública nova, nenhum acesso privilegiado.
 */
export async function getDocumentTraceabilityInfoAction(
  documentIds: readonly string[]
): Promise<{ id: string; nomeOriginal: string; storagePath: string }[]> {
  const documents = await getDocumentsByIds(documentIds);
  return documents.map((document) => ({
    id: document.id,
    nomeOriginal: document.nome_original,
    storagePath: document.storage_path,
  }));
}
