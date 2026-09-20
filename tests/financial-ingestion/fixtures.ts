import type { RawFinancialDocument, RawFinancialLine } from "@/efos/engines/data";

/**
 * Mission 193 — Production Intake Governance & Permanent Regression
 * Gate, Seção 34. Fixtures realistas — texto em português, formato
 * numérico brasileiro, cabeçalho de período/data-base, subtotais — em
 * vez de objetos já pré-classificados. Cada `RawFinancialLine` aqui
 * carrega APENAS `label` (texto bruto), exatamente como um Parser real
 * (`DefaultPdfParser`/`DefaultCsvParser`) entregaria antes de qualquer
 * classificação — os testes que consomem estas fixtures rodam através
 * dos classificadores REAIS (`DefaultFinancialStatementClassifier`/
 * `DefaultFinancialLineClassifier`), nunca através de linhas
 * pré-rotuladas artificialmente.
 *
 * Nenhum documento de cliente real — todos os valores são fictícios,
 * escolhidos apenas para provar as propriedades aritméticas exigidas
 * por cada teste.
 */

function line(label: string): RawFinancialLine {
  return { label };
}

function doc(documentId: string, companyId: string, source: string, lines: readonly string[]): RawFinancialDocument {
  return { documentId, companyId, source, lines: lines.map(line) };
}

/**
 * DRE realista de Julho/2026, aritmeticamente CONSISTENTE de ponta a
 * ponta (prova central, Seção 9 da Mission 192 Closure — recalculada
 * aqui com valores próprios desta missão):
 *
 * Receita Bruta 1.200.000 − Impostos s/ Vendas 108.000 = Receita
 * Líquida 1.092.000; − CMV 500.000 = Lucro Bruto 592.000; − Despesas
 * Operacionais 200.000 (Vendas 120.000 + Administrativas 80.000) =
 * EBIT 392.000; + Resultado Financeiro (Receitas 15.000 − Despesas
 * 95.000 = −80.000) − Impostos sobre o Lucro (IRPJ 45.000 + CSLL
 * 25.000 = 70.000) = Lucro Líquido 242.000 — bate byte a byte com a
 * linha declarada abaixo.
 */
export function buildRealisticDre(
  documentId: string,
  companyId: string,
  options?: { readonly source?: string; readonly netIncomeOverride?: string }
): RawFinancialDocument {
  return doc(documentId, companyId, options?.source ?? "dre_julho_2026.pdf", [
    "Demonstração do Resultado do Exercício",
    "Período: 01/07/2026 a 31/07/2026",
    "Receita Bruta de Vendas R$ 1.200.000,00",
    "Impostos sobre Vendas (R$ 108.000,00)",
    "Receita Líquida de Vendas R$ 1.092.000,00",
    "Custo dos Produtos Vendidos (R$ 500.000,00)",
    "Lucro Bruto R$ 592.000,00",
    "Despesas com Vendas (R$ 120.000,00)",
    "Despesas Administrativas (R$ 80.000,00)",
    "Total de Despesas Operacionais (R$ 200.000,00)",
    "Receitas Financeiras R$ 15.000,00",
    "Despesas Financeiras (R$ 95.000,00)",
    "IRPJ (R$ 45.000,00)",
    "CSLL (R$ 25.000,00)",
    `Lucro Líquido do Exercício ${options?.netIncomeOverride ?? "R$ 242.000,00"}`,
  ]);
}

/** Mesmo DRE, com Receita Bruta materialmente diferente (999.000 em vez de 1.200.000) — mesmo período, conflito genuíno. */
export function buildConflictingDre(documentId: string, companyId: string, source: string): RawFinancialDocument {
  return doc(documentId, companyId, source, [
    "Demonstração do Resultado do Exercício",
    "Período: 01/07/2026 a 31/07/2026",
    "Receita Bruta de Vendas R$ 999.000,00",
    "Custo dos Produtos Vendidos (R$ 500.000,00)",
  ]);
}

/** DRE de Agosto/2026 — período genuinamente diferente do de Julho, nunca somado a ele. */
export function buildAugustDre(documentId: string, companyId: string): RawFinancialDocument {
  return doc(documentId, companyId, "dre_agosto_2026.pdf", [
    "Demonstração do Resultado do Exercício",
    "Período: 01/08/2026 a 31/08/2026",
    "Receita Bruta de Vendas R$ 1.500.000,00",
    "Custo dos Produtos Vendidos (R$ 600.000,00)",
  ]);
}

/** DRE reconhecível mas sem período determinável — Mission 192, D-108 (`invalid_document`). */
export function buildDreWithoutPeriod(documentId: string, companyId: string): RawFinancialDocument {
  return doc(documentId, companyId, "dre_sem_periodo.pdf", [
    "Demonstração do Resultado do Exercício",
    "Receita Bruta de Vendas R$ 1.200.000,00",
    "Custo dos Produtos Vendidos (R$ 500.000,00)",
  ]);
}

/**
 * Balanço Patrimonial realista, data-base 31/07/2026: Caixa 350.000 +
 * Clientes 420.000 + Estoques 180.000 = Ativo Circulante 950.000;
 * Fornecedores 210.000 + Empréstimos 300.000 = Passivo 510.000.
 */
export function buildRealisticBalance(
  documentId: string,
  companyId: string,
  options?: { readonly source?: string; readonly asOfDate?: string; readonly cash?: string }
): RawFinancialDocument {
  const asOfDate = options?.asOfDate ?? "31/07/2026";
  return doc(documentId, companyId, options?.source ?? "balanco_julho_2026.pdf", [
    "Balanço Patrimonial",
    `Data-base: ${asOfDate}`,
    `Caixa e Equivalentes de Caixa ${options?.cash ?? "R$ 350.000,00"}`,
    "Clientes R$ 420.000,00",
    "Estoques R$ 180.000,00",
    "Fornecedores R$ 210.000,00",
    "Empréstimos R$ 300.000,00",
    "Patrimônio Líquido R$ 440.000,00",
  ]);
}

/** Extrato bancário realista de Julho/2026 — transações datadas, nunca confundidas com demonstrativo. */
export function buildRealisticBankStatement(documentId: string, companyId: string): RawFinancialDocument {
  return doc(documentId, companyId, "extrato_julho_2026.pdf", [
    "Extrato Bancário — Conta Corrente",
    "15/07/2026 Recebimento de Cliente R$ 85.000,00",
    "18/07/2026 Pagamento a Fornecedor R$ 32.000,00",
    "22/07/2026 Recebimento de Cliente R$ 40.000,00",
  ]);
}

/** DRE contendo APENAS Despesas Operacionais — nenhuma linha de receita (prova de precedência category-specific, D-109). */
export function buildOperatingExpenseOnlyDre(documentId: string, companyId: string): RawFinancialDocument {
  return doc(documentId, companyId, "dre_apenas_despesas.pdf", [
    "Demonstração do Resultado do Exercício",
    "Período: 01/07/2026 a 31/07/2026",
    "Total de Despesas Operacionais (R$ 50.000,00)",
  ]);
}
