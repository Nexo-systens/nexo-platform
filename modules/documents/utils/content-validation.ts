import { getFileExtension } from "@/modules/documents/utils/file";

/**
 * Mission 195 Closure — Trusted Upload Boundary & Activation Integrity.
 *
 * `isAllowedFileExtension()` (Mission 195) só prova que o NOME do
 * arquivo termina em uma extensão permitida — nunca que os BYTES
 * enviados genuinamente correspondem a esse tipo. Um cliente
 * adulterado (ou um usuário renomeando `foto.jpg` para `dre.pdf`)
 * sempre conseguia registrar um `public.documents` válido com
 * conteúdo incompatível — `DefaultCsvParser.parse()` (`file.text()`)
 * NUNCA lança para bytes binários (decodifica qualquer coisa como
 * texto, com caracteres de substituição), então um `.csv` de conteúdo
 * binário virava `documents.status = "processed"` de forma enganosa
 * (zero linhas financeiras reconhecidas, mas nenhum sinal de que o
 * arquivo nunca foi um CSV real). `DefaultPdfParser` já lança para
 * bytes que não são PDF genuíno (confirmado por
 * `parser-resilience.test.ts`, Mission 193) — mas só na hora da
 * ANÁLISE, nunca no upload, deixando a janela entre envio e primeira
 * análise sem nenhum sinal de incompatibilidade.
 *
 * Estas funções são PURAS e DELIBERADAMENTE baratas — a menor
 * verificação defensável (Seção 8/9 da missão), nunca uma segunda
 * implementação de parser: apenas a assinatura binária do PDF
 * (`%PDF-`, o mesmo cabeçalho que todo leitor de PDF real exige) e uma
 * heurística padrão de "isto é binário, não texto" para CSV (presença
 * de byte NUL — o mesmo sinal que ferramentas como `git diff`/`file`
 * usam para decidir se um arquivo é binário). Nunca reimplementam
 * `pdf-parse`/decodificação de CSV — um PDF com assinatura válida mas
 * estruturalmente corrompido continua podendo passar por aqui e falhar
 * depois, corretamente, durante o processamento técnico real (Mission
 * 193, isolamento por documento preservado — Seção 21/34 desta
 * missão: "obviously not PDF" é rejeitado aqui; "looks like PDF but
 * corrupt" continua sendo responsabilidade do parser real).
 */

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const BINARY_SAMPLE_SIZE = 8192;
const NULL_BYTE = 0x00;

export function hasPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_SIGNATURE.length) return false;
  return PDF_SIGNATURE.every((expected, index) => bytes[index] === expected);
}

/**
 * Heurística padrão de detecção de binário: um byte NUL em qualquer
 * lugar de uma amostra inicial do arquivo é um sinal forte de conteúdo
 * não-textual — texto genuíno (incluindo UTF-8/Latin-1 com acentuação
 * brasileira) nunca contém NUL em uso normal. Amostra limitada
 * (8KB) — nunca precisa ler o arquivo inteiro para decidir "isto
 * claramente não é texto".
 */
export function looksLikeBinaryContent(bytes: Uint8Array): boolean {
  const sampleLength = Math.min(bytes.length, BINARY_SAMPLE_SIZE);
  for (let index = 0; index < sampleLength; index += 1) {
    if (bytes[index] === NULL_BYTE) return true;
  }
  return false;
}

export type DocumentContentValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

/**
 * Única fronteira de validação de CONTEÚDO — chamada apenas para as
 * duas extensões que a análise financeira genuinamente processa hoje
 * (`.pdf`/`.csv`, `isAnalyzableDocumentName()`). Formatos permitidos
 * para armazenamento mas nunca analisados (XLSX/XLS/DOC/DOCX/PNG/JPG/
 * JPEG — Mission 195) não têm verificação de conteúdo alguma aqui —
 * fora do escopo desta missão (Seção 3: "Do NOT add XLS/XLSX/DOC/DOCX/
 * PNG/JPG/OCR"), e nenhuma alegação de "analisável" é feita sobre eles
 * de qualquer forma (`DocumentAnalyzabilityBadge`, Mission 195).
 */
export function validateDocumentContent(
  fileName: string,
  bytes: Uint8Array
): DocumentContentValidation {
  if (bytes.length === 0) {
    return { valid: false, reason: "O arquivo está vazio." };
  }

  const extension = getFileExtension(fileName);

  if (extension === "pdf") {
    if (!hasPdfSignature(bytes)) {
      return {
        valid: false,
        reason: "O conteúdo do arquivo não corresponde a um PDF válido.",
      };
    }
    return { valid: true };
  }

  if (extension === "csv") {
    if (looksLikeBinaryContent(bytes)) {
      return {
        valid: false,
        reason: "O conteúdo do arquivo não corresponde a um CSV de texto válido.",
      };
    }
    return { valid: true };
  }

  // Formato permitido para armazenamento mas nunca analisado — nenhuma
  // verificação de conteúdo é feita (fora de escopo, nenhuma alegação
  // de analisabilidade a proteger).
  return { valid: true };
}
