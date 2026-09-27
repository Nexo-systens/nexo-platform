import type { FinancialEventType, ResourceType } from "@/efos/domain";

/**
 * Mission 203 — rótulos executivos para `ResourceType`/`FinancialEventType`
 * na tabela de registros financeiros. Antes, a coluna "Tipo" mostrava o
 * nome literal do enum em inglês (`cash`, `sale`, `payment`) — vocabulário
 * interno vazando para o usuário (mesmo princípio de
 * `STATEMENT_CATEGORY_LABELS`). `Record<...>` exaustivo: um tipo novo no
 * domínio sem rótulo falha na compilação.
 */
export const RESOURCE_TYPE_LABELS: Readonly<Record<ResourceType, string>> = {
  cash: "Caixa",
  client: "Clientes",
  employee: "Pessoal",
  supplier: "Fornecedores",
  product: "Produto",
  service: "Serviço",
  contract: "Contrato",
  inventory: "Estoque",
  loan: "Empréstimo",
  investment: "Investimento",
  asset: "Ativo",
};

export const FINANCIAL_EVENT_TYPE_LABELS: Readonly<Record<FinancialEventType, string>> = {
  sale: "Venda",
  purchase: "Compra",
  payment: "Pagamento",
  receipt: "Recebimento",
  hiring: "Contratação",
  termination: "Desligamento",
  investment: "Investimento",
  financing: "Financiamento",
  renegotiation: "Renegociação",
  delinquency: "Inadimplência",
  interest_expense: "Despesa de juros",
};
