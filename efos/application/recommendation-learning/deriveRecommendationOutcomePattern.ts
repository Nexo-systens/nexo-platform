import type {
  RecommendationOutcomeDecisionInput,
  RecommendationOutcomePatternResult,
  RecommendationOutcomeRejection,
} from "./RecommendationOutcomePattern";

const FAVORABLE_CLASSIFICATIONS = new Set(["EVIDENCE_FAVORABLE"]);
const UNFAVORABLE_CLASSIFICATIONS = new Set(["EVIDENCE_CONTRARY"]);
const INSUFFICIENT_CLASSIFICATIONS = new Set(["INCONCLUSIVE", "TEMPORAL_ASSOCIATION"]);

/**
 * Mission 151 — Recommendation Outcome Learning & Cross-Decision
 * Pattern Engine (D-083).
 *
 * Agrega evidência histórica real (`LearningRecord.evidenceClassification`,
 * D-072, já produzida por `deriveEvidenceClassification()`/
 * `buildLearningRecord()`, Mission 140 — NUNCA recalculada aqui) sobre
 * todas as `Decision`s de UMA empresa que compartilham o mesmo
 * `fingerprint` (`deriveRecommendationFingerprint()`, calculado pelo
 * chamador antes de agrupar as `Decision`s por fingerprint — esta
 * função nunca calcula fingerprint, apenas consome um já dado).
 *
 * **Fonte única de verdade (Etapa 6/12)**: nunca reinterpreta
 * `Outcome.status`/`FinancialOutcomeObservation.metrics[].direction`
 * diretamente — só lê `evidenceClassification`, já sintetizado por
 * `deriveEvidenceClassification()` a partir do julgamento humano
 * (`Outcome`, D-011) mais a força opcional de dado financeiro real
 * (`FinancialOutcomeObservation`, D-071). Isso evita uma segunda
 * implementação divergente de "o que conta como evidência favorável" —
 * mesmo princípio de `deriveKnowledgeState()` (D-078) nunca
 * recalcular `KnowledgeEvaluationResult`.
 *
 * **Company boundary (Etapa 8, estrutural, nunca apenas confiada ao
 * chamador)**: toda `Decision` cujo `companyId` diverge do `companyId`
 * do parâmetro é explicitamente rejeitada (`COMPANY_MISMATCH`),
 * rastreável até o `decisionId` real — mesmo padrão de
 * `evaluateKnowledgeAgainstLearning()` (D-077). O `fingerprint` em si é
 * deliberadamente company-agnostic (`deriveRecommendationFingerprint()`)
 * — é este parâmetro `companyId` explícito, e só ele, que impede
 * cross-company learning nesta missão.
 *
 * **Temporalidade (Etapa 7)**: `asOf?` exclui `Decision`s com
 * `decisionCreatedAt > asOf`, e — independentemente disso —
 * `LearningRecord`s com `createdAt > asOf` dentro de uma `Decision`
 * ainda considerada (uma `Decision` antiga pode ganhar um
 * `LearningRecord` novo depois de `asOf`, que nunca deve contaminar
 * uma reconstrução histórica). Comparação sempre via `Date.parse()`,
 * nunca `localeCompare()` sobre a string ISO (lição corrigida na
 * Mission 138 — comparação lexicográfica de string não é comparação
 * temporal correta para todos os formatos ISO 8601 válidos).
 *
 * **Determinismo/idempotência (Etapa 16/17)**: nenhuma leitura de
 * relógio, nenhum `Math.random()`, nenhuma dependência de ordem de
 * entrada — `Decision`s duplicadas (mesmo `decisionId` presente mais
 * de uma vez) são deduplicadas antes de contar, para que a mesma
 * evidência nunca seja contada duas vezes por acidente de composição
 * upstream.
 *
 * Pura — nenhum acesso a Supabase/banco, nenhuma IA, nenhum
 * embedding/scoring/similaridade semântica.
 */
export function deriveRecommendationOutcomePattern(
  companyId: string,
  fingerprint: string,
  decisions: readonly RecommendationOutcomeDecisionInput[],
  asOf?: string
): RecommendationOutcomePatternResult {
  const rejected: RecommendationOutcomeRejection[] = [];
  const seenDecisionIds = new Set<string>();
  const considered: RecommendationOutcomeDecisionInput[] = [];

  for (const decision of decisions) {
    if (seenDecisionIds.has(decision.decisionId)) continue;
    seenDecisionIds.add(decision.decisionId);

    if (decision.companyId !== companyId) {
      rejected.push({
        code: "COMPANY_MISMATCH",
        decisionId: decision.decisionId,
        message: `Decision "${decision.decisionId}" pertence à empresa "${decision.companyId}", diferente da empresa avaliada ("${companyId}") — nunca misturada ao padrão histórico.`,
      });
      continue;
    }

    if (asOf !== undefined && Date.parse(decision.decisionCreatedAt) > Date.parse(asOf)) {
      continue;
    }

    considered.push(decision);
  }

  const supportingDecisionIds: string[] = [];
  const contradictingDecisionIds: string[] = [];
  let learningRecordCount = 0;
  let favorableCount = 0;
  let unfavorableCount = 0;
  let insufficientCount = 0;
  let latestDecisionAt: string | undefined;

  for (const decision of considered) {
    if (latestDecisionAt === undefined || Date.parse(decision.decisionCreatedAt) > Date.parse(latestDecisionAt)) {
      latestDecisionAt = decision.decisionCreatedAt;
    }

    let decisionIsFavorable = false;
    let decisionIsUnfavorable = false;

    for (const record of decision.learningRecords) {
      if (asOf !== undefined && Date.parse(record.createdAt) > Date.parse(asOf)) continue;
      if (!record.evidenceClassification) continue;

      learningRecordCount += 1;

      if (FAVORABLE_CLASSIFICATIONS.has(record.evidenceClassification)) {
        favorableCount += 1;
        decisionIsFavorable = true;
      } else if (UNFAVORABLE_CLASSIFICATIONS.has(record.evidenceClassification)) {
        unfavorableCount += 1;
        decisionIsUnfavorable = true;
      } else if (INSUFFICIENT_CLASSIFICATIONS.has(record.evidenceClassification)) {
        insufficientCount += 1;
      }
    }

    if (decisionIsFavorable) supportingDecisionIds.push(decision.decisionId);
    if (decisionIsUnfavorable) contradictingDecisionIds.push(decision.decisionId);
  }

  const decisionCount = considered.length;

  const state =
    decisionCount === 0
      ? "EMERGING"
      : favorableCount === 0 && unfavorableCount === 0
        ? "INSUFFICIENT"
        : favorableCount > 0 && unfavorableCount === 0
          ? "FAVORABLE"
          : favorableCount === 0 && unfavorableCount > 0
            ? "UNFAVORABLE"
            : "MIXED";

  return {
    fingerprint,
    companyId,
    state,
    decisionCount,
    learningRecordCount,
    favorableCount,
    unfavorableCount,
    insufficientCount,
    latestDecisionAt,
    supportingDecisionIds,
    contradictingDecisionIds,
    rejected,
    rationale: buildRationale(state, decisionCount, favorableCount, unfavorableCount, insufficientCount),
  };
}

function buildRationale(
  state: RecommendationOutcomePatternResult["state"],
  decisionCount: number,
  favorableCount: number,
  unfavorableCount: number,
  insufficientCount: number
): string {
  switch (state) {
    case "EMERGING":
      return "Nenhuma Decision com esta estrutura de Recommendation foi observada ainda — sem histórico para reportar.";
    case "INSUFFICIENT":
      return `${decisionCount} Decision(s) estruturalmente semelhante(s) observada(s), mas nenhuma evidência favorável ou contrária foi produzida ainda (${insufficientCount} registro(s) inconclusivo(s)/associação temporal) — histórico presente, sinal ainda insuficiente.`;
    case "FAVORABLE":
      return `Padrão histórico favorável: ${favorableCount} de ${decisionCount} Decision(s) estruturalmente semelhante(s) produziram evidência favorável, nenhuma contrária — associação observada, nunca prova de causalidade.`;
    case "UNFAVORABLE":
      return `Padrão histórico desfavorável: ${unfavorableCount} de ${decisionCount} Decision(s) estruturalmente semelhante(s) produziram evidência contrária, nenhuma favorável — associação observada, nunca prova de causalidade.`;
    case "MIXED":
      return `Padrão histórico misto: ${favorableCount} Decision(s) com evidência favorável e ${unfavorableCount} com evidência contrária, de ${decisionCount} no total — histórico genuinamente dividido, nunca resolvido por maioria.`;
  }
}
