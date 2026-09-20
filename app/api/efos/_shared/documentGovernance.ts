import type { RawFinancialDocument } from "@/efos/engines/data";
import type { StatementArithmeticIssue } from "@/efos/engines/indicators";

import type { ExcludedDocument } from "./resolveStatementConflicts";

/**
 * Mission 193 — Production Intake Governance & Permanent Regression
 * Gate.
 *
 * Um único vocabulário SERVIDOR-AUTORITATIVO de desfecho de governança
 * por documento (Seção 6/7 da missão: "There must be ONE
 * server-authoritative outcome... Do not invent parallel
 * classification in the UI") — reaproveita integralmente o vocabulário
 * fechado já produzido por `resolveStatementConflicts()` (D-113,
 * `ExcludedDocumentReasonCode`) e acrescenta apenas os DOIS desfechos
 * que faltavam para cobrir TODO documento do lote, não apenas os
 * excluídos: `"accepted"` (o documento contribuiu para o
 * `FinancialModel` desta análise) e `"needs_review"` (o documento foi
 * aceito, mas o próprio demonstrativo declara números que não fecham
 * aritmeticamente entre si — Seção 24 da missão, nunca confundido com
 * "processado com sucesso" silencioso).
 *
 * Deliberadamente NÃO fechado sobre um enum novo e paralelo — reusa
 * `ExcludedDocumentReasonCode` por união de tipo, nunca redeclara os
 * mesmos quatro valores.
 */
export type DocumentGovernanceOutcome =
  | ExcludedDocument["code"]
  | "accepted"
  | "needs_review";

/**
 * Rótulo humano-seguro para cada desfecho (Seção 14: nunca expor erro
 * interno como "occurredAt e obrigatorio quando kind=event" a um
 * executivo) — linguagem de produto determinística, a MESMA para toda
 * empresa/documento, nunca gerada por IA.
 */
export const DOCUMENT_GOVERNANCE_LABELS: Record<DocumentGovernanceOutcome, string> = {
  accepted: "Considerado na análise",
  needs_review: "Requer revisão",
  invalid_document: "Período não identificado",
  duplicate_content: "Documento duplicado",
  non_current_period: "Período anterior ao atual",
  same_period_conflict: "Conflito não resolvido",
};

export interface DocumentGovernanceResult {
  readonly documentId: string;
  readonly source: string;
  readonly outcome: DocumentGovernanceOutcome;
  /** Explicação em linguagem de produto, nunca um erro técnico interno (Seção 14/15). */
  readonly reason: string;
}

const NEEDS_REVIEW_REASON =
  "O demonstrativo foi considerado na análise, mas seus próprios valores declarados não se reconciliam entre si (ex.: Lucro Líquido declarado diverge da soma dos componentes) — revise o documento de origem.";

const ACCEPTED_REASON = "Documento tecnicamente processado e considerado na verdade financeira desta análise.";

/**
 * Deriva o desfecho de governança de CADA documento do lote — nunca
 * uma segunda classificação divergente da já produzida por
 * `resolveStatementConflicts()`/`prepareFinancialDocuments()` (D-113).
 * Pura — nenhum I/O, nenhuma chamada a Supabase.
 *
 * `acceptedDocuments` é exatamente `PreparedFinancialDocuments.documents`
 * (os sobreviventes finais) — nenhum passo de `prepareFinancialDocuments()`
 * remove/funde `kindHint` entre documentos distintos (Normalizer limpa
 * valor, Resolver confirma evento, Consolidator só remove duplicata
 * EXATA, KnowledgeBuilder/Validator/ContextBuilder nunca alteram
 * classificação) — checar `kindHint === "statement_line"` na coleção
 * final continua um sinal válido do documento de origem. Recebe
 * `"needs_review"` em vez de `"accepted"` quando carrega uma linha de
 * demonstrativo E `statementArithmeticIssues` não está vazio (Seção 24
 * da missão: "should not appear simply processed successfully with no
 * warning") — nunca confundido com exclusão (o documento CONTRIBUIU
 * para o `FinancialModel`, apenas com uma divergência a revisar).
 *
 * `excluded` (já produzido por `resolveStatementConflicts()`) herda
 * `code`/`reason` exatamente como calculados — nenhuma reinterpretação.
 */
export function buildDocumentGovernanceResults(
  acceptedDocuments: readonly RawFinancialDocument[],
  excluded: readonly ExcludedDocument[],
  statementArithmeticIssues: readonly StatementArithmeticIssue[]
): readonly DocumentGovernanceResult[] {
  const hasArithmeticIssues = statementArithmeticIssues.length > 0;

  const acceptedResults: DocumentGovernanceResult[] = acceptedDocuments.map((document) => {
    const isStatementDocument = document.lines.some(
      (line) => line.kindHint === "statement_line"
    );

    if (isStatementDocument && hasArithmeticIssues) {
      return {
        documentId: document.documentId,
        source: document.source,
        outcome: "needs_review",
        reason: NEEDS_REVIEW_REASON,
      };
    }

    return {
      documentId: document.documentId,
      source: document.source,
      outcome: "accepted",
      reason: ACCEPTED_REASON,
    };
  });

  const excludedResults: DocumentGovernanceResult[] = excluded.map((entry) => ({
    documentId: entry.documentId,
    source: entry.source,
    outcome: entry.code,
    reason: entry.reason,
  }));

  return [...acceptedResults, ...excludedResults];
}
