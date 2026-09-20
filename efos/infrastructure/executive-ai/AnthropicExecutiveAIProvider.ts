import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

import type {
  ExecutiveAIProvider,
  ExecutiveAIRequest,
  ExecutiveAIResponse,
} from "@/efos/application/executive-ai";
import { DIAGNOSIS_BOUNDARIES } from "@/efos/application/executive-diagnosis";

import { buildExecutiveAIStageSystemPrompt, type ExecutiveAIGenerationStage } from "./buildExecutiveAISystemPrompt";
import { decodeModelDiagnosisBasisFields } from "./basisTransport";
import { composeExecutiveDiagnosisStages } from "./composeExecutiveDiagnosisStages";
import {
  EXECUTIVE_DIAGNOSIS_CORE_TOOL,
  EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL,
  type ExecutiveDiagnosisToolDefinition,
} from "./executiveDiagnosisToolSchema";
import { mapAnthropicErrorToExecutiveAIError } from "./mapAnthropicErrorToExecutiveAIError";
import { serializeExecutiveAIInstruction } from "./serializeExecutiveAIInstruction";

const PROVIDER_NAME = "anthropic-claude";
const DEFAULT_MODEL = "claude-sonnet-5";
/**
 * Mission 131 — elevado de 8192 para 32000, teto real do provider
 * confirmado em 128000 (`client.models.retrieve()`). Mission 136 —
 * permanece 32000: a causa do bloqueio das Missions 134/135
 * ("compiled grammar is too large") nunca foi sobre `max_tokens` —
 * cada stage agora produz uma fração do conteúdo de antes, então a
 * folga em relação ao que já se mostrou suficiente (Mission
 * 130, 8192 tokens chegaram a produzir 7 dos 9 campos) é ainda maior
 * por stage.
 */
const DEFAULT_MAX_TOKENS = 32000;

/**
 * Superfície mínima do SDK que este adapter de fato usa — tipagem
 * estrutural deliberada (Mission 118, Etapa 11) para permitir injetar
 * um client fake em teste (`{messages: {create: async () => ...}}`)
 * sem depender de nenhuma classe/mock library nova; uma instância real
 * de `Anthropic` sempre satisfaz esta interface por construção.
 */
export interface AnthropicMessagesClient {
  readonly messages: {
    create(
      params: Anthropic.MessageCreateParamsNonStreaming
    ): Promise<Anthropic.Message>;
  };
}

export interface AnthropicExecutiveAIProviderOptions {
  /** Chave de API — o valor por omissão é `process.env.ANTHROPIC_API_KEY`
   * (Etapa 9: nunca hardcoded, nunca commitada). Ignorada quando
   * `client` é fornecido. */
  readonly apiKey?: string;
  readonly model?: string;
  readonly maxTokens?: number;
  /** Injeção de client, exclusiva de teste (Etapa 11, Cenários G/I) —
   * quando ausente, um `Anthropic` real é criado a partir de `apiKey`. */
  readonly client?: AnthropicMessagesClient;
}

const STAGE_A_ARRAY_FIELDS = ["interpretations", "risks", "priorities", "possibleActions"] as const;
const STAGE_B_ARRAY_FIELDS = ["hypotheses", "questions", "uncertainties", "conflictInterpretations"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Mission 136 — checagem estrutural mínima por stage, análoga a
 * `looksLikeExecutiveDiagnosis()` (`executeExecutiveAnalysis.ts`),
 * mas escopada aos campos de cada stage. Existe para detectar uma
 * falha estrutural de UM stage específico (truncamento, resposta
 * vazia) **antes** de tentar o outro stage ou compor — Etapa 4
 * (atomicidade): nenhuma chamada desperdiçada, nenhuma composição
 * parcial tentada.
 */
function describeStageShapeIssues(
  value: unknown,
  arrayFields: readonly string[],
  requireExecutiveSummary: boolean
): readonly string[] {
  const expectedFields = requireExecutiveSummary ? ["executiveSummary", ...arrayFields] : [...arrayFields];

  if (!isPlainObject(value)) {
    return [`<resposta do stage não é um objeto>: ${expectedFields.join(", ")}`];
  }

  const issues: string[] = [];
  if (requireExecutiveSummary && !isPlainObject(value.executiveSummary)) {
    issues.push("executiveSummary");
  }
  for (const field of arrayFields) {
    if (!Array.isArray(value[field])) issues.push(field);
  }
  return issues;
}

/**
 * Primeira implementação real de `ExecutiveAIProvider` (Mission 118 —
 * Executive AI Provider Implementation, D-062) — adaptador de
 * infraestrutura para a Anthropic Messages API (`@anthropic-ai/sdk`).
 *
 * **Responsabilidade exclusiva**: `ExecutiveAIInstruction → chamada ao
 * modelo → resposta bruta → ExecutiveAIResponse`. Nunca calcula
 * indicador, nunca altera `financialTruth`, nunca cria `Decision`,
 * nunca executa ação, nunca acessa Supabase/banco/UI/Document Storage
 * diretamente — nenhum desses conceitos é sequer importável aqui (só
 * `@anthropic-ai/sdk` e os contratos já existentes da Application
 * Layer).
 *
 * **Mission 136 — geração em 2 chamadas `strict` sequenciais**
 * (D-068 preservado; nenhuma mudança ao contrato `ExecutiveAIProvider`/
 * `analyze()`, D-060 — de fora, `analyze()` continua "uma chamada,
 * uma resposta"; a divisão é inteiramente um detalhe de implementação
 * deste adapter). Stage "core" (`executiveSummary`/`interpretations`/
 * `risks`/`priorities`/`possibleActions`) sempre roda primeiro; Stage
 * "interpretation" (`hypotheses`/`questions`/`uncertainties`/
 * `conflictInterpretations`) só é tentado se o Stage A tiver sucesso
 * estrutural — atomicidade garantida pelo próprio fluxo de controle
 * (um `throw` em qualquer stage interrompe antes da composição, nunca
 * um resultado parcial chega a `executeExecutiveAnalysis()`).
 *
 * `analyze()` nunca lança a exceção crua do SDK — todo erro é
 * traduzido por `mapAnthropicErrorToExecutiveAIError()` e relançado
 * como um objeto `ExecutiveAIError` (reconhecido por
 * `isExecutiveAIErrorLike()` em `executeExecutiveAnalysis()`), nunca
 * como texto livre/stack trace. Mesmo o objeto bruto que este adapter
 * monta em caso de sucesso (`ExecutiveAIResponse.output: unknown`)
 * continua **untrusted** — só `executeExecutiveAnalysis()` →
 * `validateExecutiveDiagnosis()` (D-059) pode produzir um
 * `ExecutiveDiagnosis` confiável a partir dele.
 */
export class AnthropicExecutiveAIProvider implements ExecutiveAIProvider {
  readonly providerName = PROVIDER_NAME;

  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly injectedClient: AnthropicMessagesClient | undefined;

  constructor(options: AnthropicExecutiveAIProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.injectedClient = options.client;
  }

  async analyze(request: ExecutiveAIRequest): Promise<ExecutiveAIResponse> {
    if (!this.injectedClient && !this.apiKey) {
      throw {
        code: "PROVIDER_UNAVAILABLE",
        message:
          "ANTHROPIC_API_KEY não configurada — o provider Anthropic não pode ser chamado sem uma chave de API válida.",
        providerName: this.providerName,
      };
    }

    // Mission 131 — achado real durante o retry ao vivo: o próprio SDK
    // (`Client.calculateNonstreamingTimeout()`, client.js) recusa uma
    // chamada não-streaming *antes de qualquer requisição de rede*
    // quando `max_tokens` implica um tempo de geração estimado (pior
    // caso, linear até 128000 tokens em 60 min) acima do timeout
    // padrão de 10 minutos. Esse guard só roda quando nenhum `timeout`
    // é passado explicitamente — fornecer um aqui desativa o guard sem
    // exigir streaming.
    const CLIENT_TIMEOUT_MS = 15 * 60 * 1000;
    const client: AnthropicMessagesClient =
      this.injectedClient ?? new Anthropic({ apiKey: this.apiKey, timeout: CLIENT_TIMEOUT_MS });
    const { instruction } = request;
    const payload = serializeExecutiveAIInstruction(instruction);
    const userContent = JSON.stringify(payload);

    // Stage A ("core") — sempre roda primeiro. Qualquer falha (rede/
    // auth/timeout via mapAnthropicErrorToExecutiveAIError(), ou
    // estrutural via describeStageShapeIssues()) interrompe aqui —
    // Stage B nunca é tentado, nenhuma chamada desperdiçada.
    const coreMessage = await this.callStage(client, "core", EXECUTIVE_DIAGNOSIS_CORE_TOOL, userContent, instruction);
    const coreOutput = extractToolInput(coreMessage, EXECUTIVE_DIAGNOSIS_CORE_TOOL);
    const coreIssues = describeStageShapeIssues(coreOutput, STAGE_A_ARRAY_FIELDS, true);
    if (coreIssues.length > 0) {
      throw {
        code: "INVALID_PROVIDER_RESPONSE",
        message: `Stage A (core) não tem a forma mínima esperada. Campos ausentes/inválidos: ${coreIssues.join(", ")}. stop_reason do provider: "${coreMessage.stop_reason}".`,
        providerName: this.providerName,
      };
    }

    // Stage B ("interpretation") — só é tentado depois de Stage A ter
    // sucesso estrutural confirmado.
    const interpretationMessage = await this.callStage(
      client,
      "interpretation",
      EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL,
      userContent,
      instruction
    );
    const interpretationOutput = extractToolInput(interpretationMessage, EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL);
    const interpretationIssues = describeStageShapeIssues(interpretationOutput, STAGE_B_ARRAY_FIELDS, false);
    if (interpretationIssues.length > 0) {
      throw {
        code: "INVALID_PROVIDER_RESPONSE",
        message: `Stage B (interpretation) não tem a forma mínima esperada — Stage A foi descartado, nenhuma composição parcial é permitida (Etapa 4). Campos ausentes/inválidos: ${interpretationIssues.join(", ")}. stop_reason do provider: "${interpretationMessage.stop_reason}".`,
        providerName: this.providerName,
      };
    }

    // Composição — Mission 136, Etapa 3. Ambos os stages decodificados
    // (Mission 135, D-068) para a forma de domínio (D-059) antes de
    // compor; a decodificação é a mesma função genérica de sempre,
    // que já ignora com segurança campos ausentes de um objeto
    // parcial.
    const decodedCore = decodeModelDiagnosisBasisFields(coreOutput as Record<string, unknown>);
    const decodedInterpretation = decodeModelDiagnosisBasisFields(interpretationOutput as Record<string, unknown>);
    const composed = composeExecutiveDiagnosisStages(decodedCore, decodedInterpretation);

    // Campos deliberadamente NÃO pedidos ao modelo (Etapa 7 —
    // `executiveDiagnosisToolSchema.ts`): id/timestamp são
    // preocupação de infraestrutura, nunca do modelo; `boundaries` é
    // um literal fixo (D-059) que o adapter sempre injeta, nunca
    // confiando no modelo para reproduzi-lo fielmente.
    const rawDiagnosis: unknown = {
      id: randomUUID(),
      basedOn: { generatedAt: new Date().toISOString() },
      ...composed,
      boundaries: DIAGNOSIS_BOUNDARIES,
    };

    return {
      providerName: this.providerName,
      model: this.model,
      output: rawDiagnosis,
      receivedAt: new Date().toISOString(),
      // Mission 130/136 — puramente diagnóstico, nunca usado para
      // decidir se `output` é confiável; agora resume os 2 stages.
      stopReason: `core:${coreMessage.stop_reason ?? "unknown"};interpretation:${interpretationMessage.stop_reason ?? "unknown"}`,
    };
  }

  private async callStage(
    client: AnthropicMessagesClient,
    stage: ExecutiveAIGenerationStage,
    tool: ExecutiveDiagnosisToolDefinition,
    userContent: string,
    instruction: ExecutiveAIRequest["instruction"]
  ): Promise<Anthropic.Message> {
    const systemPrompt = buildExecutiveAIStageSystemPrompt(instruction, stage);
    try {
      return await client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
        tools: [tool as unknown as Anthropic.Tool],
        tool_choice: { type: "tool", name: tool.name },
      });
    } catch (caught) {
      throw mapAnthropicErrorToExecutiveAIError(caught);
    }
  }
}

/**
 * Extrai o `input` do bloco `tool_use` correspondente à tool forçada
 * (Etapa 7) — se o modelo, por qualquer motivo, não chamar a tool
 * (ex.: parou por outro `stop_reason`), devolve `undefined`, e a
 * checagem estrutural do stage (`describeStageShapeIssues()`)
 * rejeita de forma segura, nunca uma exceção não tratada.
 */
function extractToolInput(
  message: Anthropic.Message,
  tool: ExecutiveDiagnosisToolDefinition
): unknown {
  const toolUseBlock = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === tool.name
  );
  return toolUseBlock?.input;
}
