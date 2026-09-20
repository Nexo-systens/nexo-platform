// Caminho previsivel: company/{companyId}/{documentId}/{arquivo}. As
// policies de storage.objects (migration 004) dependem exatamente desta
// forma — (storage.foldername(name))[2] deve ser o companyId.
export function buildDocumentStoragePath(
  companyId: string,
  documentId: string,
  fileName: string
): string {
  return `company/${companyId}/${documentId}/${fileName}`;
}
