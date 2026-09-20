import type { ResourceType } from "../enums";
import type { Money } from "../value-objects";
import type { DomainEntity } from "./base";

/**
 * Recurso — ativo que a empresa possui (Camada 1 da Ontologia: Caixa,
 * Clientes, Funcionarios, Fornecedores, Produtos, Servicos, Contratos,
 * Estoque, Emprestimos, Investimentos, Patrimonio). Tipo generico
 * discriminado por `type` — evita onze interfaces quase identicas sem
 * nenhuma regra de negocio que as diferencie nesta fase.
 *
 * `asOfDate?` (Mission 192 Closure — Complete Statement Economics &
 * Balance-Date Semantics, D-111): data real de referência do saldo,
 * quando o documento de origem a declara (ex.: "Balancete — Data-base:
 * 31/07/2026"). NUNCA um `occurredAt` — um saldo pontual não é uma
 * transação; o campo é opcional e aditivo, um `Resource` sem esta data
 * (o caso comum antes desta missão) continua válido byte a byte.
 * Populado por `extractBalanceAsOfDate()`
 * (`efos/platform/classifiers/`), nunca inventado a partir do relógio
 * de execução (D-088/D-107 preservados).
 */
export interface Resource extends DomainEntity {
  readonly companyId: string;
  readonly financialModelId: string;
  readonly type: ResourceType;
  readonly label: string;
  readonly value?: Money;
  readonly asOfDate?: string;
}
