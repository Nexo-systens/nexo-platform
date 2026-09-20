import type { Knowledge } from "@/efos/domain";
import type { KnowledgeStateResult, TimestampedKnowledgeEvaluation } from "./KnowledgeState";

/**
 * Mission 146 — Knowledge Lifecycle & Historical Intelligence Maturity.
 *
 * Motor puro de derivação de estado de ciclo de vida de um `Knowledge`
 * a partir do seu histórico IMUTÁVEL de `TimestampedKnowledgeEvaluation`
 * (D-077, Mission 145). Nunca muta `knowledge`. Nunca lê o relógio do
 * sistema (recebe `asOf?` como parâmetro, não lê `Date.now()`). Nunca
 * chama IA. Nunca atribui score arbitrário — o estado é inteiramente
 * determinado por contagens de eventos de avaliação.
 *
 * Escopo: avaliações cujo `knowledgeId` não corresponde a
 * `knowledge.id`, ou cujo `companyId` (via `knowledge.companyId`) não
 * é o mesmo, são REJEITADAS silenciosamente do cômputo — esta função é
 * estritamente escopada a UM Knowledge (cenários de teste L/K:
 * "Knowledge mismatch"/"company mismatch"). Como `TimestampedKnowledgeEvaluation`
 * não carrega `companyId` diretamente (é um campo do `Knowledge`, não
 * da avaliação — a avaliação já foi persistida sob o boundary correto
 * de company via RLS, Mission 145), a única checagem estrutural
 * possível e correta aqui é por `knowledgeId`.
 *
 * Temporalidade: quando `asOf` é informado, avaliações com
 * `evaluatedAt > asOf` são excluídas do cômputo — mesmo princípio
 * temporal usado em Missions 141/142/145 (nenhum evento após o corte
 * pode participar). Não existe um utilitário genérico de filtro
 * temporal compartilhado no código-base (cada missão reimplementa o
 * mesmo filtro de uma linha contra o campo relevante do seu próprio
 * tipo) — este é o mesmo padrão aplicado ao novo campo `evaluatedAt`,
 * não uma duplicação de implementação.
 */
export function deriveKnowledgeState(
  knowledge: Knowledge,
  evaluations: readonly TimestampedKnowledgeEvaluation[],
  asOf?: string
): KnowledgeStateResult {
  const scoped = evaluations.filter((evaluation) => evaluation.knowledgeId === knowledge.id);

  const considered = asOf === undefined ? scoped : scoped.filter((evaluation) => evaluation.evaluatedAt <= asOf);

  const supportingEvaluationIds: string[] = [];
  const contradictingEvaluationIds: string[] = [];
  const insufficientEvaluationIds: string[] = [];
  let latestEvaluationAt: string | undefined;

  for (const evaluation of considered) {
    if (evaluation.outcome === "REINFORCED" || evaluation.outcome === "MIXED") {
      supportingEvaluationIds.push(evaluation.id);
    }
    if (evaluation.outcome === "CONTRADICTED" || evaluation.outcome === "MIXED") {
      contradictingEvaluationIds.push(evaluation.id);
    }
    if (evaluation.outcome === "INSUFFICIENT_EVIDENCE") {
      insufficientEvaluationIds.push(evaluation.id);
    }
    if (latestEvaluationAt === undefined || evaluation.evaluatedAt > latestEvaluationAt) {
      latestEvaluationAt = evaluation.evaluatedAt;
    }
  }

  const evaluationCount = considered.length;
  const supportingCount = supportingEvaluationIds.length;
  const contradictingCount = contradictingEvaluationIds.length;
  const insufficientCount = insufficientEvaluationIds.length;

  const state =
    evaluationCount === 0
      ? "EMERGING"
      : supportingCount === 0 && contradictingCount === 0
        ? "INSUFFICIENT"
        : supportingCount > 0 && contradictingCount === 0
          ? "SUPPORTED"
          : supportingCount === 0 && contradictingCount > 0
            ? "WEAKENED"
            : "MIXED";

  const rationale = buildRationale(state, evaluationCount, supportingCount, contradictingCount, insufficientCount);

  return {
    knowledgeId: knowledge.id,
    state,
    evaluationCount,
    supportingCount,
    contradictingCount,
    insufficientCount,
    latestEvaluationAt,
    supportingEvaluationIds,
    contradictingEvaluationIds,
    insufficientEvaluationIds,
    rationale,
  };
}

function buildRationale(
  state: KnowledgeStateResult["state"],
  evaluationCount: number,
  supportingCount: number,
  contradictingCount: number,
  insufficientCount: number
): string {
  switch (state) {
    case "EMERGING":
      return "Este conhecimento ainda não foi avaliado contra nenhum registro de aprendizado.";
    case "INSUFFICIENT":
      return `Este conhecimento foi avaliado ${evaluationCount} vez(es), mas nenhuma avaliação encontrou evidência de reforço ou contradição (${insufficientCount} avaliação(ões) inconclusiva(s)).`;
    case "SUPPORTED":
      return `Este conhecimento foi reforçado por ${supportingCount} de ${evaluationCount} avaliação(ões), sem nenhuma contradição registrada.`;
    case "WEAKENED":
      return `Este conhecimento foi contradito por ${contradictingCount} de ${evaluationCount} avaliação(ões), sem nenhum reforço registrado.`;
    case "MIXED":
      return `Este conhecimento apresenta histórico misto: ${supportingCount} avaliação(ões) reforçando e ${contradictingCount} avaliação(ões) contradizendo, de ${evaluationCount} no total.`;
  }
}
