import {
  SUBMIT_EXECUTIVE_DIAGNOSIS_TOOL_NAME,
  SUBMIT_EXECUTIVE_DIAGNOSIS_CORE_TOOL_NAME,
  SUBMIT_EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL_NAME,
} from "./buildExecutiveAISystemPrompt";

/**
 * Definição mínima de "JSON Schema tool" aceita pela Anthropic API
 * (`Anthropic.Tool.input_schema`) — tipada localmente para não
 * depender de um tipo interno do SDK que pode mudar entre versões.
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
 * Mission 135 — Etapa 2 (auditoria quantitativa real, script contra o
 * schema de produção) confirmou que a forma anterior de `basis`
 * (objeto com 4 arrays, `INTERPRETATION_BASIS_SCHEMA` da Mission 134)
 * era o maior contribuinte isolado para o tamanho da gramática
 * compilada que a Mission 134 confirmou exceder o limite da Anthropic
 * ("compiled grammar is too large"): 35 das 72 declarações de
 * propriedade do schema (49%) e 28 dos 37 nós de array (76%) vinham
 * só de `basis`, reutilizado em 7 pontos do schema.
 *
 * **Formato de transporte compacto (Etapa 3, Estratégias A+B
 * combinadas)**: em vez de um objeto com 4 arrays separados, `basis`
 * passa a ser um único array de strings prefixadas por categoria —
 * `"indicator:<id>"`/`"evidence:<id>"`/`"context:<id>"`/`"conflict:<id>"`
 * — reduzindo a contribuição de cada um dos 7 usos de 5 declarações
 * de propriedade (objeto + 4 subcampos) para 1. O contrato de domínio
 * `InterpretationBasis` (D-059, 4 campos ricos) **nunca muda** —
 * `decodeBasisReferences()` (`basisTransport.ts`) reconstrói a forma
 * completa inteiramente dentro do adapter de infraestrutura, antes de
 * `executeExecutiveAnalysis()`/`validateExecutiveDiagnosis()` verem
 * qualquer dado. Nenhum array vazio deixa de representar ausência —
 * um array de referências vazio (`[]`) ainda decodifica para os 4
 * campos vazios, mesma semântica de sempre.
 *
 * **Mission 148** — Knowledge-Conditioned Executive Decision
 * Intelligence (D-080): o vocabulário de prefixos aceito por `basis`
 * ganhou um 5º valor, `"knowledge:<id>"` (ver
 * `EXECUTIVE_DIAGNOSIS_TOOL.description`/`BASIS_DESCRIPTION_NOTE`
 * abaixo, e `decodeBasisReferences()` em `basisTransport.ts`) — a
 * FORMA do schema abaixo permanece exatamente `{type: "array", items:
 * {type: "string"}}`, sem nenhuma propriedade nova declarada, então a
 * redução de complexidade desta missão nunca é reaberta pela extensão.
 */
const BASIS_REFERENCES_SCHEMA: JsonSchema = {
  type: "array",
  items: { type: "string" },
};

/**
 * Schema de estrutura de apoio (Etapa 7) — reflete exatamente os
 * campos de conteúdo de `ExecutiveDiagnosis`/`ExecutiveDiagnosis.types.ts`
 * (D-059/Mission 115). **Deliberadamente ausentes deste schema**:
 * `id`, `basedOn`, `boundaries` — esses três campos não são autoridade
 * do modelo (identificador/timestamp/fronteiras arquiteturais fixas);
 * `AnthropicExecutiveAIProvider` os preenche ele mesmo depois da
 * chamada, nunca confiando no modelo para produzi-los (Etapa 7: "nunca
 * confiar apenas no formato prometido pelo provider" — aqui levado ao
 * limite: nem sequer se pede ao modelo que gere esses campos).
 */
export const EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    executiveSummary: {
      type: "object",
      properties: {
        statement: { type: "string" },
        basis: BASIS_REFERENCES_SCHEMA,
      },
      required: ["statement", "basis"],
      additionalProperties: false,
    },
    interpretations: {
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
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          statement: { type: "string" },
          type: { type: "string", enum: ["CONFIRMED_SIGNAL", "INFERRED_RISK"] },
          basis: BASIS_REFERENCES_SCHEMA,
        },
        required: ["id", "statement", "type", "basis"],
        additionalProperties: false,
      },
    },
    priorities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          rank: { type: "integer" },
          statement: { type: "string" },
          reason: { type: "string" },
          basis: BASIS_REFERENCES_SCHEMA,
        },
        required: ["id", "rank", "statement", "reason", "basis"],
        additionalProperties: false,
      },
    },
    possibleActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: {
            type: "string",
            enum: ["POSSIBLE_ACTION", "OPTION", "INVESTIGATE", "CONSIDER", "VALIDATE"],
          },
          statement: { type: "string" },
          basis: BASIS_REFERENCES_SCHEMA,
        },
        required: ["id", "kind", "statement", "basis"],
        additionalProperties: false,
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          raisedFrom: {
            type: "string",
            enum: ["unknown", "uncertainty", "conflict", "hypothesis"],
          },
          relatedId: { type: "string" },
        },
        required: ["id", "question", "raisedFrom"],
        additionalProperties: false,
      },
    },
    uncertainties: {
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
    conflictInterpretations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          conflictSignals: { type: "array", items: { type: "string" } },
          statement: { type: "string" },
          basis: BASIS_REFERENCES_SCHEMA,
        },
        required: ["id", "conflictSignals", "statement", "basis"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "executiveSummary",
    "interpretations",
    "hypotheses",
    "risks",
    "priorities",
    "possibleActions",
    "questions",
    "uncertainties",
    "conflictInterpretations",
  ],
  additionalProperties: false,
};

export interface ExecutiveDiagnosisToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: JsonSchema;
  /**
   * Mission 132 — achado forense central: sem este campo, a Anthropic
   * API nunca impunha `required`/`additionalProperties` do
   * `input_schema` sobre o `input` de fato produzido pelo modelo — o
   * schema era apenas orientação (guidance), nunca uma garantia
   * estrutural. `tool_choice` forçava só o NOME da tool a ser chamado,
   * nunca o CONTEÚDO a respeitar o schema. Confirmado por
   * documentação do próprio SDK (`Anthropic.Tool.strict`): "When
   * true, guarantees schema validation on tool names and inputs" —
   * implica que, ausente/false (estado de todas as Missions 118-131),
   * essa garantia nunca existiu. `true` aqui é a correção mínima
   * (Etapa 5, prioridade 1/2) para a causa raiz da resposta
   * praticamente vazia observada na Mission 131 (`output_tokens: 56`,
   * todos os 9 campos ausentes, mas `stop_reason: "tool_use"` —
   * estruturalmente "bem-sucedida" para uma API que nunca checou o
   * conteúdo).
   */
  readonly strict?: boolean;
}

/**
 * Definição completa da tool enviada ao SDK (`Anthropic.Tool`-compatível
 * estruturalmente) — `tool_choice` força o modelo a chamá-la, nunca
 * responder em texto livre (Etapa 7). `strict: true` (Mission 132)
 * força também a conformidade estrutural do `input` — os 9 campos de
 * `required` deixam de ser apenas documentação e passam a ser
 * garantidos pela própria API.
 */
export const EXECUTIVE_DIAGNOSIS_TOOL: ExecutiveDiagnosisToolDefinition = {
  name: SUBMIT_EXECUTIVE_DIAGNOSIS_TOOL_NAME,
  description:
    "Submit the structured executive diagnosis produced from the provided ExecutiveFinancialContext. Every array may be empty when there is nothing to report in that category — never fabricate an entry to avoid an empty array. " +
    "Every `basis` field is an array of strings, each referencing one real element that supports the statement. Each entry MUST be prefixed with its category, using exactly one of these forms: \"indicator:<id>\", \"evidence:<id>\", \"context:<id>\", \"conflict:<id>\" (from \"context\" — Financial Truth), or \"knowledge:<id>\" (from \"knowledgeContext.knowledge\" — Historical Knowledge, when present) — using only ids that actually appear in the provided data, never an invented id. Citing a \"knowledge:<id>\" means this item CONSIDERED that historical pattern — never that the pattern is a confirmed cause or guarantee of this item. An entry with an unrecognized prefix or no prefix will be discarded, so always include the prefix.",
  input_schema: EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA,
  strict: true,
};

const BASIS_DESCRIPTION_NOTE =
  "Every `basis` field is an array of strings, each referencing one real element that supports the statement. Each entry MUST be prefixed with its category, using exactly one of these forms: \"indicator:<id>\", \"evidence:<id>\", \"context:<id>\", \"conflict:<id>\" (from \"context\" — Financial Truth), or \"knowledge:<id>\" (from \"knowledgeContext.knowledge\" — Historical Knowledge, when present) — using only ids that actually appear in the provided data, never an invented id. Citing a \"knowledge:<id>\" means this item CONSIDERED that historical pattern — never that the pattern is a confirmed cause or guarantee of this item. An entry with an unrecognized prefix or no prefix will be discarded, so always include the prefix.";

/**
 * Mission 136 — Etapa 2/3: geração em 2 chamadas `strict` separadas
 * (D-068 preservado — `basis` continua o formato de transporte
 * compacto da Mission 135 em ambas). Medido por script real antes da
 * implementação (Etapa 2): o schema único (44 propriedades/16 arrays/
 * 2949 bytes reais) se divide em Stage A (~24 propriedades/9 arrays)
 * e Stage B (~20 propriedades/7 arrays) — cada um significativamente
 * abaixo da complexidade que falhou, justificando 2 stages em vez de
 * 3 (a própria missão instrui: "só usar 3 stages se necessário").
 *
 * **Stage A ("core")** — síntese executiva e o que é
 * acionável/confirmado: `executiveSummary`, `interpretations`,
 * `risks`, `priorities`, `possibleActions`.
 */
export const EXECUTIVE_DIAGNOSIS_CORE_TOOL_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    executiveSummary: EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA.properties!.executiveSummary,
    interpretations: EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA.properties!.interpretations,
    risks: EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA.properties!.risks,
    priorities: EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA.properties!.priorities,
    possibleActions: EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA.properties!.possibleActions,
  },
  required: ["executiveSummary", "interpretations", "risks", "priorities", "possibleActions"],
  additionalProperties: false,
};

export const EXECUTIVE_DIAGNOSIS_CORE_TOOL: ExecutiveDiagnosisToolDefinition = {
  name: SUBMIT_EXECUTIVE_DIAGNOSIS_CORE_TOOL_NAME,
  description:
    "Submit the CORE portion of the structured executive diagnosis (executiveSummary, interpretations, risks, priorities, possibleActions) produced from the provided ExecutiveFinancialContext. A separate call will submit the interpretive/epistemic portion (hypotheses, questions, uncertainties, conflictInterpretations) — do not attempt to include those fields here. Every array may be empty when there is nothing to report in that category — never fabricate an entry to avoid an empty array. " +
    BASIS_DESCRIPTION_NOTE,
  input_schema: EXECUTIVE_DIAGNOSIS_CORE_TOOL_SCHEMA,
  strict: true,
};

/**
 * **Stage B ("interpretation")** — camada epistêmica/exploratória:
 * `hypotheses`, `questions`, `uncertainties`, `conflictInterpretations`.
 */
export const EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    hypotheses: EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA.properties!.hypotheses,
    questions: EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA.properties!.questions,
    uncertainties: EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA.properties!.uncertainties,
    conflictInterpretations: EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA.properties!.conflictInterpretations,
  },
  required: ["hypotheses", "questions", "uncertainties", "conflictInterpretations"],
  additionalProperties: false,
};

export const EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL: ExecutiveDiagnosisToolDefinition = {
  name: SUBMIT_EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL_NAME,
  description:
    "Submit the INTERPRETIVE/EPISTEMIC portion of the structured executive diagnosis (hypotheses, questions, uncertainties, conflictInterpretations) produced from the provided ExecutiveFinancialContext. A separate call already submitted the core/actionable portion (executiveSummary, interpretations, risks, priorities, possibleActions) — do not attempt to include those fields here. Every array may be empty when there is nothing to report in that category — never fabricate an entry to avoid an empty array. " +
    BASIS_DESCRIPTION_NOTE,
  input_schema: EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL_SCHEMA,
  strict: true,
};
