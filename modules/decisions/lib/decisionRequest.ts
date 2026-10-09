import type { ScenarioDecisionRequest } from "@/modules/scenarios/lib/composeScenarioDecision";
import type { DecisionType, RecommendationConfidence, RecommendationPriority } from "@/efos/domain";

/**
 * Mission 214 — Governed Decision Idempotency (D-137).
 *
 * O PEDIDO CANÔNICO de uma confirmação de decisão: exatamente os dados que
 * o servidor usa para compor a `Decision`, numa serialização determinística.
 * É a base da impressão gravada com a chave de submissão
 * (`decisionRequestFingerprint.ts`, só no servidor) e da assinatura que o
 * formulário usa para saber se a intenção mudou (`useDecisionIdempotencyKey`).
 * Puro e sem `node:crypto`: roda no servidor e no navegador.
 *
 * O que entra (e nada mais):
 * - decisão humana (`createHumanDecisionAction`): tipo, prioridade,
 *   confiança, título, descrição, justificativa, diagnóstico, revisão,
 *   recomendação e as listas de referências — com os mesmos padrões de
 *   `createHumanDecision()` (id ausente = `null`, lista ausente = `[]`);
 * - decisão de cenário (`createScenarioDecisionAction`, Scenario Lab e
 *   Executive Chat): a âncora reivindicada (`evaluatedBaselineIdentity`), a
 *   hipótese (`request`), a alternativa, `proposedBy` e os mesmos campos
 *   humanos.
 *
 * O que nunca entra: id da Decision, instantes, a própria chave, números
 * recomputados pelo servidor (projeção, impressão do Financial Model atual).
 * Empresa, ator e entrypoint entram no envelope da impressão, não aqui.
 *
 * Sem hipernormalização: o texto humano entra exatamente como chega (os
 * formulários já enviam título/descrição/justificativa sem espaços nas
 * pontas — a mesma forma que a Decision grava). Duas justificativas
 * diferentes nunca viram o mesmo pedido.
 */

export class NonCanonicalValueError extends Error {
  constructor(readonly path: string) {
    super(`Valor fora do JSON canônico em ${path}.`);
    this.name = "NonCanonicalValueError";
  }
}

/**
 * JSON determinístico: objetos com chaves em ordem (recursivo), arrays na
 * ordem recebida, propriedades `undefined` omitidas (como no JSON). Aceita só
 * `null`, texto, booleano, número finito, array denso e objeto simples —
 * qualquer outra coisa (Date, Map, função, número não finito, array com
 * buraco) lança `NonCanonicalValueError`; quem chama decide recusar.
 */
export function canonicalJson(value: unknown): string {
  return serialize(value, "$");
}

function serialize(value: unknown, path: string): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new NonCanonicalValueError(path);
      return JSON.stringify(value);
    case "object":
      break;
    default:
      throw new NonCanonicalValueError(path);
  }

  if (Array.isArray(value)) {
    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value) || value[index] === undefined) throw new NonCanonicalValueError(`${path}[${index}]`);
      items.push(serialize(value[index], `${path}[${index}]`));
    }
    return `[${items.join(",")}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new NonCanonicalValueError(path);
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(record[key], `${path}.${key}`)}`).join(",")}}`;
}

interface HumanDecisionFields {
  readonly type: DecisionType;
  readonly priority: RecommendationPriority;
  readonly confidence: RecommendationConfidence;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
}

export interface HumanDecisionRequestFields extends HumanDecisionFields {
  readonly diagnosisId?: string;
  readonly reviewId?: string;
  readonly recommendationId?: string;
  readonly recommendations?: readonly string[];
  readonly reasonings?: readonly string[];
  readonly contexts?: readonly string[];
  readonly evidences?: readonly string[];
}

/** Pedido canônico de `createHumanDecisionAction()` — Recomendação e Manual. */
export function humanDecisionRequestPayload(input: HumanDecisionRequestFields) {
  return {
    type: input.type,
    priority: input.priority,
    confidence: input.confidence,
    title: input.title,
    description: input.description,
    rationale: input.rationale,
    diagnosisId: input.diagnosisId ?? null,
    reviewId: input.reviewId ?? null,
    recommendationId: input.recommendationId ?? null,
    recommendations: input.recommendations ?? [],
    reasonings: input.reasonings ?? [],
    contexts: input.contexts ?? [],
    evidences: input.evidences ?? [],
  };
}

export type ScenarioDecisionRequestFields = Omit<ScenarioDecisionRequest, "companyId">;

/** Pedido canônico de `createScenarioDecisionAction()` — Scenario Lab e Executive Chat. */
export function scenarioDecisionRequestPayload(input: ScenarioDecisionRequestFields) {
  return {
    evaluatedBaselineIdentity: input.evaluatedBaselineIdentity,
    request: input.request,
    alternative: input.alternative ?? null,
    proposedBy: input.proposedBy ?? null,
    type: input.type,
    priority: input.priority,
    confidence: input.confidence,
    title: input.title,
    description: input.description,
    rationale: input.rationale,
  };
}

/**
 * Assinatura da intenção no formulário: muda exatamente quando o pedido
 * canônico (ou a empresa) muda. Só decide quando o formulário renova a chave
 * — nunca é autoridade; o servidor sempre recalcula e compara a impressão.
 */
export function decisionIntentSignature(companyId: string, payload: unknown): string {
  return canonicalJson({ companyId, payload });
}
