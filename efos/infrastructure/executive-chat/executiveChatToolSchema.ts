import { EXECUTIVE_CHAT_ACTION_TYPES } from "@/efos/application/executive-chat";

/**
 * Definição mínima de "JSON Schema tool" aceita pela Anthropic API —
 * mesma forma local de `executiveDiagnosisToolSchema.ts` (Mission 132),
 * nunca dependendo de um tipo interno do SDK que pode mudar entre
 * versões.
 */
interface JsonSchema {
  readonly type: string;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly items?: JsonSchema;
  readonly enum?: readonly string[];
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

/**
 * Mesmo formato de transporte compacto de `basis` da Mission 135
 * (D-068) — um array de strings prefixadas por categoria
 * (`"indicator:<id>"`/etc.), decodificado de volta para
 * `InterpretationBasis` por `decodeBasisReferences()`
 * (`@/efos/infrastructure/executive-ai`, reaproveitado sem cópia, ver
 * `decodeModelChatAnswerBasisFields()` neste diretório). O schema de
 * Chat é muito menor que o de Diagnosis (4 arrays de itens simples
 * contra 6+`basis` de 5 campos) — bem abaixo do limite de "compiled
 * grammar" que forçou a divisão em 2 stages para Diagnosis (Mission
 * 136); uma única chamada `strict` é suficiente aqui (REGRA 15 —
 * simplicidade proporcional à necessidade real).
 */
const BASIS_REFERENCES_SCHEMA: JsonSchema = {
  type: "array",
  items: { type: "string" },
};

/**
 * Mission 190 — Conversational Scenario Comparison. Uma alternativa de
 * cenário, sempre um objeto PEQUENO e FLAT (4 campos simples, nenhum
 * aninhamento adicional) — reaproveitado 2x (`alternativeA`/
 * `alternativeB`) dentro do MESMO item de `proposedActions`, nunca uma
 * `oneOf`/união discriminada no JSON Schema (mesma disciplina de
 * `basis`/D-068: achatar em vez de aninhar, para nunca reabrir o risco
 * de "compiled grammar too large" das Missions 134-136). `kind` é o
 * discriminante de `ScenarioAssumption` (D-092) — nunca confundido com
 * o `type` de `ExecutiveChatActionType` no nível acima.
 */
const SCENARIO_ALTERNATIVE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["operating_cost_change", "collection_period_change"] },
    direction: { type: "string", enum: ["increase", "decrease", "longer", "shorter"] },
    amount: { type: "number" },
    deltaDays: { type: "number" },
  },
  required: ["kind", "direction"],
  additionalProperties: false,
};

export const SUBMIT_EXECUTIVE_CHAT_ANSWER_TOOL_NAME = "submit_executive_chat_answer";

export const EXECUTIVE_CHAT_ANSWER_TOOL_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    answer: { type: "string" },
    groundingStatus: { type: "string", enum: ["GROUNDED", "PARTIAL", "UNSUPPORTED"] },
    requiresScenarioSimulation: { type: "boolean" },
    factualClaims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          statement: { type: "string" },
          basis: BASIS_REFERENCES_SCHEMA,
        },
        required: ["id", "statement", "basis"],
        additionalProperties: false,
      },
    },
    analysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          statement: { type: "string" },
          basis: BASIS_REFERENCES_SCHEMA,
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["id", "statement", "basis", "confidence"],
        additionalProperties: false,
      },
    },
    hypotheses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          statement: { type: "string" },
          basis: BASIS_REFERENCES_SCHEMA,
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          validationNeeded: { type: "string" },
        },
        required: ["id", "statement", "basis", "confidence", "validationNeeded"],
        additionalProperties: false,
      },
    },
    limitations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          statement: { type: "string" },
          reason: { type: "string" },
        },
        required: ["id", "statement", "reason"],
        additionalProperties: false,
      },
    },
    /**
     * Mission 189 — Governed Executive Chat Actions. Forma PLANA
     * deliberada (mesma estratégia de `basis`, D-068) — `direction`/
     * `amount`/`deltaDays` ficam fora de `required` (mesmo precedente
     * de `relatedId` em `ExecutiveQuestion`, Mission 118: propriedades
     * opcionais já são suportadas por `strict: true` neste repositório)
     * porque só fazem sentido para os 2 `type`s de cenário — nunca uma
     * união discriminada (`oneOf`) aqui, para não reabrir o risco de
     * "compiled grammar too large" (Mission 134/135/136). A validação
     * de QUAL combinação de campos é exigida por QUAL `type` acontece
     * inteiramente do lado confiável (`resolveExecutiveChatActionProposal()`,
     * `efos/application/executive-chat/`), nunca aqui.
     */
    proposedActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...EXECUTIVE_CHAT_ACTION_TYPES] },
          reason: { type: "string" },
          direction: { type: "string", enum: ["increase", "decrease", "longer", "shorter"] },
          amount: { type: "number" },
          deltaDays: { type: "number" },
          // Mission 190 — presentes apenas quando type === "PREPARE_SCENARIO_COMPARISON".
          alternativeA: SCENARIO_ALTERNATIVE_SCHEMA,
          alternativeB: SCENARIO_ALTERNATIVE_SCHEMA,
        },
        required: ["type", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "answer",
    "groundingStatus",
    "requiresScenarioSimulation",
    "factualClaims",
    "analysis",
    "hypotheses",
    "limitations",
    "proposedActions",
  ],
  additionalProperties: false,
};

export interface ExecutiveChatToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: JsonSchema;
  /** Mission 132 — `strict: true` obrigatório, ver `executiveDiagnosisToolSchema.ts` para o achado forense completo. */
  readonly strict?: boolean;
}

const BASIS_DESCRIPTION_NOTE =
  "Every `basis` field is an array of strings, each referencing one real element that supports the statement. Each entry MUST be prefixed with its category, using exactly one of these forms: \"indicator:<id>\", \"evidence:<id>\", \"context:<id>\", \"conflict:<id>\" (from \"context\" — Financial Truth), or \"knowledge:<id>\" (from \"knowledgeContext.knowledge\" — Historical Knowledge, when present) — using only ids that actually appear in the provided data, never an invented id. An entry with an unrecognized prefix or no prefix will be discarded, so always include the prefix. `limitations` items never carry a `basis` — a limitation describes what you cannot conclude, so it has no supporting element by definition.";

/**
 * Mission 189 — descreve o catálogo de ações NO NÍVEL DE CAPACIDADE
 * (Seção 35 — "Describe actions at capability level"), nunca expondo
 * nome de função/rota/Server Action/schema de banco. `OPEN_KNOWLEDGE`
 * é descrito como "organizational knowledge already reviewed", nunca
 * mencionando `humanStatement`/`LearningRecord` (que o modelo nunca vê
 * de qualquer forma, D-100).
 */
const ACTION_CATALOG_NOTE =
  'You may optionally propose up to 3 actions in `proposedActions` — always the same fixed catalog, described here by capability, never by internal name: "OPEN_SCENARIO_LAB" (open the scenario simulation surface — use when the executive might want to explore hypothetical changes but has not specified one yet), "OPEN_DECISION_CENTER" (open the surface listing decisions needing attention or already made), "OPEN_KNOWLEDGE" (open the surface showing this company\'s own reviewed organizational knowledge), "PREPARE_OPERATING_COST_SCENARIO" (propose a ready-to-confirm operating-cost change simulation — requires `direction`: "increase" or "decrease", and `amount`: a positive number in BRL), "PREPARE_COLLECTION_PERIOD_SCENARIO" (propose a ready-to-confirm collection-period change simulation — requires `direction`: "longer" or "shorter", and `deltaDays`: a positive number of days), "PREPARE_SCENARIO_COMPARISON" (propose a ready-to-confirm comparison between exactly two scenario alternatives — requires `alternativeA` and `alternativeB`, each an object with `kind` ("operating_cost_change" or "collection_period_change"), `direction`, and `amount`/`deltaDays` matching that kind\'s own rules; both alternatives may use the same kind). Every action is only ever a PROPOSAL — it is never executed automatically, is always validated again before use, and always requires the executive to explicitly click to confirm it; you have no authority to execute anything yourself, and you must never calculate, project, or state a financial RESULT for a scenario/comparison before it has actually been confirmed and run — describe only what the action WOULD do (e.g. "reduzir despesas operacionais em X"), never its effect on any metric. When proposing a comparison, never state or imply which alternative is better, recommended, or the "winner" — a comparison only ever shows trade-offs, decided by the executive, never by you. Never propose an action for a capability that does not exist (e.g. payroll, hiring, debt restructuring, CAPEX) — if the executive asks for something unsupported (including a comparison where one or both sides are unsupported), explain the limitation in `answer`/`limitations` instead and propose no action, or at most a relevant navigation action; never propose a comparison where only one side is genuinely resolvable. `reason` must explain why the action is relevant to this specific answer.';

export const EXECUTIVE_CHAT_ANSWER_TOOL: ExecutiveChatToolDefinition = {
  name: SUBMIT_EXECUTIVE_CHAT_ANSWER_TOOL_NAME,
  description:
    "Submit your structured answer to the executive's question, grounded exclusively in the provided ExecutiveFinancialContext and, when present, ExecutiveKnowledgeContext. `factualClaims`, `analysis`, and `hypotheses` may each be empty when there is nothing to report in that category — never fabricate an entry to avoid an empty array. Set `requiresScenarioSimulation: true` and never compute a number yourself whenever the question asks for a hypothetical/what-if financial calculation. Set `groundingStatus: \"UNSUPPORTED\"` (with at least one limitation explaining why) whenever the current context does not support a reliable answer at all. " +
    BASIS_DESCRIPTION_NOTE +
    " " +
    ACTION_CATALOG_NOTE,
  input_schema: EXECUTIVE_CHAT_ANSWER_TOOL_SCHEMA,
  strict: true,
};
