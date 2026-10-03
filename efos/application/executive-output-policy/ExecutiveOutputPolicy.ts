/**
 * Mission 206 — Executive AI Output Governance (D-132).
 *
 * Política canônica de SAÍDA de toda capability de Executive AI da NEXO
 * (Executive Diagnosis, Executive Chat e qualquer capability futura). É
 * regra de produto, acima de qualquer provider: nenhum adapter decide o
 * idioma, o tom ou como um número é citado — ele só renderiza esta
 * política no formato do seu SDK. Trocar de provider nunca troca a
 * política ("Anthropic = português" não existe em lugar nenhum).
 *
 * Cada capability herda as invariantes por dois caminhos:
 * - `outputLanguage` estrutural na instrução (validado pelo validator da
 *   instrução, renderizado pelo prompt);
 * - os códigos de `EXECUTIVE_OUTPUT_POLICY_CODES`, adicionados ao mesmo
 *   vocabulário fechado de constraints de cada capability (nunca uma
 *   lista paralela), com as descrições definidas só aqui.
 *
 * A garantia em runtime fica em `validateExecutiveOutputGovernance()`
 * (idioma e fidelidade numérica), chamada pelas composições de cada
 * capability depois da validação de schema e de referências.
 */

/** Idioma de toda saída textual destinada ao usuário final, nesta fase. */
export const EXECUTIVE_OUTPUT_LANGUAGE = "pt-BR" as const;
export type ExecutiveOutputLanguage = typeof EXECUTIVE_OUTPUT_LANGUAGE;
export const EXECUTIVE_OUTPUT_LANGUAGE_NAME = "Português do Brasil";

/**
 * Termos mantidos em inglês de propósito: nomes canônicos do produto e
 * siglas financeiras de uso corrente no Brasil. Nunca contam como
 * "texto em inglês" na verificação de idioma.
 */
export const EXECUTIVE_OUTPUT_PRESERVED_TERMS = [
  "Executive Financial Operating System",
  "Executive Chat",
  "Executive AI",
  "Scenario Lab",
  "Decision Center",
  "EFOS",
  "NEXO",
  "EBITDA",
  "EBIT",
  "ROI",
  "ROE",
  "ROA",
] as const;

export const EXECUTIVE_OUTPUT_POLICY_CODES = [
  "WRITE_IN_BRAZILIAN_PORTUGUESE",
  "USE_EXECUTIVE_BRAZILIAN_TONE",
  "USE_BRAZILIAN_FINANCIAL_TERMINOLOGY",
  "CITE_CANONICAL_FIGURES_EXACTLY",
  "STATE_UNAVAILABLE_AS_UNAVAILABLE",
  "PHRASE_HYPOTHESES_AS_POSSIBILITIES",
  "PHRASE_ACTIONS_AS_SUGGESTIONS",
] as const;

export type ExecutiveOutputPolicyCode = (typeof EXECUTIVE_OUTPUT_POLICY_CODES)[number];

export const EXECUTIVE_OUTPUT_POLICY_DESCRIPTIONS: Readonly<Record<ExecutiveOutputPolicyCode, string>> = {
  WRITE_IN_BRAZILIAN_PORTUGUESE:
    "Write every natural-language text value you produce (summaries, statements, reasons, questions, validation notes, answers) in Brazilian Portuguese (pt-BR), regardless of the language of these instructions, of the JSON keys, or of the question. Never answer in English. Keep in English only the canonical product names (Executive Chat, Scenario Lab, Decision Center, Executive Financial Operating System/EFOS), acronyms (EBITDA, DRE, CPV), proper names, and the exact identifiers/enum values the schema requires.",
  USE_EXECUTIVE_BRAZILIAN_TONE:
    "Write as an executive financial system, not as a chatbot: clear, objective, precise, professional Brazilian Portuguese, in short sentences. No emojis, no greetings, no promotional language, no rhetorical flourishes, no 'como uma IA', no apologies, and no repeated disclaimers — the limits of the analysis belong in the uncertainty/limitation fields, stated once and concretely. Avoid literal translations from English and unnecessary anglicisms.",
  USE_BRAZILIAN_FINANCIAL_TERMINOLOGY:
    "Use the Brazilian financial vocabulary the company already uses — DRE, receita, receita líquida, CPV/CMV, margem bruta/operacional/líquida, lucro, caixa, capital de giro, contas a receber, contas a pagar, competência, período, endividamento. Refer to each indicator exactly by the name it has in the context (e.g. 'Margem Líquida', 'Liquidez Corrente'); never rename it, translate it, or invent a new taxonomy.",
  CITE_CANONICAL_FIGURES_EXACTLY:
    "When you cite a number, cite a value that already exists in the context — the indicator value, an evidence figure, or a variation already present in historicalIntelligence — with the same sign, written in Brazilian format (comma as decimal separator, R$ for currency, % for percentages, p.p. for percentage-point variations — formats like 'R$ 1.250.000', '12,5%', '-3,2 p.p.'). Rounding is only for display in the text (at most two decimal places) and never changes the value itself. Never compute a new figure yourself: no differences, sums, averages, ratios, growth rates or projections that are not already in the context. If a figure you would need is not in the context, say it is not available instead of estimating it.",
  STATE_UNAVAILABLE_AS_UNAVAILABLE:
    "An indicator or figure that is unavailable in the context must be described as 'indisponível' (or 'não disponível nesta análise') — never as zero, never with any number, never as an estimate presented as a known value.",
  PHRASE_HYPOTHESES_AS_POSSIBILITIES:
    "Phrase every hypothesis and every inferred risk as a possibility that still requires confirmation ('pode', 'possivelmente', 'se ... então', 'a confirmar com ...') — never as an established fact or a confirmed cause.",
  PHRASE_ACTIONS_AS_SUGGESTIONS:
    "Phrase every possible action, priority, and proposal as a suggestion for the company's judgment ('avaliar', 'considerar', 'investigar', 'revisar') with its explicit basis — never as an order or obligation ('você deve', 'é obrigatório', 'imediatamente'). The decision always belongs to the company.",
};

/**
 * Parágrafo de idioma renderizado por todo adapter de provider, logo no
 * início das instruções de sistema. Texto único para todas as
 * capabilities — nenhum prompt reescreve a regra com outras palavras.
 */
export function describeExecutiveOutputLanguage(language: ExecutiveOutputLanguage): string {
  return [
    `Output language: ${language} (${EXECUTIVE_OUTPUT_LANGUAGE_NAME}). Every natural-language text value in your structured output must be written in Brazilian Portuguese — this is a product rule of NEXO, not a preference, and it does not change with the language of these instructions, of the JSON keys, or of the user's question.`,
    `Keep exactly as they are: enum values and identifiers required by the schema, basis references, and these canonical terms: ${EXECUTIVE_OUTPUT_PRESERVED_TERMS.join(", ")}.`,
  ].join("\n");
}

/** Nota acrescentada à descrição de toda tool de saída estruturada (não altera o schema). */
export const EXECUTIVE_OUTPUT_TOOL_LANGUAGE_NOTE =
  "All natural-language string values (statements, reasons, questions, validation notes, answers) must be written in Brazilian Portuguese (pt-BR); enum values, ids and basis references stay exactly as specified.";
