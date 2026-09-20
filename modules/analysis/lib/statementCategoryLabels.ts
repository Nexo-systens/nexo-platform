import type { StatementCategory } from "@/efos/domain";

/**
 * Mission 194 — Production Executive Report Truth & Presentation
 * Audit, Seção 20/45. Rótulo executivo, em português, para cada
 * `StatementCategory` (`efos/domain/enums/financial-statement.ts`,
 * D-106) — mesmo princípio já estabelecido por
 * `DOCUMENT_GOVERNANCE_LABELS` (`app/api/efos/_shared/documentGovernance.ts`):
 * o vocabulário técnico fechado nunca vaza como string literal em
 * inglês para um executivo (ex.: `"cost_of_goods_services"`). Nenhuma
 * tradução nova de significado — apenas o nome em português da mesma
 * categoria já canônica, determinístico, nunca gerado por IA.
 */
export const STATEMENT_CATEGORY_LABELS: Record<StatementCategory, string> = {
  gross_revenue: "Receita Bruta",
  revenue_deductions: "Deduções da Receita",
  net_revenue: "Receita Líquida",
  cost_of_goods_services: "Custo dos Produtos/Serviços Vendidos",
  gross_profit: "Lucro Bruto",
  operating_expense: "Despesa Operacional",
  financial_income: "Receita Financeira",
  financial_expense: "Despesa Financeira",
  financial_result: "Resultado Financeiro",
  taxes: "Impostos",
  net_income: "Lucro Líquido",
};
