import type { Knowledge } from "@/efos/domain";

/**
 * Contexto mínimo necessário para selecionar `Knowledge` relevante
 * (Mission 142 — Knowledge Relevance & Executive Context Integration).
 * Deliberadamente um tipo PRÓPRIO, nunca `ExecutiveFinancialContext`
 * (`efos/application/executive-context/`) importado diretamente —
 * auditoria obrigatória (Etapa 2, README.md deste diretório) confirmou
 * que `ExecutiveFinancialContext` é passado por REFERÊNCIA, sem
 * seleção de campos, até `serializeExecutiveAIInstruction()`
 * (`JSON.parse(JSON.stringify(instruction))`, cópia estrutural
 * completa) — qualquer campo novo adicionado àquele tipo vazaria
 * automaticamente para o prompt de um provider de IA real. Acoplar
 * este módulo a `ExecutiveFinancialContext` criaria a TENTAÇÃO de um
 * dia anexar `relevantKnowledge` diretamente nele "por conveniência",
 * pulando a decisão arquitetural explícita que uma integração real
 * exige (Etapa 9/10 da missão). `RelevanceContext` é a MENOR extensão
 * possível — apenas os 2 campos genuinamente necessários para os
 * critérios estruturais desta missão (fronteira de empresa,
 * temporalidade).
 */
export interface RelevanceContext {
  readonly companyId: string;
  /**
   * ISO 8601 — momento que a análise executiva atual representa.
   * Quando ausente, nenhum filtro temporal é aplicado (mesma
   * convenção de `asOf?` em `buildKnowledgeFromLearningRecords()`,
   * Mission 141 — omitir significa "sem corte temporal", nunca "agora
   * mesmo" lido do relógio do sistema).
   */
  readonly asOf?: string;
}

/**
 * Vocabulário fechado de motivos de EXCLUSÃO — auditável, nunca texto
 * livre interpretado por humano/IA. Mesma disciplina de todo
 * vocabulário fechado desta série de missões (D-071/D-072/D-073):
 * um código, não uma frase, é a fonte de verdade testável.
 *
 * - `COMPANY_MISMATCH` — `knowledge.companyId !== context.companyId`
 *   (Etapa 4 da missão — fronteira de empresa, nunca cross-company).
 * - `FUTURE_KNOWLEDGE` — `knowledge.audit.createdAt > context.asOf`
 *   (Etapa 6 — Knowledge formado depois do instante que a análise
 *   representa nunca contamina uma análise histórica).
 * - `STRUCTURALLY_INVALID` — `validateKnowledge()` (Mission 141)
 *   rejeita o registro (ex.: sem `derivedFromLearningRecordIds`) —
 *   reaproveitado diretamente, nunca uma segunda validação
 *   duplicada/divergente.
 */
export const KNOWLEDGE_RELEVANCE_EXCLUSION_CODES = [
  "COMPANY_MISMATCH",
  "FUTURE_KNOWLEDGE",
  "STRUCTURALLY_INVALID",
] as const;
export type KnowledgeRelevanceExclusionCode = (typeof KNOWLEDGE_RELEVANCE_EXCLUSION_CODES)[number];

/**
 * Vocabulário fechado de motivos de INCLUSÃO — hoje só 1 valor: todo
 * `Knowledge` que sobrevive aos 3 critérios estruturais (empresa,
 * temporalidade, validade estrutural) é incluído pelo mesmo motivo.
 * Nenhum ranking/score é usado nesta missão (Etapa 5 — "não inventar
 * um sistema de score complexo sem necessidade").
 */
export const KNOWLEDGE_RELEVANCE_INCLUSION_CODES = ["COMPANY_MATCH_AND_TEMPORALLY_VALID"] as const;
export type KnowledgeRelevanceInclusionCode = (typeof KNOWLEDGE_RELEVANCE_INCLUSION_CODES)[number];

/** Uma explicação por `Knowledge` — sempre rastreável até um `id` real, nunca um resumo agregado. */
export interface KnowledgeRelevanceReason {
  readonly knowledgeId: string;
  readonly code: KnowledgeRelevanceExclusionCode | KnowledgeRelevanceInclusionCode;
  readonly message: string;
}

/**
 * Resultado auditável de `selectRelevantKnowledge()` (Etapa 7 da
 * missão). `selected` é a lista pronta para consumo (dado puro,
 * nunca misturado com sua própria explicação — mesmo padrão já usado
 * por `ExecutiveUnknown` vs. `Indicator`, Mission 114: o FATO e a
 * AUDITORIA do fato vivem em campos irmãos, nunca fundidos);
 * `included`/`excluded` são arrays PARALELOS de explicação, sempre na
 * mesma ordem relativa de `selected`/da entrada original —
 * `included[i].knowledgeId === selected[i].id`.
 *
 * `outcome` é só uma projeção derivada de `selected.length` — nunca
 * uma segunda fonte de verdade — mas dá um nome explícito ao caminho
 * honesto exigido pela Etapa 8 da missão: `"NO_RELEVANT_KNOWLEDGE"`
 * NUNCA é um erro, é um resultado válido e esperado quando nenhum
 * `Knowledge` sobrevive aos critérios.
 */
export interface RelevantKnowledgeSelection {
  readonly outcome: "SELECTED" | "NO_RELEVANT_KNOWLEDGE";
  readonly selected: readonly Knowledge[];
  readonly included: readonly KnowledgeRelevanceReason[];
  readonly excluded: readonly KnowledgeRelevanceReason[];
}
