import type { ExecutiveDiagnosis } from "./ExecutiveDiagnosis";

/**
 * Mission 150 — Executive Recommendation → Human Decision
 * Traceability (D-082).
 *
 * **Achado da auditoria obrigatória (Etapa 4)**: `ExecutiveDiagnosis.
 * possibleActions[]`/`priorities[]`/e os demais 6 campos-array já
 * carregam um `id: string` — identidade determinada pelo próprio
 * modelo (`executiveDiagnosisToolSchema.ts`, campo `required`), nunca
 * gerada por este código-base. Combinado com `ExecutiveDiagnosis.id`
 * (injetado pelo adapter, D-062, e persistido, D-066), o par
 * `(diagnosisId, itemId)` já identifica de forma estável e
 * determinística qualquer "Recommendation" da IA em todo o sistema —
 * nenhuma segunda identidade nem `randomUUID()` foi necessária (Etapa
 * 4 proíbe explicitamente inventar uma).
 *
 * **Categorias fechadas**: os 8 campos que carregam itens com `id`
 * dentro de um `ExecutiveDiagnosis` (D-059) — `executiveSummary` fica
 * de fora deliberadamente, pois é um resumo único, sem `id` próprio,
 * nunca uma "Recommendation" individual citável.
 */
export const RECOMMENDATION_REFERENCE_CATEGORIES = [
  "interpretations",
  "hypotheses",
  "risks",
  "priorities",
  "possibleActions",
  "questions",
  "uncertainties",
  "conflictInterpretations",
] as const;
export type RecommendationReferenceCategory = (typeof RECOMMENDATION_REFERENCE_CATEGORIES)[number];

/**
 * Trace explicável de uma referência `Decision.basedOnRecommendationId`
 * — responde exatamente o que a Etapa 6 exige que o sistema consiga
 * reconstruir: qual item da IA (`statement`), de qual categoria
 * (`category`), dentro de qual diagnóstico. `statement` é sempre a
 * frase do item — `question` no caso de `questions[]` (o único dos 8
 * campos sem `statement` próprio), nunca uma string vazia inventada.
 */
export interface RecommendationReferenceTrace {
  readonly recommendationId: string;
  readonly category: RecommendationReferenceCategory;
  readonly statement: string;
}

/**
 * Localiza um `recommendationId` dentro de um `ExecutiveDiagnosis` real
 * — nunca aceita um id inventado como referência válida (mesmo
 * princípio de `traceKnowledgeReference()`, D-081, Mission 149: um id
 * que não pertence à fonte real nunca produz um trace fabricado,
 * `undefined` honesto). Pura, determinística, nenhum acesso a
 * Supabase/banco/relógio, nenhuma IA — o mesmo id sempre produz o
 * mesmo resultado para o mesmo diagnóstico (Etapa 15).
 */
export function traceRecommendationReference(
  diagnosis: ExecutiveDiagnosis,
  recommendationId: string
): RecommendationReferenceTrace | undefined {
  for (const category of RECOMMENDATION_REFERENCE_CATEGORIES) {
    const items = diagnosis[category] as readonly { readonly id: string }[];
    const match = items.find((item) => item.id === recommendationId);
    if (match) {
      const statement =
        "statement" in match
          ? (match as { readonly statement: string }).statement
          : (match as unknown as { readonly question: string }).question;
      return { recommendationId, category, statement };
    }
  }

  return undefined;
}

/**
 * Todos os itens citáveis de um `ExecutiveDiagnosis`, já normalizados
 * para o mesmo formato de `traceRecommendationReference()` — usado
 * pela UI (Mission 150, Etapa 20) para oferecer ao humano a lista real
 * de "Recommendations" que ele pode vincular a uma `Decision`, nunca
 * uma lista inventada. Preserva a ordem de aparição dentro do
 * diagnóstico (categoria por categoria, item por item) — nunca
 * reordenado por relevância/score.
 */
export function listRecommendationReferences(diagnosis: ExecutiveDiagnosis): readonly RecommendationReferenceTrace[] {
  return RECOMMENDATION_REFERENCE_CATEGORIES.flatMap((category) => {
    const items = diagnosis[category] as readonly { readonly id: string }[];
    return items.map((item) => traceRecommendationReference(diagnosis, item.id)).filter((trace): trace is RecommendationReferenceTrace => trace !== undefined);
  });
}
