// Bucket privado do Supabase Storage (criado na migration 004).
export const STORAGE_BUCKET = "documents";

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

// Categorias iniciais pedidas pela Missao 5. Novas categorias sao
// adicionadas aqui, sem migration — "categoria" e text no banco de
// proposito (docs/03_DATABASE.md nao se aplica: conjunto aberto).
export const DOCUMENT_CATEGORIES = [
  { value: "dre", label: "DRE" },
  { value: "balanco_patrimonial", label: "Balanço Patrimonial" },
  { value: "fluxo_de_caixa", label: "Fluxo de Caixa" },
  { value: "extrato_bancario", label: "Extrato Bancário" },
  { value: "balancete", label: "Balancete" },
  { value: "livro_razao", label: "Livro Razão" },
  { value: "livro_diario", label: "Livro Diário" },
  { value: "notas_fiscais", label: "Notas Fiscais" },
  { value: "outros", label: "Outros" },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["value"];

export const DOCUMENT_CATEGORY_LABELS = Object.fromEntries(
  DOCUMENT_CATEGORIES.map((category) => [category.value, category.label])
) as Record<DocumentCategory, string>;

export const ALLOWED_FILE_EXTENSIONS = [
  "pdf",
  "xlsx",
  "xls",
  "csv",
  "doc",
  "docx",
  "png",
  "jpg",
  "jpeg",
] as const;

/**
 * Mission 195 Closure — Trusted Upload Boundary & Activation Integrity,
 * Seção 28/29. Única fonte de verdade dos formatos com parser real
 * hoje (`DefaultPdfParser`/`DefaultCsvParser`,
 * `efos/platform/parsers/README.md`) — antes desta missão, três lugares
 * distintos mantinham a mesma resposta "apenas PDF/CSV" de forma
 * independente e sujeita a divergência: o filtro SQL de
 * `listAnalyzableDocumentsByCompany()`, `isAnalyzableDocumentName()`
 * (UI), e o dispatch de `parseSupportedFile()` (Data Engine). Os três
 * agora derivam desta ÚNICA lista — nunca uma quarta convenção
 * divergente caso um formato novo ganhe parser real no futuro.
 * Deliberadamente um SUBCONJUNTO de `ALLOWED_FILE_EXTENSIONS` (nunca o
 * contrário) — todo formato analisável é enviável, mas nem todo
 * formato enviável é analisável (XLSX/DOC/etc. permanecem apenas
 * armazenados).
 */
export const ANALYZABLE_FILE_EXTENSIONS = ["pdf", "csv"] as const;
export type AnalyzableFileExtension = (typeof ANALYZABLE_FILE_EXTENSIONS)[number];
