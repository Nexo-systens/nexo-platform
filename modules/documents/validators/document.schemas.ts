import { z } from "zod";

import {
  DOCUMENT_CATEGORIES,
  MAX_FILE_SIZE_BYTES,
} from "@/modules/documents/constants";

const CATEGORY_VALUES = DOCUMENT_CATEGORIES.map(
  (category) => category.value
) as [string, ...string[]];

export const createDocumentSchema = z.object({
  companyId: z.uuid({ error: "Empresa inválida." }),
  documentId: z.uuid({ error: "Identificador de documento inválido." }),
  categoria: z.enum(CATEGORY_VALUES, { error: "Selecione uma categoria." }),
  nomeOriginal: z
    .string()
    .trim()
    .min(1, { error: "Nome do arquivo obrigatório." }),
  nomeArmazenado: z.string().trim().min(1),
  tipoArquivo: z.string().trim().min(1),
  tamanhoBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE_BYTES, {
      error: "Arquivo excede o tamanho máximo permitido.",
    }),
  storagePath: z.string().trim().min(1),
  hashArquivo: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/, { error: "Hash inválido." }),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const documentListFiltersSchema = z.object({
  q: z.string().trim().optional(),
  sort: z
    .enum(["nome_original", "categoria", "created_at"])
    .default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type DocumentListFilters = z.infer<typeof documentListFiltersSchema>;
