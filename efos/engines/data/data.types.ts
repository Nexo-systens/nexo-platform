import type {
  FinancialEventType,
  Period,
  ResourceType,
  StatementCategory,
} from "@/efos/domain";

/**
 * Linha de dado financeiro dentro de um documento bruto. Assume que a
 * extracao de texto/OCR de arquivos binarios ja aconteceu em uma etapa
 * anterior — fora do escopo desta missao (nenhuma IA, nenhum acesso a
 * Storage/Supabase aqui). O Data Engine recebe dado ja estruturado em
 * linhas, nunca bytes de arquivo. Ver README.md, "Limitacoes".
 *
 * `kindHint` ganhou um terceiro valor, `"statement_line"` (Mission 192
 * — Canonical Financial Statement Ingestion & Period Semantics,
 * D-106): uma linha de demonstrativo agregada por periodo (DRE) nunca
 * e uma transacao (`"event"`, exigiria `date`/`occurredAt` que o
 * documento genuinamente nao fornece por linha) nem um saldo pontual
 * (`"resource"`) — e uma terceira forma economica, com seu proprio par
 * de campos (`statementCategory`/`period`), nunca reaproveitando
 * `resourceTypeHint`/`eventTypeHint`/`date`. Produzida exclusivamente
 * por `DefaultFinancialStatementClassifier`
 * (efos/platform/classifiers/), nunca por `DefaultFinancialLineClassifier`
 * (que permanece inalterado — Secao 21 da Mission 192, o caminho de
 * extrato bancario nunca regride).
 */
export interface RawFinancialLine {
  readonly label: string;
  readonly amount?: number;
  readonly currency?: string;
  readonly date?: string;
  readonly kindHint?: "resource" | "event" | "statement_line";
  readonly resourceTypeHint?: ResourceType;
  readonly eventTypeHint?: FinancialEventType;
  /** Presente somente quando `kindHint === "statement_line"`. */
  readonly statementCategory?: StatementCategory;
  /** Periodo do DOCUMENTO inteiro (nunca por linha) — ver StatementLine.ts. */
  readonly period?: Period;
  /** `true` quando a linha e um total/subtotal explicito do documento para `statementCategory` (Secao 32 da Mission 192). */
  readonly isTotalLine?: boolean;
  /**
   * Data real de referencia de um saldo pontual (Mission 192 Closure,
   * D-111) — presente somente quando `kindHint === "resource"` E o
   * documento de origem e reconhecido como um Balancete/Balanco com
   * data-base explicita (`extractBalanceAsOfDate()`). NUNCA presente
   * junto de `date`/`occurredAt` (um saldo nao e uma transacao).
   */
  readonly asOfDate?: string;
}

/** Documento financeiro bruto — unidade de entrada do Data Engine. */
export interface RawFinancialDocument {
  readonly documentId: string;
  readonly companyId: string;
  readonly source: string;
  readonly lines: readonly RawFinancialLine[];
}

export interface DataEngineInput {
  readonly companyId: string;
  readonly documents: readonly RawFinancialDocument[];
}

/**
 * Forma intermediaria produzida pelo Mapper (data.mapper.ts): reshape
 * puro de documento+linha para um registro candidato, sem nenhuma
 * limpeza ou padronizacao de valor. O Normalizer (data.normalizer.ts) e
 * quem padroniza isso na forma final. Nao e exposta fora deste Engine.
 */
export interface CandidateFinancialRecord {
  readonly recordId: string;
  readonly kind: "resource" | "event" | "statement_line";
  readonly resourceType?: ResourceType;
  readonly eventType?: FinancialEventType;
  readonly label: string;
  readonly amount?: number;
  readonly currency?: string;
  readonly occurredAt?: string;
  readonly source: string;
  /** Presente somente quando `kind === "statement_line"` (Mission 192, D-106). */
  readonly statementCategory?: StatementCategory;
  readonly period?: Period;
  readonly isTotalLine?: boolean;
  readonly asOfDate?: string;
}

/**
 * Registro financeiro normalizado — contrato OFICIAL de saida do Data
 * Engine e de entrada do Financial Model Engine
 * (efos/engines/financial-model). Definido aqui porque o Data Engine e
 * o produtor; consumido por importacao de TIPO apenas — nenhum engine
 * chama o execute() de outro (ver README.md, "Integracao entre Engines").
 *
 * `kind` ganhou `"statement_line"` (Mission 192 — Canonical Financial
 * Statement Ingestion & Period Semantics, D-106): um valor agregado
 * por periodo, declarado diretamente por um demonstrativo (DRE) —
 * nunca decomposto em `FinancialEvent`s individuais que o documento
 * nao fornece, nunca com um `occurredAt` fabricado apenas para
 * satisfazer a validacao estrutural do Financial Model Engine.
 */
export interface NormalizedFinancialRecord {
  readonly recordId: string;
  readonly kind: "resource" | "event" | "statement_line";
  readonly resourceType?: ResourceType;
  readonly eventType?: FinancialEventType;
  readonly label: string;
  readonly amount?: number;
  readonly currency?: string;
  readonly occurredAt?: string;
  readonly source: string;
  readonly statementCategory?: StatementCategory;
  readonly period?: Period;
  readonly isTotalLine?: boolean;
  readonly asOfDate?: string;
}

export type DataEngineOutput = readonly NormalizedFinancialRecord[];
