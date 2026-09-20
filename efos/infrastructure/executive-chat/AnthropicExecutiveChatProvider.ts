import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

import type { ExecutiveAIResponse } from "@/efos/application/executive-ai";
import { mapAnthropicErrorToExecutiveAIError, type AnthropicMessagesClient } from "@/efos/infrastructure/executive-ai";
import type { ExecutiveChatProvider, ExecutiveChatRequest, RawExecutiveChatActionProposal } from "@/efos/application/executive-chat";
import { EXECUTIVE_CHAT_BOUNDARIES, resolveExecutiveChatActionProposals } from "@/efos/application/executive-chat";

import { buildExecutiveChatSystemPrompt } from "./buildExecutiveChatSystemPrompt";
import { decodeModelChatAnswerBasisFields } from "./decodeChatAnswerBasisFields";
import { EXECUTIVE_CHAT_ANSWER_TOOL, type ExecutiveChatToolDefinition } from "./executiveChatToolSchema";
import { serializeExecutiveChatInstruction } from "./serializeExecutiveChatInstruction";

const PROVIDER_NAME = "anthropic-claude";
const DEFAULT_MODEL = "claude-sonnet-5";
/**
 * Menor que `DEFAULT_MAX_TOKENS` de `AnthropicExecutiveAIProvider`
 * (32000) — deliberado: uma resposta de chat é conversacional, uma
 * pergunta pontual, nunca um diagnóstico executivo completo sobre 9
 * categorias. 8000 tokens é generoso para `answer` + poucos itens em
 * cada um dos 4 arrays; documentado como um valor inicial honesto
 * (Seção 29 — "do not prematurely build complex metering"), não uma
 * medição real de produção ainda.
 */
const DEFAULT_MAX_TOKENS = 8000;

export interface AnthropicExecutiveChatProviderOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly client?: AnthropicMessagesClient;
}

const ANSWER_ARRAY_FIELDS = ["factualClaims", "analysis", "hypotheses", "limitations"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeShapeIssues(value: unknown): readonly string[] {
  const expectedFields = ["answer", "groundingStatus", "requiresScenarioSimulation", ...ANSWER_ARRAY_FIELDS];
  if (!isPlainObject(value)) {
    return [`<resposta do modelo não é um objeto>: ${expectedFields.join(", ")}`];
  }

  const issues: string[] = [];
  if (typeof value.answer !== "string") issues.push("answer");
  if (typeof value.groundingStatus !== "string") issues.push("groundingStatus");
  if (typeof value.requiresScenarioSimulation !== "boolean") issues.push("requiresScenarioSimulation");
  for (const field of ANSWER_ARRAY_FIELDS) {
    if (!Array.isArray(value[field])) issues.push(field);
  }
  return issues;
}

/**
 * Primeira implementação real de `ExecutiveChatProvider` (Mission 188)
 * — mesmo precedente estrutural de `AnthropicExecutiveAIProvider`
 * (Mission 118/136, D-062/D-068), reaproveitando diretamente
 * `AnthropicMessagesClient` (injeção de client para teste),
 * `mapAnthropicErrorToExecutiveAIError()` (tradução de exceção do SDK,
 * inteiramente genérica — nunca soube nada sobre Diagnosis) e o mesmo
 * guard de timeout não-streaming (Mission 131).
 *
 * **Uma única chamada `strict`** (nunca 2 stages) — o schema de Chat é
 * pequeno o suficiente (4 arrays de itens simples) para nunca esbarrar
 * no limite de "compiled grammar" que forçou a divisão em Diagnosis
 * (Mission 134/135/136); dividir aqui seria complexidade sem benefício
 * real (REGRA 15).
 *
 * **Responsabilidade exclusiva**: `ExecutiveChatInstruction → chamada
 * ao modelo → resposta bruta → ExecutiveAIResponse`. Nunca calcula
 * indicador, nunca simula Scenario, nunca cria Recommendation/Decision,
 * nunca acessa Supabase/banco/UI diretamente.
 */
export class AnthropicExecutiveChatProvider implements ExecutiveChatProvider {
  readonly providerName = PROVIDER_NAME;

  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly injectedClient: AnthropicMessagesClient | undefined;

  constructor(options: AnthropicExecutiveChatProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.injectedClient = options.client;
  }

  async converse(request: ExecutiveChatRequest): Promise<ExecutiveAIResponse> {
    if (!this.injectedClient && !this.apiKey) {
      throw {
        code: "PROVIDER_UNAVAILABLE",
        message: "ANTHROPIC_API_KEY não configurada — o provider Anthropic não pode ser chamado sem uma chave de API válida.",
        providerName: this.providerName,
      };
    }

    // Mesmo guard de timeout não-streaming da Mission 131 — ver
    // `AnthropicExecutiveAIProvider` para o achado forense completo.
    const CLIENT_TIMEOUT_MS = 15 * 60 * 1000;
    const client: AnthropicMessagesClient = this.injectedClient ?? new Anthropic({ apiKey: this.apiKey, timeout: CLIENT_TIMEOUT_MS });
    const { instruction } = request;
    const payload = serializeExecutiveChatInstruction(instruction);
    const userContent = JSON.stringify(payload);
    const systemPrompt = buildExecutiveChatSystemPrompt(instruction);

    let message: Anthropic.Message;
    try {
      message = await client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
        tools: [EXECUTIVE_CHAT_ANSWER_TOOL as unknown as Anthropic.Tool],
        tool_choice: { type: "tool", name: EXECUTIVE_CHAT_ANSWER_TOOL.name },
      });
    } catch (caught) {
      throw mapAnthropicErrorToExecutiveAIError(caught);
    }

    const modelOutput = extractToolInput(message, EXECUTIVE_CHAT_ANSWER_TOOL);
    const issues = describeShapeIssues(modelOutput);
    if (issues.length > 0) {
      throw {
        code: "INVALID_PROVIDER_RESPONSE",
        message: `A resposta do modelo não tem a forma mínima esperada. Campos ausentes/inválidos: ${issues.join(", ")}. stop_reason do provider: "${message.stop_reason}".`,
        providerName: this.providerName,
      };
    }

    const decoded = decodeModelChatAnswerBasisFields(modelOutput as Record<string, unknown>);

    // Mission 189 — Governed Executive Chat Actions. Resolve o array
    // BRUTO/untrusted de propostas de ação (`RawExecutiveChatActionProposal[]`,
    // formato plano do tool schema) para a forma CONFIÁVEL
    // (`ExecutiveChatResolvedAction[]`) — mesma etapa/mesmo lugar
    // (dentro do adapter, antes de `ExecutiveAIResponse.output`) que
    // `decodeModelChatAnswerBasisFields()` já ocupa para `basis`,
    // nunca um segundo ponto de decodificação. Propostas inválidas são
    // descartadas aqui mesmo (`resolveExecutiveChatActionProposals()`
    // nunca lança exceção) — `validateExecutiveChatAnswer()`
    // (Application Layer) permanece a defesa final, revalidando a
    // forma já resolvida.
    const rawProposedActions = (decoded as { proposedActions?: unknown }).proposedActions;
    const resolvedActions = resolveExecutiveChatActionProposals(
      Array.isArray(rawProposedActions) ? (rawProposedActions as readonly RawExecutiveChatActionProposal[]) : undefined
    );

    // Campos deliberadamente NÃO pedidos ao modelo: id/basedOn/
    // boundaries são preocupação de infraestrutura, nunca do modelo —
    // mesmo princípio de `AnthropicExecutiveAIProvider` (Mission 118,
    // Etapa 7).
    const rawAnswer: unknown = {
      id: randomUUID(),
      basedOn: { companyId: instruction.context.identity.companyId, generatedAt: new Date().toISOString() },
      ...decoded,
      proposedActions: resolvedActions,
      boundaries: EXECUTIVE_CHAT_BOUNDARIES,
    };

    return {
      providerName: this.providerName,
      model: this.model,
      output: rawAnswer,
      receivedAt: new Date().toISOString(),
      stopReason: message.stop_reason ?? "unknown",
    };
  }
}

function extractToolInput(message: Anthropic.Message, tool: ExecutiveChatToolDefinition): unknown {
  const toolUseBlock = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === tool.name
  );
  return toolUseBlock?.input;
}
