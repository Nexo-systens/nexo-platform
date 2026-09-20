import type { ExecutiveAIInstruction } from "@/efos/application/executive-ai-instruction";

/**
 * Nome da tool (structured output) que o modelo deve chamar para
 * produzir seu diagnóstico (Etapa 7) — compartilhado com
 * `executiveDiagnosisToolSchema.ts` para nunca divergir do texto do
 * prompt.
 *
 * Mission 136 — mantida exatamente como estava (nunca usada pelo
 * fluxo de produção desde esta missão, que passa a gerar em 2
 * chamadas separadas — ver `SUBMIT_EXECUTIVE_DIAGNOSIS_CORE_TOOL_NAME`/
 * `SUBMIT_EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL_NAME` abaixo) —
 * preservada por compatibilidade com testes históricos (Missions
 * 118-135) que a referenciam diretamente, e como ponto de referência
 * caso uma tool única volte a ser viável no futuro.
 */
export const SUBMIT_EXECUTIVE_DIAGNOSIS_TOOL_NAME = "submit_executive_diagnosis";

/**
 * Mission 136 — Etapa 2/3: a Mission 135 confirmou, com evidência ao
 * vivo, que uma única tool `strict` cobrindo os 9 campos completos de
 * `ExecutiveDiagnosis` excede o limite de "compiled grammar" da
 * Anthropic mesmo após redução real de complexidade (D-068). A
 * geração passa a ser dividida em 2 chamadas `strict` sequenciais —
 * o DOMÍNIO continua único (`ExecutiveDiagnosis`, D-059, nunca
 * dividido), só a ESTRATÉGIA DE GERAÇÃO do provider muda.
 *
 * **Stage "core"** — a síntese executiva e o que é acionável/
 * confirmado: `executiveSummary`, `interpretations`, `risks`,
 * `priorities`, `possibleActions`.
 * **Stage "interpretation"** — a camada epistêmica/exploratória:
 * `hypotheses`, `questions`, `uncertainties`, `conflictInterpretations`.
 */
export const SUBMIT_EXECUTIVE_DIAGNOSIS_CORE_TOOL_NAME = "submit_executive_diagnosis_core";
export const SUBMIT_EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL_NAME = "submit_executive_diagnosis_interpretation";

export type ExecutiveAIGenerationStage = "core" | "interpretation";

/**
 * Núcleo compartilhado de `buildExecutiveAISystemPrompt()`/
 * `buildExecutiveAIStageSystemPrompt()` (Mission 136) — nunca duplica
 * manualmente o texto de `objective`/`authority`/`constraints` já
 * definidos em `ExecutiveAIInstruction` (D-061): lê esses campos
 * diretamente da instrução recebida, para que o prompt nunca possa
 * divergir silenciosamente do contrato estrutural que ele descreve.
 * Função pura — nenhuma chamada de rede, nenhum SDK.
 *
 * Reforça, em texto, exatamente o que `ExecutiveAIAuthority`/
 * `ExecutiveAIConstraint[]` já afirmam estruturalmente (Mission 117):
 * a IA não é a fonte de verdade financeira, não pode inventar fato/
 * documento/evento/causa confirmada/decisão/execução, deve declarar
 * incerteza em vez de omiti-la, e deve preservar (nunca resolver)
 * conflitos — **idêntico entre as 2 chamadas** (Mission 136), nunca
 * relaxado/alterado por stage, para que autoridade e epistemologia
 * (D-059/D-061) sejam garantidas de forma consistente
 * independentemente de qual parte do diagnóstico está sendo gerada.
 */
function buildBaseSystemPrompt(instruction: ExecutiveAIInstruction, toolName: string, stageNote?: string): string {
  const authorityLines = Object.entries(instruction.authority)
    .map(([key, value]) => `- ${key}: ${String(value)}`)
    .join("\n");

  const constraintLines = instruction.constraints
    .map((constraint) => `- ${constraint.code}: ${constraint.description}`)
    .join("\n");

  return [
    "You are the Executive Intelligence Layer of the EFOS (Executive Financial Operating System).",
    "",
    "You are not the source of financial truth. The financial data provided to you in the user message is the factual basis, already calculated and validated by a deterministic financial engine outside your control — you never recalculate, round, or override any of it.",
    "",
    // Mission 143 — Knowledge Injection into Executive Analysis (D-075).
    // Explica, sempre, o significado das 2 chaves de topo do JSON do
    // user message — presente independentemente de knowledgeContext
    // existir nesta chamada (mesmo princípio de authority/outputContract:
    // o texto do prompt nunca varia por dado recebido). "when present"
    // é honesto nas duas direções — nunca afirma que knowledgeContext
    // sempre existe.
    'The JSON payload in the user message has two top-level keys relevant here: "context" (Financial Truth — the current, canonical, deterministic financial data described above, always authoritative) and, when present, "knowledgeContext" (Historical Knowledge — patterns already observed from this same company\'s own past, independent decisions, already filtered by company and time by a separate deterministic mechanism before reaching you). These two blocks are never the same thing and must never be merged in your reasoning or your output.',
    "",
    // Mission 147 — Knowledge-Aware Executive Intelligence (D-079).
    // Explica o array irmão knowledgeContext.states, sempre presente
    // quando knowledgeContext existir (mesmo princípio de
    // authority/outputContract: texto nunca varia por dado recebido).
    'When present, "knowledgeContext" also carries a "states" array — one entry per item in "knowledgeContext.knowledge", matched by "knowledgeId", each describing that item\'s current historical lifecycle state: EMERGING (never yet evaluated against new evidence), INSUFFICIENT (evaluated, but with no reinforcing or contradicting signal), SUPPORTED (reinforced by historical evidence, never contradicted), WEAKENED (contradicted by more recent evidence, never reinforced since), or MIXED (both reinforcing and contradicting evidence coexist). These states describe historical evidence strength only — never treat them as true/false, as a confirmed cause, or as a guarantee of any future result.',
    "",
    // Mission 148 — Knowledge-Conditioned Executive Decision
    // Intelligence (D-080). Explica o 5º prefixo de basis, sempre
    // presente no texto (mesmo princípio de authority/outputContract).
    'Your `basis` fields may cite a "knowledge:<id>" reference (alongside "indicator:<id>", "evidence:<id>", "context:<id>", "conflict:<id>") when an interpretation, priority, or possible action was genuinely informed by an item in "knowledgeContext.knowledge" — this is how you ground a recommendation in both current financial data and historical context at once. Citing "knowledge:<id>" only means you considered that pattern, never that it is a confirmed cause or guarantee of the outcome — and you must still respect that item\'s state (from "knowledgeContext.states"): never give a WEAKENED or MIXED knowledge item the same weight as current financial data or as a SUPPORTED item, and never let historical knowledge override what "context" (Financial Truth) currently shows.',
    "",
    // Mission 172 — Integrate Financial Episode Intelligence into
    // ExecutiveFinancialContext. Explica "context.financialEpisodes",
    // sempre presente no texto (mesmo princípio de authority/
    // outputContract: texto nunca varia por dado recebido), mas
    // deixando claro que o CAMPO em si pode estar ausente.
    'When present, "context" also carries a "financialEpisodes" array — one deterministic, EFOS-derived entry per supported metric (gross margin, operating margin, net margin, current liquidity, quick liquidity, immediate liquidity, average receipt period, operating cash flow), each with a `state`: NEW_DETERIORATION (a newly emerging adverse trend for that metric, with no prior open episode), CONTINUING_DETERIORATION (an adverse trend continuing from an already-open episode), SUSTAINED_IMPROVEMENT (a favorable trend, proven only for the trend itself — never recovery), or NOT_DETERMINABLE (the available data is insufficient, conflicting, or incompatible for a reliable classification, always paired with a `determinabilityReason`). These states are already derived for you — never reconstruct them yourself from context.evidence, and never claim a partial recovery, full recovery, or recurrence state, since those are not yet supported by EFOS for any metric.',
    "",
    `Objective: ${instruction.objective.statement}`,
    "",
    "Your authority is fixed and structural — every field below is exactly as granted, nothing more:",
    authorityLines,
    "",
    "You must always respect the following constraints:",
    constraintLines,
    "",
    `Your output must conform to the shape "${instruction.outputContract.expectedShape}". It is treated as untrusted and will be validated by "${instruction.outputContract.validatorName}" before being used for anything — nothing you produce is accepted without that validation.`,
    "",
    "Specifically, and without exception:",
    "- Never invent values, documents, events, confirmed causes, confirmed causal relationships, decisions, or executed actions.",
    '- Every indicator marked as "unavailable" (unknown) in the provided context must remain unknown in your output — never convert it into zero, false, or any other confirmed value.',
    "- Every conflict preserved in the provided context must remain a coexisting, unresolved conflict in your output — never discard or silently resolve one side in favor of the other.",
    "- Every interpretation, hypothesis, risk, priority, and possible action you produce must reference real elements of the provided context (indicator, evidence, context, or conflict identifiers) — never a free-floating claim.",
    ...(stageNote ? [stageNote] : []),
    `- Respond exclusively by calling the "${toolName}" tool with your structured diagnosis. Do not respond in plain text.`,
  ].join("\n");
}

/**
 * Constrói o texto de sistema enviado ao modelo (Mission 118, Etapa 6)
 * — mantida byte-a-byte idêntica ao comportamento anterior à Mission
 * 136 (delega para `buildBaseSystemPrompt()` sem `stageNote`, mesmo
 * `toolName` de sempre). Preservada por compatibilidade com testes
 * históricos; não é mais usada por `AnthropicExecutiveAIProvider` em
 * produção desde esta missão.
 */
export function buildExecutiveAISystemPrompt(instruction: ExecutiveAIInstruction): string {
  return buildBaseSystemPrompt(instruction, SUBMIT_EXECUTIVE_DIAGNOSIS_TOOL_NAME);
}

/**
 * Mission 136 — variante usada pelo fluxo de produção de 2 chamadas.
 * `stage` decide qual tool o modelo deve chamar e adiciona uma nota
 * explícita informando qual metade do diagnóstico está sendo pedida
 * nesta chamada específica — nunca uma instrução que amplia
 * autoridade, só delimita escopo de campos.
 */
export function buildExecutiveAIStageSystemPrompt(
  instruction: ExecutiveAIInstruction,
  stage: ExecutiveAIGenerationStage
): string {
  const toolName =
    stage === "core" ? SUBMIT_EXECUTIVE_DIAGNOSIS_CORE_TOOL_NAME : SUBMIT_EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL_NAME;
  const stageNote =
    stage === "core"
      ? "- This call produces ONLY the core/actionable portion of the executive diagnosis: executiveSummary, interpretations, risks, priorities, and possibleActions. A second, separate call will produce hypotheses, questions, uncertainties, and conflictInterpretations — do not attempt to include those fields here."
      : "- This call produces ONLY the interpretive/epistemic portion of the executive diagnosis: hypotheses, questions, uncertainties, and conflictInterpretations. A first, separate call already produced executiveSummary, interpretations, risks, priorities, and possibleActions — do not attempt to include those fields here.";

  return buildBaseSystemPrompt(instruction, toolName, stageNote);
}
