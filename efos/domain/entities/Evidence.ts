import type {
  EvidenceCategory,
  EvidenceConfidence,
  EvidenceSeverity,
  EvidenceType,
} from "../enums";
import type { EvidenceSource, Period } from "../value-objects";
import type { DomainEntity } from "./base";

/**
 * Evidencia — fato financeiro objetivo e auditavel, destilado do
 * Financial Model, dos Indicadores e do Financial Knowledge Graph de
 * uma empresa (Camada 4 da Ontologia: queda de margem, liquidez abaixo
 * do minimo, capital de giro insuficiente). Nunca interpreta causa,
 * nunca recomenda, nunca preve — isso pertence a Reasoning/
 * Recommendation, estagios posteriores do pipeline.
 *
 * `type`/`category`/`severity`/`confidence` foram adicionados na
 * Mission 009 (Evidence Engine) — ver docs/DECISIONS.md D-007.
 * `audit.createdAt` (DomainEntity) cumpre o papel de timestamp, sem
 * campo duplicado (mesmo precedente de D-003 para `Indicator`).
 * `sources` garante que nenhuma Evidence exista sem origem rastreavel —
 * substitui o antigo `supportingIndicatorIds` (Mission 003, nunca
 * consumido), que so cobria Indicators; `sources` cobre qualquer tipo
 * de origem (`EvidenceSourceType`).
 */
export interface Evidence extends DomainEntity {
  readonly companyId: string;
  readonly type: EvidenceType;
  readonly category: EvidenceCategory;
  readonly severity: EvidenceSeverity;
  readonly confidence: EvidenceConfidence;
  readonly title: string;
  readonly description: string;
  readonly supportingData: Readonly<Record<string, unknown>>;
  readonly sources: readonly EvidenceSource[];
  /**
   * Janela de períodos observada por uma Evidence TEMPORAL (Mission
   * 166 — Temporal Evidence Detection, D-087) — do início do período
   * mais antigo usado até o fim do período atual. Opcional e aditivo:
   * `undefined` para toda Evidence de período único (as 5 regras
   * absolutas já existentes, Mission 009) — comportamento anterior
   * preservado byte a byte. Nunca usado por nenhuma validação
   * existente (`validateExecutiveFinancialContextReferences()`,
   * Mission 163, continua validando apenas por `id`) — existe
   * exclusivamente para descrição honesta: uma Evidence que afirma
   * "declínio sustentado" precisa nomear o intervalo real a que se
   * refere, o que `Evidence.sources` sozinho não consegue expressar
   * (`Indicator.id` é o mesmo em todos os períodos da mesma empresa,
   * D-001/Mission 163).
   */
  readonly observedPeriod?: Period;
}
