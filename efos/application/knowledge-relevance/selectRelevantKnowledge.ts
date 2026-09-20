import type { Knowledge } from "@/efos/domain";

import { validateKnowledge } from "@/efos/application/knowledge-formation";

import type {
  KnowledgeRelevanceReason,
  RelevanceContext,
  RelevantKnowledgeSelection,
} from "./RelevantKnowledgeSelection";

/**
 * `selectRelevantKnowledge()` (Mission 142 — Knowledge Relevance &
 * Executive Context Integration). Único mecanismo autorizado a
 * decidir qual `Knowledge` já persistido é relevante para um contexto
 * executivo atual — determinístico, estrutural, auditável.
 *
 * **Nunca usa IA/LLM, embeddings ou similaridade semântica** (Etapa 2
 * da missão — proibido explicitamente). 3 critérios estruturais,
 * avaliados em ordem fixa por `Knowledge`, o primeiro que falhar
 * decide a exclusão (nunca mais de 1 motivo por exclusão — mais
 * simples de auditar que uma lista de motivos concorrentes):
 *
 * 1. **Fronteira de empresa** (Etapa 4) — `knowledge.companyId !==
 *    context.companyId` → `COMPANY_MISMATCH`. Nenhuma inteligência
 *    cross-company nesta missão.
 * 2. **Temporalidade** (Etapa 6) — quando `context.asOf` está
 *    presente, `knowledge.audit.createdAt > context.asOf` →
 *    `FUTURE_KNOWLEDGE`. Sem `context.asOf`, nenhum corte temporal é
 *    aplicado (mesmo princípio de `asOf?` em
 *    `buildKnowledgeFromLearningRecords()`, Mission 141).
 * 3. **Validade estrutural** (Etapa 2.E) — `validateKnowledge()`
 *    (Mission 141, reaproveitado diretamente, nunca uma segunda
 *    validação divergente) rejeita → `STRUCTURALLY_INVALID`.
 *
 * Todo `Knowledge` que sobrevive aos 3 critérios é incluído — nenhum
 * ranking/score (Etapa 5: "não inventar um sistema de score complexo
 * sem necessidade"). A ORDEM relativa da entrada é sempre preservada
 * em `selected`/`included`/`excluded` (filtro estável, nunca um
 * `sort()`) — a mesma ENTRADA sempre produz a mesma SAÍDA (testado),
 * e reordenar a entrada nunca muda o CONJUNTO selecionado (testado).
 *
 * **Pura** — nunca acessa Supabase/`createClient`, nunca chama IA,
 * nunca lê o relógio do sistema (`context.asOf` é sempre parâmetro).
 * **Nunca altera Financial Truth** — não recebe, não lê, não
 * referencia `ExecutiveFinancialContext`/`Indicator` em nenhum lugar
 * deste módulo (ver `RelevantKnowledgeSelection.ts` para a auditoria
 * completa de por que este módulo é deliberadamente desacoplado
 * daquele tipo).
 */
export function selectRelevantKnowledge(
  knowledgeRecords: readonly Knowledge[],
  context: RelevanceContext
): RelevantKnowledgeSelection {
  const selected: Knowledge[] = [];
  const included: KnowledgeRelevanceReason[] = [];
  const excluded: KnowledgeRelevanceReason[] = [];

  for (const knowledge of knowledgeRecords) {
    if (knowledge.companyId !== context.companyId) {
      excluded.push({
        knowledgeId: knowledge.id,
        code: "COMPANY_MISMATCH",
        message: `Knowledge pertence à empresa "${knowledge.companyId}", diferente da empresa do contexto atual ("${context.companyId}") — fronteira de empresa nunca cruzada.`,
      });
      continue;
    }

    if (context.asOf !== undefined && knowledge.audit.createdAt > context.asOf) {
      excluded.push({
        knowledgeId: knowledge.id,
        code: "FUTURE_KNOWLEDGE",
        message: `Knowledge formado em ${knowledge.audit.createdAt}, depois do instante que esta análise representa (${context.asOf}) — nunca contamina uma análise histórica anterior.`,
      });
      continue;
    }

    const validation = validateKnowledge(knowledge);
    if (!validation.valid) {
      excluded.push({
        knowledgeId: knowledge.id,
        code: "STRUCTURALLY_INVALID",
        message: `Knowledge estruturalmente inválido: ${validation.errors.join("; ")}.`,
      });
      continue;
    }

    selected.push(knowledge);
    included.push({
      knowledgeId: knowledge.id,
      code: "COMPANY_MATCH_AND_TEMPORALLY_VALID",
      message: `Knowledge pertence à mesma empresa e é estruturalmente válido${context.asOf !== undefined ? " e anterior ao instante da análise" : ""} — incluído.`,
    });
  }

  return {
    outcome: selected.length > 0 ? "SELECTED" : "NO_RELEVANT_KNOWLEDGE",
    selected,
    included,
    excluded,
  };
}
