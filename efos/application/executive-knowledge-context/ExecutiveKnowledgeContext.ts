import type { Knowledge } from "@/efos/domain";
import type { RelevantKnowledgeSelection } from "@/efos/application/knowledge-relevance";
import type { KnowledgeStateResult } from "@/efos/application/knowledge-lifecycle";

/**
 * `"SELECTED" | "NO_RELEVANT_KNOWLEDGE"` — reaproveita diretamente o
 * tipo de `RelevantKnowledgeSelection.outcome` (Mission 142, D-074),
 * nunca um vocabulário paralelo/divergente.
 */
export type KnowledgeSelectionOutcome = RelevantKnowledgeSelection["outcome"];

/**
 * `ExecutiveKnowledgeContext` (Mission 143 — Knowledge Injection into
 * Executive Analysis, D-075). Bloco de "Historical Knowledge",
 * estruturalmente SEPARADO de `FinancialTruth`
 * (`efos/application/executive-context/ExecutiveFinancialContext.ts`,
 * D-058) — nunca `ExecutiveFinancialContext & { knowledge: Knowledge[] }`
 * (atalho explicitamente proibido pela Etapa 1.D da missão).
 *
 * Contém apenas `Knowledge` já selecionado por `selectRelevantKnowledge()`
 * (Mission 142, D-074) — nunca um `Knowledge` bruto/não filtrado.
 * `knowledge: readonly Knowledge[]` preserva o objeto `Knowledge`
 * completo (nunca uma projeção estreita) — `companyId`/`category`/
 * `provenance.source`/`provenance.confidence`/`audit.createdAt` (os
 * campos que a Etapa 3 da missão pede para preservar: fronteira de
 * empresa, categoria, confidence, source, createdAt) já estão todos
 * presentes em `Knowledge` (`efos/domain/entities/Knowledge.ts`, D-073)
 * — nenhuma cópia/DTO estreito é necessária.
 *
 * `selectionOutcome` é sempre a MESMA saída de `selectRelevantKnowledge()`
 * (`KnowledgeSelectionOutcome` = `RelevantKnowledgeSelection["outcome"]`,
 * nunca um vocabulário paralelo) — `"NO_RELEVANT_KNOWLEDGE"` é um
 * resultado honesto e válido, nunca um erro (Etapa 7 da missão: a
 * ausência de `Knowledge` nunca bloqueia a análise executiva).
 *
 * **Nunca contém**: nenhum campo com formato de `Indicator`/`Evidence`
 * (Knowledge é estruturalmente distinto dos dois, impossível de
 * confundir por TIPO, não apenas por convenção — Etapa 10 da missão);
 * nenhum campo de ranking/score (Mission 142, Etapa 5 — "não inventar
 * um sistema de score complexo sem necessidade", preservado aqui).
 *
 * `states: readonly KnowledgeStateResult[]` (Mission 147 — Knowledge-
 * Aware Executive Intelligence, Etapa 3). Extensão puramente ADITIVA —
 * `knowledge`/`selectionOutcome` permanecem byte-a-byte como antes.
 * Reaproveita `KnowledgeStateResult` (`efos/application/knowledge-lifecycle/`,
 * D-078) diretamente, sem projeção/DTO estreito — mesmo precedente de
 * `knowledge: readonly Knowledge[]` acima (o objeto completo já
 * carrega tudo que é necessário). Um item por `Knowledge` em
 * `knowledge` (nunca mais, nunca menos — `states[i].knowledgeId ===
 * knowledge[i].id`), computado exclusivamente por
 * `deriveKnowledgeState()` (D-078) — este módulo nunca recalcula
 * contagem de supporting/contradicting/mixed/weakened/insufficient
 * (Etapa 4 da missão: fonte única de verdade). **Relevance ≠ State,
 * preservado estruturalmente**: um `Knowledge` só aparece em `states`
 * se já sobreviveu à seleção de relevância (está em `knowledge`) — mas
 * seu `state` é sempre computado do zero, independente do motivo pelo
 * qual foi selecionado; um `Knowledge` excluído pela relevância nunca
 * aparece aqui, mesmo que seu estado fosse `SUPPORTED` (a exclusão
 * acontece por critério estrutural, nunca por causa do estado — ver
 * `selectRelevantKnowledge()`, D-074, nunca alterado por esta missão).
 */
export interface ExecutiveKnowledgeContext {
  readonly knowledge: readonly Knowledge[];
  readonly selectionOutcome: KnowledgeSelectionOutcome;
  readonly states: readonly KnowledgeStateResult[];
}
