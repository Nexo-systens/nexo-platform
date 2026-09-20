import type { Context, ContextAggregate, ReasoningConfidence } from "@/efos/domain";

import {
  CASH_RISK_CONTEXT_TYPE,
  CONTEXT_CONFIDENCE_SCALE,
  PROFITABILITY_RISK_CONTEXT_TYPE,
  REASONING_CONFIDENCE_SCALE,
} from "./reasoning.constants";
import type { ReasoningDraft } from "./reasoning.types";

/**
 * Builder do Reasoning Engine. Centraliza toda regra de inferência —
 * nenhuma regra vive em reasoning.engine.ts. Cada função `detect*` lê
 * `ContextAggregate` (o único agregado do qual as regras atuais
 * precisam — o Context Engine já consolida Evidências relacionadas em
 * uma única situação composta por tipo, então um único Context de um
 * tipo reconhecido já é sinal suficiente para uma conclusão executiva)
 * e, se a situação for material, produz um `ReasoningDraft`; caso
 * contrário retorna `[]`. Nunca interpreta causa nova além do que os
 * Contexts já expressam, nunca prevê, nunca recomenda, nunca decide.
 * Não usa IA sob nenhuma circunstância.
 *
 * As regras casam por `Context.type` (`ContextType`, contrato oficial
 * do Domain — `efos/domain/enums/context.ts`), nunca pelo id interno
 * de cada Context (esquema privado do Context Engine,
 * `context.mapper.ts`) — evita acoplamento com detalhes de
 * implementação de outro Engine (D-002).
 */

function findContextByType(
  contextAggregate: ContextAggregate,
  type: string
): Context | undefined {
  return contextAggregate.contexts.find((context) => context.type === type);
}

/** Traduz a confiança de um Context (EvidenceConfidence) para o vocabulário próprio de ReasoningConfidence — mesma posição ordinal, enum distinto (D-009). */
function translateConfidence(context: Context): ReasoningConfidence {
  const rank = CONTEXT_CONFIDENCE_SCALE.indexOf(context.confidence);
  return REASONING_CONFIDENCE_SCALE[rank];
}

/** Confiança mais fraca entre os Contexts combinados — o elo mais fraco determina o quão fundamentada a conclusão está. */
function consolidateConfidence(
  contexts: readonly Context[]
): ReasoningConfidence {
  const minRank = Math.min(
    ...contexts.map((context) => CONTEXT_CONFIDENCE_SCALE.indexOf(context.confidence))
  );
  return REASONING_CONFIDENCE_SCALE[minRank];
}

function uniqueEvidenceIds(contexts: readonly Context[]): string[] {
  return [...new Set(contexts.flatMap((context) => context.evidences))];
}

export function detectCashRisk(
  contextAggregate: ContextAggregate
): ReasoningDraft[] {
  const cashPressureContext = findContextByType(
    contextAggregate,
    CASH_RISK_CONTEXT_TYPE
  );
  if (!cashPressureContext) return [];

  return [
    {
      key: "cash-risk",
      type: "cash_risk",
      confidence: translateConfidence(cashPressureContext),
      title: "Existe risco financeiro de curto prazo",
      description: `O contexto "${cashPressureContext.title}" indica risco financeiro de curto prazo — liquidez, capital de giro e/ou fluxo de caixa comprometidos simultaneamente.`,
      contextIds: [cashPressureContext.id],
      evidenceIds: uniqueEvidenceIds([cashPressureContext]),
      supportingData: {
        contextType: cashPressureContext.type,
        contextSeverity: cashPressureContext.severity,
      },
    },
  ];
}

export function detectProfitabilityRisk(
  contextAggregate: ContextAggregate
): ReasoningDraft[] {
  const profitabilityContext = findContextByType(
    contextAggregate,
    PROFITABILITY_RISK_CONTEXT_TYPE
  );
  if (!profitabilityContext) return [];

  return [
    {
      key: "profitability-risk",
      type: "profitability_risk",
      confidence: translateConfidence(profitabilityContext),
      title: "A operação apresenta deterioração de margem",
      description: `O contexto "${profitabilityContext.title}" indica deterioração de margem — múltiplas margens negativas simultaneamente.`,
      contextIds: [profitabilityContext.id],
      evidenceIds: uniqueEvidenceIds([profitabilityContext]),
      supportingData: {
        contextType: profitabilityContext.type,
        contextSeverity: profitabilityContext.severity,
      },
    },
  ];
}

/**
 * Única regra que de fato combina dois Contexts distintos (não apenas
 * promove um Context isolado) — dispara quando risco de caixa e
 * deterioração de rentabilidade coexistem na mesma execução,
 * caracterizando risco operacional amplo, não isolado a uma única
 * frente financeira.
 */
export function detectOperationalRisk(
  contextAggregate: ContextAggregate
): ReasoningDraft[] {
  const cashPressureContext = findContextByType(
    contextAggregate,
    CASH_RISK_CONTEXT_TYPE
  );
  const profitabilityContext = findContextByType(
    contextAggregate,
    PROFITABILITY_RISK_CONTEXT_TYPE
  );
  if (!cashPressureContext || !profitabilityContext) return [];

  const combined = [cashPressureContext, profitabilityContext];

  return [
    {
      key: "operational-risk",
      type: "operational_risk",
      confidence: consolidateConfidence(combined),
      title: "A empresa enfrenta risco financeiro em múltiplas frentes",
      description: `Os contextos "${cashPressureContext.title}" e "${profitabilityContext.title}" ocorrem simultaneamente — risco de caixa e deterioração de rentabilidade ao mesmo tempo indicam risco operacional amplo.`,
      contextIds: combined.map((context) => context.id),
      evidenceIds: uniqueEvidenceIds(combined),
      supportingData: {
        contextTypes: combined.map((context) => context.type),
        contextSeverities: combined.map((context) => context.severity),
      },
    },
  ];
}

export function detectReasonings(
  contextAggregate: ContextAggregate
): ReasoningDraft[] {
  return [
    ...detectCashRisk(contextAggregate),
    ...detectProfitabilityRisk(contextAggregate),
    ...detectOperationalRisk(contextAggregate),
  ];
}
