/**
 * Constantes do Reasoning Engine — id/versao, mensagens de validacao,
 * tipos de Context reconhecidos por regra de inferencia, e a escala de
 * consolidacao de confianca. Nenhuma logica de inferencia aqui (isso
 * pertence a reasoning.builder.ts).
 */

import type { ContextType, EvidenceConfidence, ReasoningConfidence } from "@/efos/domain";

export const REASONING_ENGINE_CONSTANTS = {
  id: "reasoning",
  name: "Reasoning Engine",
  version: "0.1.0",
  /** Prefixo do id deterministico de cada Reasoning (ver reasoning.mapper.ts). */
  idPrefix: "reasoning",
} as const;

export const REASONING_ENGINE_MESSAGES = {
  invalidInput: "Entrada invalida para o Reasoning Engine.",
  missingCompanyId: "companyId e obrigatorio.",
  missingFinancialModel: "financialModel e obrigatorio.",
  missingFinancialModelRoot: "financialModel.root e obrigatorio.",
  missingIndicators: "indicators e obrigatorio.",
  missingFinancialKnowledgeGraph: "financialKnowledgeGraph e obrigatorio.",
  missingEvidence: "evidence e obrigatorio.",
  missingContext: "context e obrigatorio.",
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
  contextCompanyMismatch:
    "context.companyId nao corresponde ao companyId informado.",
  contextFinancialModelMismatch:
    "context.financialModelId nao corresponde ao financialModel.root.id.",
} as const;

/** `ContextType` (efos/domain/enums/context.ts) reconhecido pela regra "Risco de Caixa". */
export const CASH_RISK_CONTEXT_TYPE: ContextType = "cash_pressure";

/** `ContextType` reconhecido pela regra "Risco de Rentabilidade". */
export const PROFITABILITY_RISK_CONTEXT_TYPE: ContextType = "profitability";

/**
 * Escala ordinal de `EvidenceConfidence` (formato de `Context.confidence`,
 * efos/domain/entities/Context.ts) — usada para ranquear a confianca de
 * cada Context ao consolidar a confianca de um Reasoning. Definida
 * localmente (nao importada de efos/engines/context) para manter este
 * Engine desacoplado dos internos de outro Engine (D-002) — mesmo
 * precedente de evidence.builder.ts/context.builder.ts, cada um com sua
 * propria escala local.
 */
export const CONTEXT_CONFIDENCE_SCALE: readonly EvidenceConfidence[] = [
  "low",
  "medium",
  "high",
  "verified",
];

/**
 * Escala ordinal de `ReasoningConfidence` — mesmas posicoes de
 * `CONTEXT_CONFIDENCE_SCALE`, usada para traduzir o rank de confianca
 * consolidado de volta para o vocabulario proprio do Reasoning Engine
 * (D-009 — `ReasoningConfidence` nao reaproveita `EvidenceConfidence`).
 */
export const REASONING_CONFIDENCE_SCALE: readonly ReasoningConfidence[] = [
  "low",
  "medium",
  "high",
  "verified",
];
