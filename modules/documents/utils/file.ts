import {
  ALLOWED_FILE_EXTENSIONS,
  ANALYZABLE_FILE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "@/modules/documents/constants";

const DIACRITICS_PATTERN = new RegExp("[̀-ͯ]", "g");

export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function isAllowedFileExtension(fileName: string): boolean {
  const extension = getFileExtension(fileName);
  return (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Mission 195 — Founding Company Production Onboarding & First
 * Executive Value, Seção 10/44 (consolidada na Mission 195 Closure,
 * Seção 28/29, sobre `ANALYZABLE_FILE_EXTENSIONS` — única fonte de
 * verdade, nunca mais uma lista própria divergente do filtro real de
 * `listAnalyzableDocumentsByCompany()` ou do dispatch de
 * `parseSupportedFile()`). `ALLOWED_FILE_EXTENSIONS` é mais permissivo
 * de propósito (permite armazenar XLSX/DOC/imagem para arquivamento —
 * Categoria "Outros"/"Notas Fiscais", nunca analisados) — esta função é
 * o único predicado usado para decidir se um documento JÁ ARMAZENADO
 * algum dia vai contribuir para uma análise financeira, nunca se ele
 * pode ser enviado. Testada em
 * `tests/activation/analyzable-format-truth.test.ts` para permanecer
 * consistente com a query real.
 */
export function isAnalyzableDocumentName(fileName: string): boolean {
  const extension = getFileExtension(fileName);
  return (ANALYZABLE_FILE_EXTENSIONS as readonly string[]).includes(extension);
}

export function isAllowedFileSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_FILE_SIZE_BYTES;
}

export function sanitizeFileName(fileName: string): string {
  const extension = getFileExtension(fileName);
  const base = fileName
    .slice(0, extension ? fileName.length - extension.length - 1 : undefined)
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return extension ? `${base || "arquivo"}.${extension}` : base || "arquivo";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

/** Client-only: usa Web Crypto (crypto.subtle), indisponivel no servidor. */
export async function computeSha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
