/**
 * Conflito de identidade temporal entre demonstrativos (Mission 192
 * Closure B — Deterministic Statement Conflict Governance, D-113):
 * duas ou mais fontes do MESMO tipo (DRE ou Balancete) declaram o
 * MESMO período/data-base com conteúdo economicamente MATERIALMENTE
 * diferente — nenhuma delas tem autoridade automática (nunca "primeiro
 * vence", nunca "último vence", nunca ordem de upload/processamento).
 *
 * Detectado em `app/api/efos/_shared/resolveStatementConflicts.ts`
 * (Application layer, ANTES do Financial Model Engine — os documentos
 * conflitantes já são excluídos do lote, `RawFinancialDocument` nunca
 * chega a produzir `StatementLine`/`Resource` para o período/data em
 * conflito), mas precisa sobreviver até o Indicators Engine: sem este
 * registro, a ausência de `StatementLine`s para aquele período seria
 * indistinguível de "nenhum DRE/Balancete jamais existiu" — o que
 * reabriria exatamente o bug que esta missão corrige (fallback
 * silencioso para soma de eventos/zerar saldos quando na verdade havia
 * um conflito genuíno não resolvido).
 *
 * Vive em `efos/domain` (nunca em `app/api/`) porque
 * `FinancialModelAggregate.statementConflicts` (aditivo, ver
 * `efos/domain/aggregates/index.ts`) e
 * `extractFinancialStatementInputs()` (`efos/engines/indicators/`)
 * precisam consumi-lo — um Engine nunca pode importar de `app/api/`
 * (Camadas, docs/ARCHITECTURE.md).
 */
export const STATEMENT_CONFLICT_SCOPES = ["income_statement", "balance"] as const;
export type StatementConflictScope = (typeof STATEMENT_CONFLICT_SCOPES)[number];

export interface StatementConflict {
  readonly scope: StatementConflictScope;
  /** Período (DRE, `"startDate|endDate"`) ou data-base (Balancete, `asOfDate`) em conflito — puramente identificador, nunca exibido cru ao usuário. */
  readonly key: string;
  /** `documentId`s das fontes conflitantes — nunca resolvido para "vencedor", preservado apenas como lastro/lineage. */
  readonly documentIds: readonly string[];
}
