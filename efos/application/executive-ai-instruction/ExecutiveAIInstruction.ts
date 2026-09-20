import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";
import type { ExecutiveKnowledgeContext } from "@/efos/application/executive-knowledge-context";

/**
 * Objetivo explícito entregue a uma futura Executive AI (Mission 117
 * — Executive AI Prompt Contract, Etapa 6). Existe exatamente **um**
 * objetivo válido — nunca variável por chamada, nunca formulado para
 * pedir decisão/execução — ver `EXECUTIVE_AI_OBJECTIVE`, definido
 * mais abaixo neste mesmo arquivo.
 */
export interface ExecutiveAIObjective {
  readonly statement: string;
}

/**
 * Autoridade da IA, tornada estrutural (Etapa 7) — nunca apenas
 * linguagem humana em um README. Cada campo `may*`/`mustNot*` é um
 * literal `true` fechado (mesmo padrão de `DiagnosisBoundaries`,
 * D-059) — só existe **um** valor válido deste tipo, ver
 * `EXECUTIVE_AI_AUTHORITY`.
 */
export interface ExecutiveAIAuthority {
  readonly mayInterpret: true;
  readonly mayFormulateHypotheses: true;
  readonly mayAssessInferredRisk: true;
  readonly mayPrioritize: true;
  readonly maySuggestPossibleActions: true;
  readonly mayAskQuestions: true;
  readonly mayExpressUncertainty: true;
  readonly mayInterpretConflicts: true;
  readonly mustNotAlterFinancialTruth: true;
  readonly mustNotInventConfirmedFacts: true;
  readonly mustNotMakeDecisions: true;
  readonly mustNotExecuteActions: true;
  readonly mustNotProduceOutcomes: true;
}

/**
 * Contrato de saída esperado (Etapa 8) — reforça que a saída é
 * `ExecutiveDiagnosis` (D-059) e que ela é **untrusted até
 * validação**. `expectedShape`/`validatorName` são literais fechados
 * — nenhum formato paralelo de diagnóstico é representável aqui.
 */
export interface ExecutiveAIOutputContract {
  readonly expectedShape: "ExecutiveDiagnosis";
  readonly untrustedUntilValidated: true;
  readonly validatorName: "validateExecutiveDiagnosis";
}

/**
 * Vocabulário fechado de restrições (Etapa 9) — a nomenclatura dos 8
 * códigos é a sugerida pela missão; o comportamento (nunca inventar
 * fato, sempre distinguir fato de hipótese, sempre preservar
 * conflito, sempre usar base rastreável) é o que
 * `validateExecutiveAIInstruction()` garante estar sempre presente.
 */
export const EXECUTIVE_AI_CONSTRAINT_CODES = [
  "DO_NOT_INVENT_FACTS",
  "DO_NOT_RECLASSIFY_FACTS",
  "DO_NOT_MAKE_DECISIONS",
  "DO_NOT_EXECUTE_ACTIONS",
  "DISTINGUISH_FACT_FROM_HYPOTHESIS",
  "DECLARE_UNCERTAINTY",
  "PRESERVE_CONFLICTS",
  "USE_TRACEABLE_BASIS",
  // Mission 143 — Knowledge Injection into Executive Analysis (D-075).
  // 9 constraints novos, um por regra exigida pela Etapa 6 da missão —
  // sempre presentes, independente de `knowledgeContext` estar
  // presente/vazio nesta chamada (mesmo princípio de `authority`/
  // `outputContract`: o contrato da IA nunca varia por dado recebido,
  // só por design). Adicionados ao MESMO vocabulário fechado dos 8
  // constraints originais (nunca uma lista paralela) — aproveitam, sem
  // duplicação, a mesma enforcement de `validateExecutiveAIInstruction()`
  // (Cenário D: todo código em `EXECUTIVE_AI_CONSTRAINT_CODES` é
  // obrigatório) e o mesmo texto automático de `buildBaseSystemPrompt()`
  // (que já itera `instruction.constraints` inteiro, sem alteração
  // necessária).
  "HISTORICAL_KNOWLEDGE_IS_NOT_FINANCIAL_TRUTH",
  "DO_NOT_ALTER_FIGURES_WITH_KNOWLEDGE",
  "DO_NOT_PROVE_CAUSATION_FROM_KNOWLEDGE",
  "MAY_CONTEXTUALIZE_WITH_KNOWLEDGE",
  "KNOWLEDGE_MAY_BE_CONTRADICTED_BY_CURRENT_DATA",
  "CURRENT_DATA_TAKES_PRECEDENCE_OVER_KNOWLEDGE",
  "ABSENCE_OF_KNOWLEDGE_NEVER_BLOCKS_ANALYSIS",
  "DO_NOT_PRESENT_KNOWLEDGE_AS_CURRENT_FACT",
  "DISTINGUISH_FACT_INTERPRETATION_PATTERN_AND_HISTORICAL_PATTERN",
  // Mission 147 — Knowledge-Aware Executive Intelligence (D-079).
  // 4 constraints novos, respondendo à lacuna real identificada pela
  // auditoria obrigatória (Etapa 1.F): antes desta missão, nenhum
  // KnowledgeState (D-078) chegava à IA — um Knowledge WEAKENED e um
  // Knowledge SUPPORTED eram estruturalmente indistinguíveis no prompt.
  // Adicionados ao MESMO vocabulário fechado dos constraints anteriores
  // (nunca uma lista paralela) — mesma enforcement de
  // `validateExecutiveAIInstruction()` e mesmo texto automático de
  // `buildBaseSystemPrompt()`, sem alteração de lógica necessária.
  "RESPECT_KNOWLEDGE_STATE_IN_INTERPRETATION",
  "TREAT_MIXED_KNOWLEDGE_STATE_AS_CONFLICTING_EVIDENCE",
  "TREAT_WEAKENED_KNOWLEDGE_STATE_AS_REDUCED_CONFIDENCE",
  "DO_NOT_TREAT_KNOWLEDGE_STATE_AS_CERTAINTY",
  // Mission 172 — Integrate Financial Episode Intelligence into
  // ExecutiveFinancialContext. 4 constraints novos, um por regra
  // exigida pela Etapa 10/11 da missão — sempre presentes,
  // independente de `context.financialEpisodes` estar presente/ausente
  // nesta chamada (mesmo princípio dos constraints anteriores).
  // Adicionados ao MESMO vocabulário fechado (nunca uma lista
  // paralela) — aproveitam, sem duplicação, a mesma enforcement de
  // `validateExecutiveAIInstruction()` (Cenário D) e o mesmo texto
  // automático de `buildBaseSystemPrompt()`.
  "FINANCIAL_EPISODE_STATE_IS_DETERMINISTIC_CONTEXT",
  "DO_NOT_REINTERPRET_SUSTAINED_IMPROVEMENT_AS_RECOVERY",
  "DO_NOT_REINTERPRET_NOT_DETERMINABLE_EPISODE_AS_HEALTHY",
  "DO_NOT_CLAIM_UNSUPPORTED_EPISODE_STATES",
] as const;

export type ExecutiveAIConstraintCode = (typeof EXECUTIVE_AI_CONSTRAINT_CODES)[number];

export interface ExecutiveAIConstraint {
  readonly code: ExecutiveAIConstraintCode;
  readonly description: string;
}

/**
 * `ExecutiveAIInstruction` (Mission 117 — Executive AI Prompt
 * Contract). Representação **controlada** de um `ExecutiveFinancialContext`
 * (D-058) para uma futura Executive AI — nunca uma nova fonte de
 * verdade (`Financial Truth ≠ Prompt ≠ AI Interpretation`), nunca uma
 * mega string de prompt textual (Etapa 13 — proibido explicitamente
 * misturar contrato/instrução/serialização/fornecedor/texto humano
 * num único template literal). Uma futura camada de provider serializa
 * esta estrutura para o formato que seu SDK exigir — este contrato
 * nunca assume nenhum formato de fornecedor específico.
 *
 * `context` é a mesma referência de `ExecutiveFinancialContext`
 * recebida — nunca transformado, nunca reinterpretado
 * (`buildExecutiveAIInstruction()`, Etapa 12: `financialTruth` é
 * tratado como somente leitura; `unknowns`/`conflicts` chegam à IA
 * exatamente como o Engine os produziu, nunca convertidos em
 * zero/negativo/falso).
 *
 * `knowledgeContext?: ExecutiveKnowledgeContext` (Mission 143 —
 * Knowledge Injection into Executive Analysis, D-075) — bloco
 * SEPARADO de `context` (Financial Truth), NUNCA fundido nele
 * (proibido explicitamente pela Etapa 1.D da missão: nunca
 * `ExecutiveFinancialContext & { knowledge: Knowledge[] }`). Opcional
 * porque a ausência de `Knowledge` nunca bloqueia a análise (Etapa 7)
 * — quando omitido, o comportamento é idêntico ao de antes desta
 * missão, byte a byte. Mesma referência recebida, nunca transformado
 * (mesmo princípio de `context` acima).
 */
export interface ExecutiveAIInstruction {
  readonly instructionId: string;
  readonly context: ExecutiveFinancialContext;
  readonly knowledgeContext?: ExecutiveKnowledgeContext;
  readonly objective: ExecutiveAIObjective;
  readonly authority: ExecutiveAIAuthority;
  readonly outputContract: ExecutiveAIOutputContract;
  readonly constraints: readonly ExecutiveAIConstraint[];
}

/**
 * Único objetivo válido — nunca pede decisão/execução/aprovação/
 * alteração de dado financeiro, por texto e por construção (o
 * validator rejeita qualquer `statement` que contenha essas
 * palavras, mas esta constante já nasce em conformidade).
 */
export const EXECUTIVE_AI_OBJECTIVE: ExecutiveAIObjective = {
  statement:
    "Analyze the executive financial context and produce a structured executive diagnosis.",
};

/** Única instância válida de `ExecutiveAIAuthority`. */
export const EXECUTIVE_AI_AUTHORITY: ExecutiveAIAuthority = {
  mayInterpret: true,
  mayFormulateHypotheses: true,
  mayAssessInferredRisk: true,
  mayPrioritize: true,
  maySuggestPossibleActions: true,
  mayAskQuestions: true,
  mayExpressUncertainty: true,
  mayInterpretConflicts: true,
  mustNotAlterFinancialTruth: true,
  mustNotInventConfirmedFacts: true,
  mustNotMakeDecisions: true,
  mustNotExecuteActions: true,
  mustNotProduceOutcomes: true,
};

/** Única instância válida de `ExecutiveAIOutputContract`. */
export const EXECUTIVE_AI_OUTPUT_CONTRACT: ExecutiveAIOutputContract = {
  expectedShape: "ExecutiveDiagnosis",
  untrustedUntilValidated: true,
  validatorName: "validateExecutiveDiagnosis",
};

const CONSTRAINT_DESCRIPTIONS: Readonly<Record<ExecutiveAIConstraintCode, string>> = {
  DO_NOT_INVENT_FACTS:
    "Never state a confirmed fact that is not directly present in the provided context.",
  DO_NOT_RECLASSIFY_FACTS:
    "Never reinterpret a confirmed/derived fact as something it is not (e.g. never turn an unavailable indicator into a zero value).",
  DO_NOT_MAKE_DECISIONS:
    "Never produce a Decision — decisions remain exclusively human/deterministic (D-011).",
  DO_NOT_EXECUTE_ACTIONS:
    "Never execute, approve, or reject anything — only suggest possible actions for human consideration.",
  DISTINGUISH_FACT_FROM_HYPOTHESIS:
    "Always keep interpretations and hypotheses clearly separate from confirmed facts.",
  DECLARE_UNCERTAINTY:
    "Always declare explicitly what cannot be concluded, instead of omitting it.",
  PRESERVE_CONFLICTS:
    "Never resolve a conflict by discarding one of the coexisting signals — interpret without erasing either side.",
  USE_TRACEABLE_BASIS:
    "Every interpretation, hypothesis, priority, and possible action must reference real elements of the provided context — including, when relevant and present, historical knowledge identifiers from knowledgeContext (Mission 148, D-080).",
  // Mission 143 — Knowledge Injection into Executive Analysis (D-075).
  // Um constraint por regra da Etapa 6 da missão, na mesma ordem.
  HISTORICAL_KNOWLEDGE_IS_NOT_FINANCIAL_TRUTH:
    "The optional knowledgeContext, when present, is historical context derived from this company's own past decisions — it is never Financial Truth, never a confirmed current fact, and never part of the financial data you must reason over as ground truth.",
  DO_NOT_ALTER_FIGURES_WITH_KNOWLEDGE:
    "Never use knowledgeContext to alter, adjust, round, or reinterpret any indicator, metric, or figure from context.financialTruth — historical knowledge never changes a number.",
  DO_NOT_PROVE_CAUSATION_FROM_KNOWLEDGE:
    "Never state or imply that a historical pattern in knowledgeContext proves, guarantees, or causes any current or future result — a recurring pattern is evidence of association only, never of causation.",
  MAY_CONTEXTUALIZE_WITH_KNOWLEDGE:
    "You may use knowledgeContext to contextualize the current situation, note recurring patterns, or flag points of attention grounded in this company's own history.",
  KNOWLEDGE_MAY_BE_CONTRADICTED_BY_CURRENT_DATA:
    "A historical pattern in knowledgeContext may be contradicted by the current financial data — when that happens, say so explicitly instead of silently favoring the historical pattern.",
  CURRENT_DATA_TAKES_PRECEDENCE_OVER_KNOWLEDGE:
    "Whenever historical knowledge and current financial data appear to conflict, current financial data always takes precedence in your analysis.",
  ABSENCE_OF_KNOWLEDGE_NEVER_BLOCKS_ANALYSIS:
    "The absence of knowledgeContext, or knowledgeContext.selectionOutcome being NO_RELEVANT_KNOWLEDGE, never blocks, degrades, or excuses your analysis — proceed normally using only context (Financial Truth).",
  DO_NOT_PRESENT_KNOWLEDGE_AS_CURRENT_FACT:
    "Never present an item from knowledgeContext as if it were a current financial fact, indicator, evidence, or metric — always attribute it explicitly as historical/past pattern.",
  DISTINGUISH_FACT_INTERPRETATION_PATTERN_AND_HISTORICAL_PATTERN:
    "Always keep four things distinct in your output: confirmed financial fact (context.financialTruth), your executive interpretation, a deterministic pattern already produced by the engines (context.deterministicIntelligence), and a historical pattern from knowledgeContext.",
  // Mission 147 — Knowledge-Aware Executive Intelligence (D-079).
  // Um constraint por regra da Etapa 7/9 da missão, na mesma ordem.
  RESPECT_KNOWLEDGE_STATE_IN_INTERPRETATION:
    "When knowledgeContext.states is present, each entry describes the current historical lifecycle state (EMERGING, INSUFFICIENT, SUPPORTED, WEAKENED, or MIXED) of the matching item in knowledgeContext.knowledge (matched by knowledgeId). Never reason about a historical pattern while ignoring its state — always take it into account.",
  TREAT_MIXED_KNOWLEDGE_STATE_AS_CONFLICTING_EVIDENCE:
    "A knowledge item whose state is MIXED has genuinely conflicting historical evidence (both reinforcing and contradicting observations) — never present it as an established pattern; describe it explicitly as historically inconsistent.",
  TREAT_WEAKENED_KNOWLEDGE_STATE_AS_REDUCED_CONFIDENCE:
    "A knowledge item whose state is WEAKENED has only been contradicted by more recent evidence, never reinforced since — treat it as a pattern of reduced historical confidence, never with the same weight as a SUPPORTED item.",
  DO_NOT_TREAT_KNOWLEDGE_STATE_AS_CERTAINTY:
    "Never convert a knowledge state (EMERGING, INSUFFICIENT, SUPPORTED, WEAKENED, MIXED) into a binary true/false, a confirmed cause, or a guarantee — these states describe historical evidence strength only, never certainty.",
  // Mission 172 — Integrate Financial Episode Intelligence into
  // ExecutiveFinancialContext (D-087/D-088).
  FINANCIAL_EPISODE_STATE_IS_DETERMINISTIC_CONTEXT:
    "When present, context.financialEpisodes is deterministic EFOS-derived context, one entry per supported metric (never your own reconstruction from raw Evidence history) — treat each entry's `state` as a given fact about that metric's episode, never re-derive or second-guess it from context.evidence directly.",
  DO_NOT_REINTERPRET_SUSTAINED_IMPROVEMENT_AS_RECOVERY:
    "A financial episode with state SUSTAINED_IMPROVEMENT describes a favorable trend only — never describe it as recovery, resolution of a prior problem, or normalization of financial health, even when a prior adverse episode for the same metric is known to you from other context.",
  DO_NOT_REINTERPRET_NOT_DETERMINABLE_EPISODE_AS_HEALTHY:
    "A financial episode with state NOT_DETERMINABLE means the available data is insufficient, conflicting, or incompatible for a reliable classification — never describe it as healthy, stable, resolved, or as an absence of a problem; explicitly state that the episode state could not be determined.",
  DO_NOT_CLAIM_UNSUPPORTED_EPISODE_STATES:
    "The only financial episode states EFOS currently supports are NEW_DETERIORATION, CONTINUING_DETERIORATION, SUSTAINED_IMPROVEMENT, and NOT_DETERMINABLE — never claim, imply, or invent a partial recovery, full recovery, or recurrence state for any metric; those concepts are not yet supported by the underlying architecture (D-088).",
};

/**
 * Conjunto fixo dos 8 constraints obrigatórios — sempre os mesmos,
 * sempre todos presentes (`validateExecutiveAIInstruction()` rejeita
 * qualquer instrução que omita algum, Etapa 15/Cenário D).
 */
export const EXECUTIVE_AI_CONSTRAINTS: readonly ExecutiveAIConstraint[] =
  EXECUTIVE_AI_CONSTRAINT_CODES.map((code) => ({
    code,
    description: CONSTRAINT_DESCRIPTIONS[code],
  }));
