import type { RawFinancialDocument, RawFinancialLine } from "@/efos/engines/data";
import type { ResourceType, StatementCategory, StatementConflict } from "@/efos/domain";
import { RESOURCE_TYPES, STATEMENT_LINE_CATEGORIES } from "@/efos/domain";

/**
 * Mission 192 Closure B — Deterministic Statement Conflict Governance.
 *
 * Substitui/corrige D-112 (Mission 192 Closure): D-112 misturava, sob
 * uma única regra genérica ("mantém o primeiro"), duas situações
 * radicalmente diferentes — duplicata/equivalência econômica (que pode
 * colapsar com segurança) e conflito material genuíno (que NUNCA pode
 * ser resolvido por ordem de chegada). Esta correção — D-113 — separa
 * as duas em fases explícitas, nunca uma terceira regra que as funda
 * de novo.
 *
 * Vocabulário fechado de motivo de exclusão (Seção 20 da missão) —
 * substitui a string livre que `ExcludedDocument.reason` sempre foi
 * desde a Mission 192 (deliberadamente aberta até existir um segundo
 * motivo real; agora existem três). `reason` (texto) permanece para
 * leitura humana; `code` é o vocabulário machine-readable.
 */
export const EXCLUDED_DOCUMENT_REASON_CODES = [
  /** Demonstrativo reconhecido mas com período/data-base indeterminável (Mission 192, comportamento preservado). */
  "invalid_document",
  /** Economicamente equivalente a outro documento do mesmo período/data-base já presente no lote — colapsado, nunca somado. */
  "duplicate_content",
  /** Período/data-base diferente do mais recente presente no lote — nunca agregado silenciosamente. */
  "non_current_period",
  /** Conflito material não resolvido com outro documento do MESMO período/data-base — nenhuma autoridade automática. */
  "same_period_conflict",
] as const;
export type ExcludedDocumentReasonCode = (typeof EXCLUDED_DOCUMENT_REASON_CODES)[number];

/**
 * Documento estruturalmente reconhecido mas EXCLUÍDO do lote enviado
 * ao Financial Model Engine — nunca silenciosamente descartado, nunca
 * silenciosamente aceito. `code` é aditivo desde a Mission 192 Closure
 * B (`reason`, string livre, já existia desde a Mission 192) — todo
 * `ExcludedDocument` produzido a partir desta missão sempre carrega
 * ambos.
 */
export interface ExcludedDocument {
  readonly documentId: string;
  readonly source: string;
  readonly code: ExcludedDocumentReasonCode;
  readonly reason: string;
}

export interface StatementConflictResolution {
  readonly kept: readonly RawFinancialDocument[];
  readonly excluded: readonly ExcludedDocument[];
  /** Ver `efos/domain/value-objects/StatementConflict.ts` — repassado adiante até `FinancialModelAggregate.statementConflicts` (D-113). */
  readonly conflicts: readonly StatementConflict[];
}

/** Identidade temporal de um documento já classificado. */
interface DocumentTemporalInfo {
  readonly document: RawFinancialDocument;
  readonly group: "dre" | "balance" | "other";
  readonly key?: string;
  readonly endTimestamp?: number;
}

function classifyTemporalInfo(document: RawFinancialDocument): DocumentTemporalInfo {
  const statementLine = document.lines.find(
    (line) => line.kindHint === "statement_line" && line.period !== undefined
  );
  if (statementLine?.period) {
    return {
      document,
      group: "dre",
      key: `${statementLine.period.startDate}|${statementLine.period.endDate}`,
      endTimestamp: new Date(statementLine.period.endDate).getTime(),
    };
  }

  const balanceLine = document.lines.find(
    (line) => line.kindHint === "resource" && line.asOfDate !== undefined
  );
  if (balanceLine?.asOfDate) {
    return {
      document,
      group: "balance",
      key: balanceLine.asOfDate,
      endTimestamp: new Date(balanceLine.asOfDate).getTime(),
    };
  }

  return { document, group: "other" };
}

const CENTS = 100;

function toCents(amount: number): number {
  return Math.round(amount * CENTS);
}

/**
 * Total economicamente relevante de uma `StatementCategory` DENTRO de
 * um único documento — mesma regra de precedência total/subtotal de
 * `selectStatementLinesForCategory()`
 * (efos/engines/indicators/indicators.calculator.ts), reaplicada sobre
 * `RawFinancialLine[]` porque esta fase roda ANTES do Financial Model
 * Engine (`StatementLine` de domínio ainda não existe aqui) — nunca
 * uma segunda lógica de seleção divergente, apenas a MESMA regra na
 * forma de dado correta para este estágio do pipeline.
 */
function statementCategoryTotalCents(
  lines: readonly RawFinancialLine[],
  category: StatementCategory
): number | undefined {
  const matching = lines.filter(
    (line) => line.kindHint === "statement_line" && line.statementCategory === category
  );
  if (matching.length === 0) return undefined;

  const totals = matching.filter((line) => line.isTotalLine);
  const selected = totals.length > 0 ? totals : matching;
  return toCents(selected.reduce((sum, line) => sum + (line.amount ?? 0), 0));
}

/** Mesmo princípio de `statementCategoryTotalCents()`, para saldos de Balancete por `ResourceType`. */
function resourceTypeTotalCents(
  lines: readonly RawFinancialLine[],
  type: ResourceType
): number | undefined {
  const matching = lines.filter(
    (line) =>
      line.kindHint === "resource" &&
      line.resourceTypeHint === type &&
      line.asOfDate !== undefined
  );
  if (matching.length === 0) return undefined;
  return toCents(matching.reduce((sum, line) => sum + (line.amount ?? 0), 0));
}

function distinctCurrencies(
  lines: readonly RawFinancialLine[],
  kindHint: "statement_line" | "resource"
): readonly string[] {
  return [
    ...new Set(
      lines
        .filter((line) => line.kindHint === kindHint && line.currency !== undefined)
        .map((line) => line.currency as string)
    ),
  ].sort();
}

/**
 * Impressão digital econômica de um documento DRE (Seção 5/6 da
 * missão) — usa EXCLUSIVAMENTE conteúdo economicamente relevante
 * (total por `StatementCategory`, já respeitando total/subtotal
 * explícito, e as moedas usadas). NUNCA `documentId`, `label`
 * (texto), ordem das linhas, ou timestamp de upload — dois documentos
 * com a MESMA impressão digital são economicamente EQUIVALENTES
 * (duplicata exata do mesmo arquivo, ou dois arquivos diferentes
 * descrevendo o mesmo fato financeiro), nunca o inverso: qualquer
 * total de categoria diferente (mesmo um centavo, após
 * arredondamento) produz impressões digitais diferentes — nunca trata
 * estatutos materialmente diferentes como equivalentes.
 *
 * Deliberadamente uma impressão digital PRÓPRIA — nunca reaproveita
 * `financialTruthFingerprint()` (`modules/decisions/lib/selectCurrentFinancialExecution.ts`,
 * Mission 176 Closure): aquela fingerprint cobre os 6 agregados de uma
 * execução INTEIRA já persistida (útil para decidir a verdade
 * financeira ATUAL entre execuções concorrentes), não a igualdade
 * econômica de DOIS DOCUMENTOS ainda não processados pelo Financial
 * Model Engine — usar aquele mecanismo aqui compararia estrutura
 * inteiramente incompatível (Seção 5 da missão: "Do not automatically
 * reuse a fingerprint whose semantics are wrong for financial
 * statements").
 */
export function computeDreEconomicFingerprint(lines: readonly RawFinancialLine[]): string {
  const totals = STATEMENT_LINE_CATEGORIES.map(
    (category) => statementCategoryTotalCents(lines, category) ?? null
  );
  return JSON.stringify({ totals, currencies: distinctCurrencies(lines, "statement_line") });
}

/** Mesmo princípio de `computeDreEconomicFingerprint()`, para Balancete (Seção 7 da missão): total por `ResourceType`. */
export function computeBalanceEconomicFingerprint(lines: readonly RawFinancialLine[]): string {
  const totals = RESOURCE_TYPES.map((type) => resourceTypeTotalCents(lines, type) ?? null);
  return JSON.stringify({ totals, currencies: distinctCurrencies(lines, "resource") });
}

function economicFingerprintFor(
  group: "dre" | "balance",
  document: RawFinancialDocument
): string {
  return group === "dre"
    ? computeDreEconomicFingerprint(document.lines)
    : computeBalanceEconomicFingerprint(document.lines);
}

interface BucketSurvivor {
  readonly key: string;
  readonly endTimestamp: number;
  readonly info: DocumentTemporalInfo;
}

/**
 * Resolve a identidade temporal ENTRE documentos já classificados do
 * mesmo lote (DRE ou Balancete) em três fases explícitas — nunca uma
 * única regra genérica "mantém um" (Seção 2 da missão, corrigindo
 * D-112):
 *
 * **Fase 1 — particiona por chave temporal** (período do DRE /
 * data-base do Balancete). Documentos de chaves diferentes nunca
 * competem entre si nesta fase (Seção 3: "different period/date").
 *
 * **Fase 2 — dentro de cada chave repetida, decide por equivalência
 * econômica** (`computeDreEconomicFingerprint()`/
 * `computeBalanceEconomicFingerprint()`, nunca por ordem de chegada):
 * todos equivalentes → colapsa em um único sobrevivente escolhido
 * deterministicamente (Seção 8/9 — duplicata exata OU arquivos
 * diferentes economicamente idênticos, mesmo tratamento); qualquer
 * divergência material → NENHUM documento da chave sobrevive —
 * registrado como `StatementConflict` (Seção 10/24: "neither
 * automatically has authority").
 *
 * **Fase 3 — entre as chaves que sobreviveram à Fase 2**, quando mais
 * de uma permanece (períodos/datas genuinamente diferentes), apenas a
 * mais recente (por conteúdo do próprio documento — período/data-base
 * — nunca por upload/processamento) continua (Seção 13).
 *
 * Permutation-invariant por construção (Seção 4/23): cada fase decide
 * por CONTEÚDO (impressão digital econômica, timestamp de
 * período/data-base) ou por uma função determinística do conjunto
 * (`documentId` mínimo), nunca pela posição no array `documents`
 * recebido — `[A, B]` e `[B, A]` sempre produzem o mesmo conjunto
 * `kept`/`conflicts` (a única diferença possível — irrelevante para a
 * verdade financeira — é qual `documentId` textualmente concreto
 * aparece como sobrevivente de um grupo já provado equivalente).
 */
export function resolveStatementConflicts(
  documents: readonly RawFinancialDocument[]
): StatementConflictResolution {
  const infos = documents.map(classifyTemporalInfo);
  const excluded: ExcludedDocument[] = [];
  const conflicts: StatementConflict[] = [];
  const excludedDocumentIds = new Set<string>();

  for (const group of ["dre", "balance"] as const) {
    const groupInfos = infos.filter((info) => info.group === group);
    if (groupInfos.length <= 1) continue;

    const buckets = new Map<string, DocumentTemporalInfo[]>();
    for (const info of groupInfos) {
      const key = info.key as string;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(info);
      else buckets.set(key, [info]);
    }

    const survivors: BucketSurvivor[] = [];

    for (const [key, bucketInfos] of buckets) {
      if (bucketInfos.length === 1) {
        survivors.push({
          key,
          endTimestamp: bucketInfos[0].endTimestamp ?? -Infinity,
          info: bucketInfos[0],
        });
        continue;
      }

      const fingerprints = bucketInfos.map((info) => economicFingerprintFor(group, info.document));
      const allEquivalent = fingerprints.every((fingerprint) => fingerprint === fingerprints[0]);

      if (allEquivalent) {
        const sorted = [...bucketInfos].sort((a, b) =>
          a.document.documentId.localeCompare(b.document.documentId)
        );
        const [survivor, ...duplicates] = sorted;
        for (const duplicate of duplicates) {
          excludedDocumentIds.add(duplicate.document.documentId);
          excluded.push({
            documentId: duplicate.document.documentId,
            source: duplicate.document.source,
            code: "duplicate_content",
            reason:
              group === "dre"
                ? `Documento de demonstrativo (DRE) economicamente equivalente a outro documento do mesmo período já presente neste lote (${survivor.document.documentId}) — uma única contribuição econômica, nunca somada/duplicada.`
                : `Documento de Balancete economicamente equivalente a outro documento da mesma data-base já presente neste lote (${survivor.document.documentId}) — uma única contribuição econômica, nunca somada/duplicada.`,
          });
        }
        survivors.push({ key, endTimestamp: survivor.endTimestamp ?? -Infinity, info: survivor });
      } else {
        for (const info of bucketInfos) {
          excludedDocumentIds.add(info.document.documentId);
          excluded.push({
            documentId: info.document.documentId,
            source: info.document.source,
            code: "same_period_conflict",
            reason:
              group === "dre"
                ? "Documento de demonstrativo (DRE) em conflito material não resolvido com outro(s) documento(s) do MESMO período neste lote — nenhuma declaração tem autoridade automática; nenhuma é somada, mesclada ou escolhida por ordem de chegada."
                : "Documento de Balancete em conflito material não resolvido com outro(s) documento(s) da MESMA data-base neste lote — nenhuma declaração tem autoridade automática; nenhuma é somada, mesclada ou escolhida por ordem de chegada.",
          });
        }
        conflicts.push({
          scope: group === "dre" ? "income_statement" : "balance",
          key,
          documentIds: bucketInfos.map((info) => info.document.documentId).sort(),
        });
      }
    }

    if (survivors.length > 1) {
      const maxEnd = Math.max(...survivors.map((survivor) => survivor.endTimestamp));
      for (const survivor of survivors) {
        if (survivor.endTimestamp !== maxEnd) {
          excludedDocumentIds.add(survivor.info.document.documentId);
          excluded.push({
            documentId: survivor.info.document.documentId,
            source: survivor.info.document.source,
            code: "non_current_period",
            reason:
              group === "dre"
                ? "Documento de demonstrativo (DRE) com período diferente do mais recente presente no mesmo lote — períodos diferentes nunca são agregados silenciosamente; apenas o período financeiro mais recente é considerado na análise atual."
                : "Documento de Balancete com data-base diferente da mais recente presente no mesmo lote — datas diferentes nunca são somadas silenciosamente; apenas a data-base mais recente é considerada na análise atual.",
          });
        }
      }
    }
  }

  return {
    kept: documents.filter((document) => !excludedDocumentIds.has(document.documentId)),
    excluded,
    conflicts,
  };
}
