import type { ContextSeverity, ContextType, EvidenceConfidence } from "../enums";
import type { DomainEntity } from "./base";

/**
 * Contexto Financeiro — agrupamento de Evidencias relacionadas em uma
 * situacao composta (Mission 010 — Context Engine). Ex.: Liquidez
 * abaixo do minimo + Capital de giro insuficiente + Fluxo de caixa
 * operacional negativo → "Pressão de Caixa". Apenas descreve a
 * situacao — nunca explica causa, nunca interpreta, nunca recomenda
 * (isso pertence a Reasoning/Recommendation, estagios posteriores do
 * pipeline).
 *
 * `confidence` reaproveita `EvidenceConfidence` (efos/domain/enums/
 * evidence.ts) em vez de um enum novo — Context.confidence e sempre
 * derivada das Evidences agrupadas (a confianca mais fraca entre elas),
 * nunca um julgamento independente deste Engine (docs/DECISIONS.md
 * D-008). `audit.createdAt` (DomainEntity) cumpre o papel de timestamp,
 * mesmo precedente de D-003/D-007.
 *
 * `evidences` referencia as Evidences agrupadas por ID
 * (`Evidence.id`), nunca por composicao direta de objeto — mesma
 * convencao de todo agregado do dominio (efos/domain/aggregates/
 * index.ts, cabecalho) — garantindo que toda Evidence usada continue
 * rastreavel ate sua propria origem (`Evidence.sources`) sem duplicar
 * dado.
 */
export interface Context extends DomainEntity {
  readonly companyId: string;
  readonly type: ContextType;
  readonly severity: ContextSeverity;
  readonly confidence: EvidenceConfidence;
  readonly title: string;
  readonly description: string;
  readonly evidences: readonly string[];
  readonly supportingData: Readonly<Record<string, unknown>>;
}
