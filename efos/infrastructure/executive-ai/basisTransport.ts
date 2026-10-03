import type { InterpretationBasis } from "@/efos/application/executive-diagnosis";

/**
 * Mission 135 — Executive AI Schema Complexity Reduction & Strict
 * Contract Recovery.
 *
 * Achado quantitativo (Etapa 2, script de auditoria real contra
 * `EXECUTIVE_DIAGNOSIS_TOOL_SCHEMA`): `basis` e seus 4 subcampos
 * (`indicatorIds`/`evidenceIds`/`contextIds`/`conflictIds`)
 * respondiam por 35 das 72 declarações de propriedade do schema
 * (49%) e 28 dos 37 nós de array (76%) — de longe o maior
 * contribuinte para o tamanho da gramática compilada que a Anthropic
 * rejeitou na Mission 134 ("compiled grammar is too large").
 *
 * **Estratégia escolhida (Etapa 3, A+B combinadas)**: o schema
 * enviado à Anthropic (`Tool.input_schema`) passa a representar
 * `basis` como um único array de strings prefixadas por categoria
 * (`"indicator:<id>"`/`"evidence:<id>"`/`"context:<id>"`/`"conflict:<id>"`)
 * — reduzindo a contribuição de cada uso de `basis` de 5 declarações
 * de propriedade (o objeto + 4 subcampos) para apenas 1. O contrato
 * de domínio (`InterpretationBasis`, D-059, `ExecutiveDiagnosis.types.ts`)
 * **nunca muda** — este módulo existe exatamente para reconstruir a
 * forma rica de 4 campos a partir do formato compacto de transporte,
 * inteiramente dentro da camada de infraestrutura, antes de qualquer
 * dado alcançar `executeExecutiveAnalysis()`/`validateExecutiveDiagnosis()`.
 *
 * **Isto não é uma interpretação de conteúdo financeiro** — é uma
 * decodificação estrutural determinística e sem perdas (para entradas
 * bem formadas), da mesma natureza do que o adapter já faz desde a
 * Mission 118 (injetar `id`/`basedOn`/`boundaries`, nunca confiados
 * ao modelo). Nenhum ID é inventado: uma entrada malformada (sem
 * prefixo reconhecido, ou vazia) é descartada, nunca reclassificada
 * numa categoria arbitrária — `validateExecutiveDiagnosis()`
 * (`basisIsEmpty()`) continua sendo a defesa final contra uma `basis`
 * efetivamente vazia depois da decodificação.
 */

/**
 * Mission 148 — Knowledge-Conditioned Executive Decision Intelligence
 * (D-080): `"knowledge"` é um 5º prefixo aditivo, apontando para
 * `InterpretationBasis.knowledgeIds` — mesma mecânica exata dos 4 já
 * existentes, nenhuma propriedade nova declarada no schema `strict`
 * (`BASIS_REFERENCES_SCHEMA` continua `{type: "array", items: {type:
 * "string"}}`, D-068 preservado integralmente — o vocabulário de
 * prefixos cresce, a forma do schema não).
 */
const BASIS_PREFIX_TO_FIELD: Readonly<Record<string, keyof InterpretationBasis>> = {
  indicator: "indicatorIds",
  evidence: "evidenceIds",
  context: "contextIds",
  conflict: "conflictIds",
  knowledge: "knowledgeIds",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Decodifica um array de strings prefixadas (formato de transporte,
 * ex.: `["indicator:IND-1", "context:CTX-2"]`) de volta para
 * `InterpretationBasis` (D-059). Função pura, nunca lança exceção —
 * entradas malformadas (sem `:`, prefixo desconhecido, ou id vazio)
 * são descartadas silenciosamente, nunca reclassificadas numa
 * categoria arbitrária nem usadas para inventar um id.
 */
export function decodeBasisReferences(raw: unknown): InterpretationBasis {
  const result: {
    indicatorIds: string[];
    evidenceIds: string[];
    contextIds: string[];
    conflictIds: string[];
    knowledgeIds: string[];
  } = {
    indicatorIds: [],
    evidenceIds: [],
    contextIds: [],
    conflictIds: [],
    knowledgeIds: [],
  };

  if (!Array.isArray(raw)) return result;

  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex === -1) continue;

    const prefix = entry.slice(0, separatorIndex);
    const id = entry.slice(separatorIndex + 1);
    const field = BASIS_PREFIX_TO_FIELD[prefix];
    if (!field || id.length === 0) continue;

    result[field].push(id);
  }

  return result;
}

/**
 * Aplica `decodeBasisReferences()` a todo campo `basis` presente na
 * saída bruta do modelo (`executiveSummary` + os 6 arrays de itens
 * que carregam `basis`, D-059) — nunca toca nenhum outro campo.
 * Função pura, tolerante a forma inesperada (um campo ausente ou de
 * tipo errado é deixado como está — `looksLikeExecutiveDiagnosis()`/
 * `validateExecutiveDiagnosis()`, camadas seguintes, continuam sendo
 * quem decide se a forma final é aceitável).
 */
export function decodeModelDiagnosisBasisFields(modelDiagnosis: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...modelDiagnosis };

  if (isPlainObject(result.executiveSummary)) {
    result.executiveSummary = {
      ...result.executiveSummary,
      basis: decodeBasisReferences(result.executiveSummary.basis),
    };
  }

  const arrayFieldsWithBasis = [
    "interpretations",
    "hypotheses",
    "risks",
    "priorities",
    "possibleActions",
    "conflictInterpretations",
  ] as const;

  for (const field of arrayFieldsWithBasis) {
    if (Array.isArray(result[field])) {
      result[field] = (result[field] as readonly unknown[]).map((item) =>
        isPlainObject(item) ? { ...item, basis: decodeBasisReferences(item.basis) } : item
      );
    }
  }

  return result;
}

/**
 * Mission 207 — lista exata das referências citáveis em `basis` NESTA
 * chamada, renderizada nas instruções de sistema dos dois adapters
 * (Diagnosis e Chat). Achado da validação real: o modelo usava o prefixo
 * "context:" para qualquer coisa dentro do bloco JSON `context`
 * (ids de indicador/evidência, `historicalIntelligence`, `unknowns`,
 * nomes) — a colisão entre o prefixo e o nome da chave tornava 9 de 12
 * respostas reais inválidas na validação de referências (D-081).
 *
 * Só torna explícito o que a validação já exige: nenhum contrato, schema
 * ou regra de aceitação muda. Mostra o nome ao lado de cada id para o
 * modelo mapear "Margem Líquida" → `indicator:<id>` sem adivinhar.
 */
export interface CitableBasisSource {
  readonly financialTruth: { readonly indicators: ReadonlyArray<{ readonly id: string; readonly name: string }> };
  readonly evidence: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly deterministicIntelligence: { readonly contexts: ReadonlyArray<{ readonly id: string }> };
}

export function describeCitableBasisReferences(
  context: CitableBasisSource,
  knowledge: ReadonlyArray<{ readonly id: string }> = []
): string {
  const list = (entries: readonly string[]) => (entries.length > 0 ? entries.join("; ") : "none in this call — never use this prefix");
  return [
    "Citable `basis` references for THIS call — use only these exact strings, nothing else:",
    `- indicator: ${list(context.financialTruth.indicators.map((item) => `"indicator:${item.id}" (${item.name})`))}`,
    `- evidence: ${list(context.evidence.map((item) => `"evidence:${item.id}" (${item.title})`))}`,
    `- context: ${list(context.deterministicIntelligence.contexts.map((item) => `"context:${item.id}"`))}. The "context:" prefix refers ONLY to entries of context.deterministicIntelligence.contexts — it never means "anything inside the context block".`,
    "- conflict: none in this call — never use this prefix (conflicts have no identity of their own).",
    `- knowledge: ${list(knowledge.map((item) => `"knowledge:${item.id}"`))}`,
    "Nothing else is citable. historicalIntelligence comparisons, unknowns, financialEpisodes, JSON key names and indicator or evidence names have no reference of their own — to ground a statement on a comparison, an unknown or an episode, cite the \"indicator:<id>\" of the same metric. Never invent, rename or abbreviate an id.",
  ].join("\n");
}
