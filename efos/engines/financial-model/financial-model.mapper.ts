import type {
  AuditTrail,
  FinancialEvent,
  FinancialModel,
  FinancialModelAggregate,
  Indicator,
  Money,
  Provenance,
  Resource,
  StatementLine,
} from "@/efos/domain";

import { FINANCIAL_MODEL_ENGINE_CONSTANTS } from "./financial-model.constants";
import type {
  FinancialModelEngineInput,
  NormalizedFinancialRecord,
} from "./financial-model.types";

/**
 * Mapper do Financial Model Engine. Responsavel exclusivamente por
 * transformacao de dados (registro normalizado -> entidade de dominio)
 * — nenhuma validacao (financial-model.validator.ts cuida disso antes)
 * e nenhuma regra de negocio acontece aqui.
 */

function buildProvenance(source: string): Provenance {
  // Confianca fixa nesta fase: este mapper apenas estrutura o dado ja
  // recebido, nao avalia sua qualidade. Ver README.md, "Limitacoes".
  return { source, confidence: { value: 100, level: "very_high" } };
}

function buildAuditTrail(timestamp: string): AuditTrail {
  return { createdAt: timestamp, updatedAt: timestamp, version: 1 };
}

function toMoney(
  amount: number | undefined,
  currency: string | undefined
): Money | undefined {
  if (amount === undefined) return undefined;
  return { amount, currency: currency ?? "BRL" };
}

function mapResource(
  record: NormalizedFinancialRecord,
  companyId: string,
  financialModelId: string,
  timestamp: string
): Resource {
  return {
    id: record.recordId,
    companyId,
    financialModelId,
    type: record.resourceType as Resource["type"],
    label: record.label,
    value: toMoney(record.amount, record.currency),
    // Mission 192 Closure, D-111: aditivo — ausente para todo Resource
    // que não veio de um Balancete com data-base reconhecida (o caso
    // comum antes desta missão, comportamento inalterado).
    ...(record.asOfDate ? { asOfDate: record.asOfDate } : {}),
    provenance: buildProvenance(record.source),
    audit: buildAuditTrail(timestamp),
  };
}

function mapEvent(
  record: NormalizedFinancialRecord,
  companyId: string,
  financialModelId: string,
  timestamp: string
): FinancialEvent {
  return {
    id: record.recordId,
    companyId,
    financialModelId,
    type: record.eventType as FinancialEvent["type"],
    amount: toMoney(record.amount, record.currency),
    occurredAt: record.occurredAt as string,
    label: record.label,
    provenance: buildProvenance(record.source),
    audit: buildAuditTrail(timestamp),
  };
}

/**
 * Mission 192 — Canonical Financial Statement Ingestion & Period
 * Semantics, D-106. Espelha `mapEvent()`/`mapResource()` byte a byte
 * na estrutura de proveniência/auditoria/id — a única diferença
 * semântica é `period` (o intervalo que o documento cobre) no lugar de
 * `occurredAt` (uma data pontual que a linha nunca teve).
 */
function mapStatementLine(
  record: NormalizedFinancialRecord,
  companyId: string,
  financialModelId: string,
  timestamp: string
): StatementLine {
  return {
    id: record.recordId,
    companyId,
    financialModelId,
    statementType: "income_statement",
    category: record.statementCategory as StatementLine["category"],
    label: record.label,
    amount: toMoney(record.amount, record.currency),
    period: record.period as StatementLine["period"],
    isTotalLine: record.isTotalLine ?? false,
    provenance: buildProvenance(record.source),
    audit: buildAuditTrail(timestamp),
  };
}

/**
 * Deriva o ID do Financial Model deterministicamente a partir do
 * companyId — garante um unico modelo vivo por empresa
 * (docs/DECISIONS.md, D-001), nunca um modelo por documento/execucao.
 */
function buildFinancialModelId(companyId: string): string {
  return `${FINANCIAL_MODEL_ENGINE_CONSTANTS.idPrefix}-${companyId}`;
}

export function mapToFinancialModelAggregate(
  input: FinancialModelEngineInput
): FinancialModelAggregate {
  const timestamp = new Date().toISOString();
  const financialModelId = buildFinancialModelId(input.companyId);

  const root: FinancialModel = {
    id: financialModelId,
    companyId: input.companyId,
    provenance: buildProvenance(FINANCIAL_MODEL_ENGINE_CONSTANTS.name),
    audit: buildAuditTrail(timestamp),
  };

  const resources: Resource[] = input.records
    .filter((record) => record.kind === "resource")
    .map((record) =>
      mapResource(record, input.companyId, financialModelId, timestamp)
    );

  const events: FinancialEvent[] = input.records
    .filter((record) => record.kind === "event")
    .map((record) =>
      mapEvent(record, input.companyId, financialModelId, timestamp)
    );

  // Mission 192, D-106: terceira coleção, estruturalmente separada de
  // `resources`/`events` — nunca fundida com nenhuma das duas.
  const statementLines: StatementLine[] = input.records
    .filter((record) => record.kind === "statement_line")
    .map((record) =>
      mapStatementLine(record, input.companyId, financialModelId, timestamp)
    );

  // Indicadores nunca sao calculados aqui — fora do escopo desta missao
  // (Indicators Engine). O agregado sempre retorna esta lista vazia.
  const indicators: Indicator[] = [];

  // Mission 192 Closure B, D-113: repasse puro, sem transformacao —
  // `input.conflicts` ja vem inteiramente resolvido por
  // `prepareFinancialDocuments()` (Application layer). Condicional
  // (nunca `[]` explicito) pelo mesmo motivo de `statementLines`: todo
  // `FinancialModelAggregate` sem conflito continua identico byte a
  // byte ao produzido antes desta missao.
  const conflicts = input.conflicts ?? [];

  return {
    root,
    resources,
    events,
    ...(statementLines.length > 0 ? { statementLines } : {}),
    ...(conflicts.length > 0 ? { statementConflicts: conflicts } : {}),
    indicators,
  };
}
