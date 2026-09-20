/**
 * Constantes do Context Engine — id/versao, mensagens de validacao,
 * categorias de Evidence reconhecidas por regra de agrupamento, e as
 * escalas de consolidacao de severidade/confianca. Nenhuma logica de
 * agrupamento aqui (isso pertence a context.builder.ts).
 */

import type { EvidenceCategory, EvidenceConfidence, EvidenceSeverity } from "@/efos/domain";
import type { ContextSeverity } from "@/efos/domain";

export const CONTEXT_ENGINE_CONSTANTS = {
  id: "context",
  name: "Context Engine",
  version: "0.1.0",
  /** Prefixo do id deterministico de cada Context (ver context.mapper.ts). */
  idPrefix: "context",
} as const;

export const CONTEXT_ENGINE_MESSAGES = {
  invalidInput: "Entrada invalida para o Context Engine.",
  missingCompanyId: "companyId e obrigatorio.",
  missingFinancialModel: "financialModel e obrigatorio.",
  missingFinancialModelRoot: "financialModel.root e obrigatorio.",
  missingIndicators: "indicators e obrigatorio.",
  missingFinancialKnowledgeGraph: "financialKnowledgeGraph e obrigatorio.",
  missingEvidence: "evidence e obrigatorio.",
  financialModelCompanyMismatch:
    "financialModel.root.companyId nao corresponde ao companyId informado.",
  indicatorsCompanyMismatch:
    "indicators.companyId nao corresponde ao companyId informado.",
  indicatorsFinancialModelMismatch:
    "indicators.financialModelId nao corresponde ao financialModel.root.id.",
  graphCompanyMismatch:
    "financialKnowledgeGraph.companyId nao corresponde ao companyId informado.",
  graphFinancialModelMismatch:
    "financialKnowledgeGraph.financialModelId nao corresponde ao financialModel.root.id.",
  evidenceCompanyMismatch:
    "evidence.companyId nao corresponde ao companyId informado.",
  evidenceFinancialModelMismatch:
    "evidence.financialModelId nao corresponde ao financialModel.root.id.",
} as const;

/**
 * Numero minimo de Evidences simultaneas exigido para caracterizar uma
 * situacao composta. Abaixo disso, o fato ja e coberto sozinho pela
 * propria Evidence — um Context so existe quando ha algo a mais do que
 * repetir uma unica Evidence (Mission 010, "situacoes compostas").
 */
export const MINIMUM_EVIDENCES_FOR_CONTEXT = 2;

/** Tipos de Evidence tratados como adversos — as regras de agrupamento so consideram estes. */
export const ADVERSE_EVIDENCE_TYPES = ["negative", "warning"] as const;

/** Categorias de Evidence reconhecidas pela regra "Pressão de Caixa". */
export const CASH_PRESSURE_EVIDENCE_CATEGORIES: readonly EvidenceCategory[] = [
  "liquidity",
  "working_capital",
  "cash_flow",
];

/** Categorias de Evidence reconhecidas pela regra "Rentabilidade Comprometida". */
export const PROFITABILITY_EVIDENCE_CATEGORIES: readonly EvidenceCategory[] = [
  "profitability",
];

/** Escala ordinal de EvidenceSeverity/ContextSeverity — usada para consolidar a severidade mais grave entre as Evidences agrupadas. */
export const SEVERITY_SCALE: readonly EvidenceSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
] as const satisfies readonly ContextSeverity[];

/** Escala ordinal de EvidenceConfidence — usada para consolidar a confianca mais fraca entre as Evidences agrupadas ("elo mais fraco"). */
export const CONFIDENCE_SCALE: readonly EvidenceConfidence[] = [
  "low",
  "medium",
  "high",
  "verified",
];
