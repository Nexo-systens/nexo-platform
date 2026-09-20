import type { FinancialEventType } from "../enums";
import type { Money } from "../value-objects";
import type { DomainEntity } from "./base";

/**
 * Evento Financeiro — acontecimento (Camada 2 da Ontologia: Venda,
 * Compra, Pagamento, Recebimento, Contratacao, Demissao, Investimento,
 * Financiamento, Renegociacao, Inadimplencia).
 *
 * `label` (Mission 107 — Financial Intelligence Traceability): o texto
 * original da linha do documento que originou este evento (ex.:
 * "15/08/2026 PIX RECEBIDO R$5.000,00") — mesmo campo que `Resource.label`
 * já preservava desde a fundação do Domain; `FinancialEvent` nunca teve
 * o campo, então `financial-model.mapper.ts` descartava
 * silenciosamente `NormalizedFinancialRecord.label`, mesmo já
 * recebendo o valor, exatamente na etapa em que a maioria dos dados
 * reais (linhas de extrato bancário, sempre classificadas como evento,
 * nunca recurso — achado da Mission 101/102) perdia rastreabilidade
 * até o texto de origem. Opcional — nunca quebra um `FinancialEvent`
 * já persistido sem o campo (compatibilidade histórica).
 */
export interface FinancialEvent extends DomainEntity {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly type: FinancialEventType;
  readonly amount?: Money;
  readonly occurredAt: string; // ISO date
  readonly relatedResourceIds?: readonly string[];
  readonly label?: string;
}
