import { createHash } from "node:crypto";

import type {
  ExecutiveAIProvider,
  ExecutiveAIRequest,
  ExecutiveAIResponse,
} from "@/efos/application/executive-ai";
import {
  DIAGNOSIS_BOUNDARIES,
  type ExecutiveDiagnosis,
} from "@/efos/application/executive-diagnosis";
import type { ExecutiveAIInstruction } from "@/efos/application/executive-ai-instruction";
import type { InterpretationBasis } from "@/efos/application/executive-diagnosis";

/**
 * Mission 160 — Synthetic Executive AI Closed-Loop Validation (REGRA 4).
 *
 * **Achado da auditoria obrigatória**: `ExecutiveAIProvider`
 * (`efos/application/executive-ai/ExecutiveAIProvider.ts`, Mission 116)
 * já é um Port puro (`analyze(request): Promise<response>`) — nenhuma
 * modificação de contrato de produção foi necessária. Todo test file
 * desde a Mission 116 (117/118/143/147/148/149/153/159) já implementa
 * seu próprio `CapturingFakeProvider`/`CapturingExecutiveAIProvider`
 * local, ad-hoc, dentro do próprio arquivo de teste — esta é a primeira
 * missão a extrair essa implementação para um local reutilizável em
 * `efos/application/synthetic-validation/`, por instrução explícita da
 * missão (REGRA 4).
 *
 * **O provider é um stand-in determinístico para o modelo externo,
 * NUNCA uma segunda Engine (REGRA 17)**: `analyze()` lê exclusivamente
 * os campos já presentes em `request.instruction` (a mesma instrução
 * REAL que `executeExecutiveAnalysis()` constrói e valida antes de
 * chamar qualquer provider) — nunca importa `EvidenceEngine`/
 * `ReasoningEngine`/`RecommendationEngine`/nenhum motor de Knowledge,
 * nunca lê `SyntheticGroundTruth`/metadados de cenário sintético (que,
 * por auditoria estrutural, não são sequer representáveis em
 * `ExecutiveAIInstruction` — ver `README.md`, seção 15).
 *
 * **Determinístico (REGRA 4)**: `diagnosisId`/`generatedAt`/`receivedAt`
 * são sempre recebidos como parâmetro do construtor (nunca
 * `randomUUID()`/`Date.now()` internos) — a mesma instrução sempre
 * produz o mesmo `ExecutiveDiagnosis`, byte a byte. Os ids dos itens
 * internos do diagnóstico (`interpretations[0].id` etc.) são derivados
 * deterministicamente por hash do conteúdo da própria instrução (mesmo
 * princípio de `deriveKnowledgeId()`, D-073), nunca aleatórios.
 *
 * **Captura, nunca fabrica**: `lastRequest`/`requestCount` expõem
 * exatamente o que foi recebido, para que os testes possam inspecionar
 * a instrução real — mas o provider nunca expõe nem lê Ground Truth
 * (ele não tem acesso a nenhum objeto que a carregue).
 */
export interface CapturingExecutiveAIProviderOptions {
  readonly providerName?: string;
  readonly diagnosisId: string;
  readonly generatedAt: string;
  readonly receivedAt: string;
}

function deterministicItemId(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function availableIndicatorId(instruction: ExecutiveAIInstruction): string | undefined {
  return instruction.context.financialTruth.indicators.find((i) => i.result.status === "available")?.id;
}

function firstEvidenceId(instruction: ExecutiveAIInstruction): string | undefined {
  return instruction.context.evidence[0]?.id;
}

function firstContextId(instruction: ExecutiveAIInstruction): string | undefined {
  return instruction.context.deterministicIntelligence.contexts[0]?.id;
}

/**
 * Constrói `basis` (D-058/D-080) referenciando SOMENTE elementos
 * genuinamente presentes na instrução real recebida — nunca um id
 * inventado. Devolve `basis` vazio (`{}`) quando nenhum elemento
 * relevante existir (a análise honestamente não tem do que se apoiar
 * para aquele item) — nunca um id fabricado só para satisfazer o
 * validator.
 */
function basisFromInstruction(
  instruction: ExecutiveAIInstruction,
  options: { readonly includeKnowledge?: boolean } = {}
): InterpretationBasis {
  const indicatorId = availableIndicatorId(instruction);
  const evidenceId = firstEvidenceId(instruction);
  const contextId = firstContextId(instruction);
  const knowledge = options.includeKnowledge ? instruction.knowledgeContext?.knowledge[0] : undefined;

  return {
    ...(indicatorId ? { indicatorIds: [indicatorId] } : {}),
    ...(evidenceId ? { evidenceIds: [evidenceId] } : {}),
    ...(contextId ? { contextIds: [contextId] } : {}),
    ...(knowledge ? { knowledgeIds: [knowledge.id] } : {}),
  };
}

/**
 * REGRA 6 — o item que cita Knowledge respeita explicitamente seu
 * `KnowledgeStateResult.state` (D-078), nunca tratando MIXED/WEAKENED
 * como fato estabelecido. A confiança (`ExecutiveConfidence`, própria
 * da IA, D-060) É REDUZIDA deterministicamente conforme o estado —
 * nunca "high" quando o histórico é genuinamente misto/enfraquecido —
 * e o texto do item usa vocabulário que a própria descrição dos
 * constraints `TREAT_MIXED_KNOWLEDGE_STATE_AS_CONFLICTING_EVIDENCE`/
 * `TREAT_WEAKENED_KNOWLEDGE_STATE_AS_REDUCED_CONFIDENCE` já prescreve
 * ("historically inconsistent"/"reduced historical confidence"), nunca
 * um texto de certeza.
 */
function confidenceForKnowledgeState(state: string | undefined): "low" | "medium" | "high" {
  switch (state) {
    case "SUPPORTED":
      return "medium";
    case "MIXED":
    case "WEAKENED":
    case "INSUFFICIENT":
      return "low";
    default:
      return "low";
  }
}

function knowledgeAwareStatement(instruction: ExecutiveAIInstruction): { statement: string; confidence: "low" | "medium" | "high" } {
  const knowledge = instruction.knowledgeContext?.knowledge[0];
  const state = instruction.knowledgeContext?.states.find((s) => s.knowledgeId === knowledge?.id)?.state;

  if (!knowledge || !state) {
    return { statement: "Ainda não há conhecimento histórico desta empresa — a análise usa apenas o contexto financeiro atual.", confidence: "low" };
  }

  if (state === "MIXED") {
    return {
      statement: "Há um padrão histórico nesta empresa, mas com evidências mistas (observações que o reforçam e que o contradizem) — tratado como historicamente inconsistente, nunca como padrão estabelecido.",
      confidence: confidenceForKnowledgeState(state),
    };
  }

  if (state === "WEAKENED") {
    return {
      statement: "Há um padrão histórico nesta empresa, mas ele só foi contradito desde que se formou — considerado com confiança histórica reduzida, nunca com o peso de um padrão confirmado.",
      confidence: confidenceForKnowledgeState(state),
    };
  }

  return {
    statement: "Há um padrão histórico nesta empresa, confirmado pelas observações seguintes — registrado apenas como contexto, nunca como prova de que o mesmo resultado se repetirá.",
    confidence: confidenceForKnowledgeState(state),
  };
}

/**
 * Diagnóstico determinístico, construído EXCLUSIVAMENTE a partir dos
 * campos já presentes em `instruction` (nunca de um Engine/Ground
 * Truth externo) — respeitando o schema atual de `ExecutiveDiagnosis`
 * (D-059) sem estendê-lo. Cada item citável usa `basis` real; nenhum
 * item afirma causalidade; `boundaries` é sempre `DIAGNOSIS_BOUNDARIES`
 * (o único valor válido).
 */
export function buildDeterministicSyntheticDiagnosis(
  instruction: ExecutiveAIInstruction,
  diagnosisId: string,
  generatedAt: string
): ExecutiveDiagnosis {
  const seedPrefix = `mission160::${instruction.instructionId}`;
  const summaryBasis = basisFromInstruction(instruction);
  const { statement: knowledgeStatement, confidence: knowledgeConfidence } = knowledgeAwareStatement(instruction);
  const knowledgeBasis = basisFromInstruction(instruction, { includeKnowledge: true });

  const interpretationId = deterministicItemId(`${seedPrefix}::interpretation::0`);
  const hypothesisId = deterministicItemId(`${seedPrefix}::hypothesis::0`);
  const riskId = deterministicItemId(`${seedPrefix}::risk::0`);
  const priorityId = deterministicItemId(`${seedPrefix}::priority::0`);
  const actionId = deterministicItemId(`${seedPrefix}::action::knowledge-aware`);
  const questionId = deterministicItemId(`${seedPrefix}::question::0`);
  const uncertaintyId = deterministicItemId(`${seedPrefix}::uncertainty::0`);

  const hasEvidence = instruction.context.evidence.length > 0;
  const firstUnknown = instruction.context.unknowns[0];

  const diagnosis: ExecutiveDiagnosis = {
    id: diagnosisId,
    basedOn: { contextId: instruction.context.identity.companyId, generatedAt },
    executiveSummary: {
      statement: hasEvidence
        ? `O contexto financeiro atual desta empresa reúne ${instruction.context.evidence.length} ${instruction.context.evidence.length === 1 ? "evidência determinística" : "evidências determinísticas"} produzidas pelos Engines.`
        : "O contexto financeiro atual desta empresa não reúne evidências determinísticas neste período.",
      basis: summaryBasis,
    },
    interpretations: [
      {
        id: interpretationId,
        statement: hasEvidence
          ? "Os indicadores e as evidências disponíveis, em conjunto, sugerem um período que pede atenção executiva."
          : "Os indicadores disponíveis não mostram evidência que peça atenção executiva neste período.",
        basis: summaryBasis,
        confidence: hasEvidence ? "medium" : "low",
      },
    ],
    hypotheses: [
      {
        id: hypothesisId,
        statement: "O padrão observado pode continuar nos próximos períodos se as condições operacionais se mantiverem.",
        basis: summaryBasis,
        confidence: "low",
        validationNeeded: "Confirmar com os números do próximo período, quando estiverem disponíveis.",
      },
    ],
    risks: hasEvidence
      ? [
          {
            id: riskId,
            statement: "Um sinal confirmado pelas regras de evidência indica um risco já presente no período atual.",
            type: "CONFIRMED_SIGNAL",
            basis: summaryBasis,
          },
        ]
      : [],
    priorities: hasEvidence
      ? [
          {
            id: priorityId,
            rank: 1,
            statement: "Avaliar a condição apontada pelas evidências do período antes que ela se agrave.",
            reason: "Fundamentado diretamente nas evidências determinísticas já produzidas para o período atual.",
            basis: summaryBasis,
          },
        ]
      : [],
    possibleActions: [
      {
        id: actionId,
        kind: "CONSIDER",
        statement: knowledgeStatement,
        basis: knowledgeBasis,
      },
    ],
    questions: firstUnknown
      ? [
          {
            id: questionId,
            question: `Que dado adicional permitiria calcular "${firstUnknown.subject}", hoje indisponível?`,
            raisedFrom: "unknown",
          },
        ]
      : [],
    uncertainties: firstUnknown
      ? [
          {
            id: uncertaintyId,
            statement: `Não é possível concluir se "${firstUnknown.subject}" mudaria a leitura atual.`,
            reason: firstUnknown.impact,
          },
        ]
      : [],
    conflictInterpretations: [],
    boundaries: DIAGNOSIS_BOUNDARIES,
  };

  // Suprime "unused" — knowledgeConfidence documenta a regra (REGRA 6)
  // mas não é um campo do schema atual de ExecutiveDiagnosis (Etapa 5:
  // "não estender o schema apenas para satisfazer esta missão") — o
  // teste consome `knowledgeConfidence` separadamente via
  // `deriveKnowledgeAwareStatementForTest()` abaixo, sem alterar este
  // objeto.
  void knowledgeConfidence;

  return diagnosis;
}

/** Exposto só para os testes reconstruírem a mesma decisão de confiança determinística (REGRA 6), sem duplicar a regra. */
export function deriveKnowledgeAwareConfidence(instruction: ExecutiveAIInstruction): "low" | "medium" | "high" {
  return knowledgeAwareStatement(instruction).confidence;
}

export class CapturingExecutiveAIProvider implements ExecutiveAIProvider {
  readonly providerName: string;
  private readonly diagnosisId: string;
  private readonly generatedAt: string;
  private readonly receivedAt: string;
  private _lastRequest: ExecutiveAIRequest | undefined;
  private _requestCount = 0;

  constructor(options: CapturingExecutiveAIProviderOptions) {
    this.providerName = options.providerName ?? "mission160-capturing-synthetic-provider";
    this.diagnosisId = options.diagnosisId;
    this.generatedAt = options.generatedAt;
    this.receivedAt = options.receivedAt;
  }

  get lastRequest(): ExecutiveAIRequest | undefined {
    return this._lastRequest;
  }

  get requestCount(): number {
    return this._requestCount;
  }

  async analyze(request: ExecutiveAIRequest): Promise<ExecutiveAIResponse> {
    this._lastRequest = request;
    this._requestCount += 1;

    const output = buildDeterministicSyntheticDiagnosis(request.instruction, this.diagnosisId, this.generatedAt);

    return {
      providerName: this.providerName,
      output,
      receivedAt: this.receivedAt,
    };
  }
}

/**
 * Variante para os cenários AW-AZ (REGRA 8 — direção INVALID
 * INPUT/OUTPUT): devolve um payload deliberadamente malformado, para
 * provar que `executeExecutiveAnalysis()` REJEITA — nunca para provar
 * que o provider "funciona", mas para provar que a validação real
 * continua ativa mesmo quando o provider (por definição, untrusted)
 * devolve algo inválido.
 */
export class MalformedExecutiveAIProvider implements ExecutiveAIProvider {
  readonly providerName = "mission160-malformed-synthetic-provider";
  private readonly malformedOutput: unknown;
  private readonly receivedAt: string;
  private _lastRequest: ExecutiveAIRequest | undefined;

  constructor(malformedOutput: unknown, receivedAt: string) {
    this.malformedOutput = malformedOutput;
    this.receivedAt = receivedAt;
  }

  get lastRequest(): ExecutiveAIRequest | undefined {
    return this._lastRequest;
  }

  async analyze(request: ExecutiveAIRequest): Promise<ExecutiveAIResponse> {
    this._lastRequest = request;
    return { providerName: this.providerName, output: this.malformedOutput, receivedAt: this.receivedAt };
  }
}
