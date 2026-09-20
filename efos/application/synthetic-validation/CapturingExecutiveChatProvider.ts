import { createHash } from "node:crypto";

import type { ExecutiveAIResponse } from "@/efos/application/executive-ai";
import type {
  ExecutiveChatAnswer,
  ExecutiveChatInstruction,
  ExecutiveChatProvider,
  ExecutiveChatRequest,
  ExecutiveChatResolvedAction,
} from "@/efos/application/executive-chat";
import { EXECUTIVE_CHAT_BOUNDARIES } from "@/efos/application/executive-chat";
import type { InterpretationBasis } from "@/efos/application/executive-diagnosis";

/**
 * Mission 188 — Executive Chat over Canonical EFOS Intelligence.
 *
 * Mesmo precedente exato de `CapturingExecutiveAIProvider` (Mission
 * 160, REGRA 4 daquela missão): um stand-in determinístico para o
 * modelo externo, NUNCA uma segunda Engine — `converse()` lê
 * exclusivamente os campos já presentes em `request.instruction` (a
 * mesma instrução REAL que `executeExecutiveChatAnalysis()` constrói e
 * valida antes de chamar qualquer provider). Determinístico: `answerId`/
 * `generatedAt`/`receivedAt` são sempre recebidos como parâmetro do
 * construtor. Captura, nunca fabrica: `lastRequest`/`requestCount`
 * expõem exatamente o que foi recebido.
 *
 * Usado por todos os testes focados de Mission 188 (Seção 27/44.28) —
 * nenhuma chamada real à Anthropic ocorre em regressão.
 */
export interface CapturingExecutiveChatProviderOptions {
  readonly providerName?: string;
  readonly answerId: string;
  readonly generatedAt: string;
  readonly receivedAt: string;
}

function deterministicItemId(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function availableIndicatorId(instruction: ExecutiveChatInstruction): string | undefined {
  return instruction.context.financialTruth.indicators.find((i) => i.result.status === "available")?.id;
}

function firstEvidenceId(instruction: ExecutiveChatInstruction): string | undefined {
  return instruction.context.evidence[0]?.id;
}

function firstKnowledgeId(instruction: ExecutiveChatInstruction): string | undefined {
  return instruction.knowledgeContext?.knowledge[0]?.id;
}

function basisFromInstruction(instruction: ExecutiveChatInstruction, options: { readonly includeKnowledge?: boolean } = {}): InterpretationBasis {
  const indicatorId = availableIndicatorId(instruction);
  const evidenceId = firstEvidenceId(instruction);
  const knowledgeId = options.includeKnowledge ? firstKnowledgeId(instruction) : undefined;

  return {
    ...(indicatorId ? { indicatorIds: [indicatorId] } : {}),
    ...(evidenceId ? { evidenceIds: [evidenceId] } : {}),
    ...(knowledgeId ? { knowledgeIds: [knowledgeId] } : {}),
  };
}

/**
 * Heurística determinística e puramente textual (nunca IA/semântica)
 * para reconhecer uma pergunta "e se..." (Seção 15/32/Cenário de
 * Scenario Boundary) — suficiente para os testes de contrato desta
 * missão provarem que `requiresScenarioSimulation: true` é uma opção
 * estruturalmente representável e nunca acompanhada de um número
 * fabricado; nunca usada em produção (o provider real decide isso via
 * julgamento do modelo, não por keyword matching).
 */
function questionAsksForSimulation(question: string): boolean {
  const lower = question.toLowerCase();
  // Word-boundary regex — nunca `.includes("e se")`, que falsamente
  // reconheceria "qu[e se]ja" como a partícula condicional "e se"
  // (mesma classe de erro já corrigida em missões anteriores desta
  // sessão: sempre checar limite de palavra, nunca substring nua).
  return /\be se\b/.test(lower) || /\bwhat if\b/.test(lower) || /\bse eu\b/.test(lower);
}

/**
 * Mission 189 — extrai, de forma puramente TEXTUAL e determinística
 * (nunca IA/semântica — mesmo espírito de `questionAsksForSimulation()`
 * acima), uma proposta de ação de cenário PLAUSÍVEL a partir da própria
 * pergunta — suficiente para os testes de contrato provarem que
 * `proposedActions` chega corretamente resolvido e validado; NUNCA
 * usado em produção (o provider real decide isso por julgamento do
 * modelo, nunca por regex sobre a pergunta).
 */
function extractOperatingCostProposalFromQuestion(question: string): ExecutiveChatResolvedAction | undefined {
  const lower = question.toLowerCase();
  const amountMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*mil/);
  if (!amountMatch) return undefined;

  const magnitude = Number(amountMatch[1].replace(",", ".")) * 1000;
  if (!Number.isFinite(magnitude) || magnitude <= 0) return undefined;

  const isReduction = /\breduz|\bcortar\b|\bcorte\b|\bdiminuir\b/.test(lower);
  const signedAmount = isReduction ? -magnitude : magnitude;

  return {
    kind: "scenario",
    type: "PREPARE_OPERATING_COST_SCENARIO",
    reason: "A pergunta descreve uma mudança hipotética em despesas operacionais, que exige uma simulação real para ser respondida com números.",
    assumption: {
      kind: "operating_cost_change",
      scenarioType: "adjust_operating_costs",
      operatingExpensesDelta: { amount: signedAmount, currency: "BRL" },
    },
  };
}

/**
 * Mission 190 — heurística textual determinística (nunca IA, nunca
 * usada em produção) para a PROVA CENTRAL da missão (Seção 31):
 * reconhece especificamente "comparar reduzir/aumentar despesas
 * operacionais em X com receber N dias mais rápido/devagar". Nunca um
 * parser geral de comparação — apenas o suficiente para provar, ponta a
 * ponta via `executeExecutiveChatAnalysis()`, que uma pergunta
 * conversacional real produz uma `PREPARE_SCENARIO_COMPARISON`
 * corretamente resolvida. Outras combinações (mesmo tipo, não
 * suportada, mista) são testadas diretamente via
 * `resolveExecutiveChatActionProposal()`, sem depender desta heurística.
 */
function extractComparisonProposalFromQuestion(question: string): ExecutiveChatResolvedAction | undefined {
  const lower = question.toLowerCase();
  if (!/\bcompar/.test(lower)) return undefined;

  const opexAmountMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*mil/);
  const daysMatch = lower.match(/(\d+)\s*dias?/);
  const isFaster = /mais r[aá]pid/.test(lower);
  const isSlower = /mais devagar|mais lent/.test(lower);
  if (!opexAmountMatch || !daysMatch || (!isFaster && !isSlower)) return undefined;

  const magnitude = Number(opexAmountMatch[1].replace(",", ".")) * 1000;
  const days = Number(daysMatch[1]);
  if (!Number.isFinite(magnitude) || magnitude <= 0 || !Number.isFinite(days) || days <= 0) return undefined;

  const isReduction = /\breduz|\bcortar\b|\bcorte\b|\bdiminuir\b/.test(lower);

  return {
    kind: "comparison",
    type: "PREPARE_SCENARIO_COMPARISON",
    reason: "A pergunta compara duas alternativas hipotéticas — despesas operacionais e prazo de recebimento — que exigem o Scenario Engine real para serem comparadas com números.",
    alternativeA: {
      kind: "operating_cost_change",
      scenarioType: "adjust_operating_costs",
      operatingExpensesDelta: { amount: isReduction ? -magnitude : magnitude, currency: "BRL" },
    },
    alternativeB: {
      kind: "collection_period_change",
      scenarioType: "adjust_collection_terms",
      collectionPeriodDeltaDays: isFaster ? -days : days,
    },
  };
}

/**
 * Mission 189 — heurística textual determinística para o cenário de
 * navegação (Seção 52), nunca usada em produção. Casa o RADICAL
 * "decis" (cobre "decisão"/"decisões"/"decision", já que o plural
 * PT-BR "decisões" não compartilha o sufixo "ão" do singular — mesma
 * disciplina de word-boundary desta sessão, mas aplicada ao radical
 * estável em vez de tentar enumerar toda flexão de plural).
 */
function questionAsksAboutDecisions(question: string): boolean {
  const lower = question.toLowerCase();
  return /\bdecis/.test(lower) && /\batenç(ã|a)o\b|\bpendente\b|\bprecisam?\b/.test(lower);
}

function questionAsksForUnsupportedForecast(question: string): boolean {
  const lower = question.toLowerCase();
  return /\bdaqui a\b/.test(lower) || /\bmeses\b/.test(lower) || /\bprevisão\b/.test(lower) || /\bforecast\b/.test(lower);
}

export function buildDeterministicSyntheticChatAnswer(
  instruction: ExecutiveChatInstruction,
  answerId: string,
  generatedAt: string
): ExecutiveChatAnswer {
  const seedPrefix = `mission188::${instruction.instructionId}`;
  const basis = basisFromInstruction(instruction);
  const knowledgeBasis = basisFromInstruction(instruction, { includeKnowledge: true });
  const hasEvidence = instruction.context.evidence.length > 0;
  const knowledge = instruction.knowledgeContext?.knowledge[0];
  const questionText = instruction.question.text;

  const claimId = deterministicItemId(`${seedPrefix}::claim::0`);
  const analysisId = deterministicItemId(`${seedPrefix}::analysis::0`);
  const hypothesisId = deterministicItemId(`${seedPrefix}::hypothesis::0`);
  const limitationId = deterministicItemId(`${seedPrefix}::limitation::0`);

  const comparisonProposal = extractComparisonProposalFromQuestion(questionText);
  if (comparisonProposal) {
    return {
      id: answerId,
      answer:
        "Esta pergunta pede a comparação de duas alternativas hipotéticas — isso exige o Scenario Engine real (Scenario Lab), nunca um cálculo feito diretamente nesta conversa. Nenhuma das duas alternativas é melhor ou pior automaticamente — cabe a você decidir, depois de ver os dois resultados reais.",
      factualClaims: [],
      analysis: [],
      hypotheses: [],
      limitations: [
        {
          id: limitationId,
          statement: "Não é possível calcular o resultado desta comparação diretamente nesta conversa.",
          reason: "Comparações financeiras hipotéticas exigem o Scenario Engine canônico — o chat nunca realiza esse cálculo por conta própria.",
        },
      ],
      groundingStatus: "UNSUPPORTED",
      requiresScenarioSimulation: true,
      basedOn: { companyId: instruction.context.identity.companyId, generatedAt },
      boundaries: EXECUTIVE_CHAT_BOUNDARIES,
      proposedActions: [comparisonProposal],
    };
  }

  if (questionAsksForSimulation(questionText)) {
    const proposal = extractOperatingCostProposalFromQuestion(questionText);
    return {
      id: answerId,
      answer:
        "Esta pergunta pede uma simulação financeira hipotética — isso exige o Scenario Engine real (Scenario Lab), nunca um cálculo feito diretamente nesta conversa.",
      factualClaims: [],
      analysis: [],
      hypotheses: [],
      limitations: [
        {
          id: limitationId,
          statement: "Não é possível calcular o resultado desta hipótese diretamente nesta conversa.",
          reason: "Simulações financeiras hipotéticas exigem o Scenario Engine canônico — o chat nunca realiza esse cálculo por conta própria.",
        },
      ],
      groundingStatus: "UNSUPPORTED",
      requiresScenarioSimulation: true,
      basedOn: { companyId: instruction.context.identity.companyId, generatedAt },
      boundaries: EXECUTIVE_CHAT_BOUNDARIES,
      proposedActions: proposal ? [proposal] : [],
    };
  }

  if (questionAsksForUnsupportedForecast(questionText)) {
    return {
      id: answerId,
      answer: "O contexto EFOS atual não oferece uma previsão para o horizonte perguntado — nenhuma projeção multi-período é calculada hoje.",
      factualClaims: [],
      analysis: [],
      hypotheses: [],
      limitations: [
        {
          id: limitationId,
          statement: "Não é possível concluir um valor futuro para o horizonte perguntado.",
          reason: "O EFOS não calcula previsão multi-período — apenas o contexto financeiro já observado.",
        },
      ],
      groundingStatus: "UNSUPPORTED",
      requiresScenarioSimulation: false,
      basedOn: { companyId: instruction.context.identity.companyId, generatedAt },
      boundaries: EXECUTIVE_CHAT_BOUNDARIES,
      proposedActions: [],
    };
  }

  return {
    id: answerId,
    answer: hasEvidence
      ? `O contexto financeiro atual desta empresa mostra ${instruction.context.evidence.length} evidência(s) determinística(s) já produzida(s) pelos Engines.`
      : "O contexto financeiro atual desta empresa não mostra nenhuma evidência determinística para este período.",
    factualClaims: hasEvidence
      ? [
          {
            id: claimId,
            statement: `Há ${instruction.context.evidence.length} evidência(s) determinística(s) disponível(is) no contexto atual.`,
            basis,
          },
        ]
      : [],
    analysis: hasEvidence
      ? [
          {
            id: analysisId,
            statement: "Os indicadores e evidências disponíveis, em conjunto, sugerem um período que merece atenção executiva.",
            basis,
            confidence: "medium",
          },
        ]
      : [],
    hypotheses: [
      {
        id: hypothesisId,
        statement: "O padrão observado pode continuar em períodos subsequentes se as mesmas condições operacionais persistirem.",
        basis,
        confidence: "low",
        validationNeeded: "Confirmar com a Verdade Financeira do próximo período assim que estiver disponível.",
      },
    ],
    limitations: knowledge
      ? []
      : [
          {
            id: limitationId,
            statement: "Nenhum conhecimento histórico governado está disponível para esta empresa neste momento.",
            reason: "Ainda não existe Knowledge (D-073) formado para esta empresa, ou nenhum item passou pelo filtro de relevância.",
          },
        ],
    groundingStatus: hasEvidence ? "GROUNDED" : "PARTIAL",
    requiresScenarioSimulation: false,
    basedOn: { companyId: instruction.context.identity.companyId, generatedAt },
    boundaries: EXECUTIVE_CHAT_BOUNDARIES,
    proposedActions: questionAsksAboutDecisions(instruction.question.text)
      ? [
          {
            kind: "navigation",
            type: "OPEN_DECISION_CENTER",
            reason: "A pergunta pede quais decisões precisam de atenção — a Central de Decisões já lista exatamente isso.",
          },
        ]
      : [],
  };

  // `knowledgeBasis` documenta a regra de citação de Knowledge (REGRA 6
  // do precedente Mission 160) para os testes que queiram construir seu
  // próprio caso citando Knowledge explicitamente — não é um campo do
  // schema atual, referenciado aqui só para nunca ficar "unused".
  void knowledgeBasis;
}

export class CapturingExecutiveChatProvider implements ExecutiveChatProvider {
  readonly providerName: string;
  private readonly answerId: string;
  private readonly generatedAt: string;
  private readonly receivedAt: string;
  private _lastRequest: ExecutiveChatRequest | undefined;
  private _requestCount = 0;

  constructor(options: CapturingExecutiveChatProviderOptions) {
    this.providerName = options.providerName ?? "mission188-capturing-synthetic-chat-provider";
    this.answerId = options.answerId;
    this.generatedAt = options.generatedAt;
    this.receivedAt = options.receivedAt;
  }

  get lastRequest(): ExecutiveChatRequest | undefined {
    return this._lastRequest;
  }

  get requestCount(): number {
    return this._requestCount;
  }

  async converse(request: ExecutiveChatRequest): Promise<ExecutiveAIResponse> {
    this._lastRequest = request;
    this._requestCount += 1;

    const output = buildDeterministicSyntheticChatAnswer(request.instruction, this.answerId, this.generatedAt);

    return { providerName: this.providerName, output, receivedAt: this.receivedAt };
  }
}

/**
 * Variante para provar rejeição de resposta malformada (mesmo
 * precedente de `MalformedExecutiveAIProvider`, Mission 160, REGRA 8) —
 * devolve um payload deliberadamente malformado, para provar que
 * `executeExecutiveChatAnalysis()` REJEITA.
 */
export class MalformedExecutiveChatProvider implements ExecutiveChatProvider {
  readonly providerName = "mission188-malformed-synthetic-chat-provider";
  private readonly malformedOutput: unknown;
  private readonly receivedAt: string;
  private _lastRequest: ExecutiveChatRequest | undefined;

  constructor(malformedOutput: unknown, receivedAt: string) {
    this.malformedOutput = malformedOutput;
    this.receivedAt = receivedAt;
  }

  get lastRequest(): ExecutiveChatRequest | undefined {
    return this._lastRequest;
  }

  async converse(request: ExecutiveChatRequest): Promise<ExecutiveAIResponse> {
    this._lastRequest = request;
    return { providerName: this.providerName, output: this.malformedOutput, receivedAt: this.receivedAt };
  }
}

/** Provider que sempre lança um `ExecutiveAIError` — para provar tratamento de falha de provider (Seção 26/38). */
export class FailingExecutiveChatProvider implements ExecutiveChatProvider {
  readonly providerName = "mission188-failing-synthetic-chat-provider";

  async converse(): Promise<ExecutiveAIResponse> {
    throw { code: "PROVIDER_UNAVAILABLE", message: "Falha simulada de provider.", providerName: this.providerName };
  }
}
