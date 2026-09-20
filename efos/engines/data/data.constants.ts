/**
 * Constantes do Data Engine — nome, versao, limites e mensagens
 * centralizadas. Nenhuma logica, apenas dados fixos.
 */

export const DATA_ENGINE_CONSTANTS = {
  id: "data",
  name: "Data Engine",
  version: "0.1.0",
  maxDocumentsPerBatch: 100,
  defaultCurrency: "BRL",
} as const;

export const DATA_ENGINE_MESSAGES = {
  invalidInput: "Entrada invalida para o Data Engine.",
  missingCompanyId: "companyId e obrigatorio.",
  emptyDocuments: "documents nao pode ser vazio — nenhum documento bruto recebido.",
  missingDocumentId: "documentId e obrigatorio para todo documento.",
  duplicateDocumentId: "documentId duplicado no lote de entrada.",
  missingSource: "source e obrigatorio para todo documento.",
  missingRawContent: "todo documento precisa de ao menos uma linha (lines).",
  missingLabel: "label e obrigatorio para toda linha.",
  tooManyDocuments: "numero de documentos excede o limite por lote",
  noRecordsExtracted:
    "nenhum registro pode ser normalizado a partir dos documentos recebidos.",
} as const;
