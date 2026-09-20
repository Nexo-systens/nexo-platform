import {
  DECISION_TYPES,
  RECOMMENDATION_CONFIDENCE_LEVELS,
  RECOMMENDATION_PRIORITIES,
  type Decision,
} from "@/efos/domain";
import type { Result } from "@/efos/application/shared";

import type { CreateHumanDecisionCommand } from "./CreateHumanDecisionCommand";

export interface CreateHumanDecisionError {
  readonly code: "INVALID_COMMAND";
  readonly errors: readonly string[];
}

function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Valida um `CreateHumanDecisionCommand` (Etapa 7, "1. validar
 * entradas") — nunca valida o conteúdo de um `ExecutiveDiagnosis`/
 * `DiagnosisReview` real (o comando só carrega ids, nunca os objetos),
 * apenas a forma mínima do comando em si. Função pura.
 */
function validateCommand(command: CreateHumanDecisionCommand): readonly string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(command.humanActorId)) {
    errors.push("humanActorId é obrigatório — nenhuma Decision humana pode ser criada sem um ator humano explícito (Etapa 5).");
  }
  if (!isNonEmptyString(command.companyId)) {
    errors.push("companyId é obrigatório.");
  }
  if (!DECISION_TYPES.includes(command.type)) {
    errors.push(`type inválido: "${command.type}".`);
  }
  if (!RECOMMENDATION_PRIORITIES.includes(command.priority)) {
    errors.push(`priority inválida: "${command.priority}".`);
  }
  if (!RECOMMENDATION_CONFIDENCE_LEVELS.includes(command.confidence)) {
    errors.push(`confidence inválida: "${command.confidence}".`);
  }
  if (!isNonEmptyString(command.title)) {
    errors.push("title é obrigatório.");
  }
  if (!isNonEmptyString(command.description)) {
    errors.push("description é obrigatório.");
  }
  if (!isNonEmptyString(command.rationale)) {
    errors.push("rationale é obrigatório — a justificativa da decisão humana nunca pode ficar vazia.");
  }

  return errors;
}

/**
 * `createHumanDecision()` (Mission 124 — Human Decision Lifecycle
 * Composition). Único ponto de composição autorizado a transformar um
 * ato humano explícito (`CreateHumanDecisionCommand`) numa `Decision`
 * real (D-063) — nunca a partir de um `ExecutiveDiagnosis` ou
 * `DiagnosisReview` sozinhos (Etapa 5/8: nenhum dos dois, isolado,
 * basta).
 *
 * **Nunca**: chama `efos/engines/decision/` (nenhum import de
 * `decision.builder`/`decision.engine`/`decision.mapper` — o Decision
 * Engine determinístico permanece inteiramente intocado, mesmo
 * caminho de sempre, D-011); calcula indicador; interpreta dado;
 * chama IA/provider; executa a decisão; cria `Outcome`; persiste
 * qualquer coisa. `id`/`createdAt` são sempre recebidos como
 * parâmetro, nunca gerados internamente (mesmo precedente de
 * `buildExecutiveAIInstruction(context, instructionId)`,
 * `buildAuditTrail(timestamp)` em todo mapper de Engine) — função
 * pura e determinística dado o mesmo input.
 *
 * Devolve `Result<Decision, CreateHumanDecisionError>` — nunca lança
 * exceção, mesmo padrão de `executeExecutiveAnalysis()` (D-060).
 */
export function createHumanDecision(
  command: CreateHumanDecisionCommand,
  id: string,
  createdAt: string
): Result<Decision, CreateHumanDecisionError> {
  const errors = validateCommand(command);
  if (errors.length > 0) {
    return { success: false, error: { code: "INVALID_COMMAND", errors } };
  }

  const decision: Decision = {
    id,
    companyId: command.companyId,
    type: command.type,
    priority: command.priority,
    confidence: command.confidence,
    title: command.title,
    description: command.description,
    rationale: command.rationale,
    recommendations: command.recommendations ?? [],
    reasonings: command.reasonings ?? [],
    contexts: command.contexts ?? [],
    evidences: command.evidences ?? [],
    // Mission 184 — Scenario-to-Decision Governance Bridge. Nunca um
    // campo novo em `Decision` (ver `ScenarioDecisionContext.ts`) — o
    // contexto de cenário, quando presente, é mesclado dentro de
    // `supportingData` sob a chave `scenarioContext`, preservando
    // qualquer outro dado que o chamador já tenha fornecido.
    supportingData: command.scenarioContext
      ? { ...(command.supportingData ?? {}), scenarioContext: command.scenarioContext }
      : (command.supportingData ?? {}),
    basedOnDiagnosisId: command.diagnosisId,
    basedOnReviewId: command.reviewId,
    basedOnRecommendationId: command.recommendationId,
    humanActorId: command.humanActorId,
    provenance: { source: "human-decision", confidence: { value: 100, level: "very_high" } },
    audit: { createdAt, updatedAt: createdAt, version: 1 },
  };

  return { success: true, value: decision };
}
