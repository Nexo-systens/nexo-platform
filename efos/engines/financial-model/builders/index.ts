// Financial Model Engine — Builders. Ver README.md deste diretorio.
// FinancialStatementBuilder/DefaultFinancialStatementBuilder
// (Mission 053) e o primeiro Builder do EFOS Core responsavel por
// consolidar registros financeiros em demonstracoes — apenas organiza
// (agrupa/ordena/separa por tipo) os registros ja existentes; nunca
// cria registro, altera valor/data, recalcula amount ou infere nada.
// BalanceSheetBuilder/DefaultBalanceSheetBuilder (Mission 054) e o
// primeiro Builder responsavel pela estrutura do Balanco Patrimonial —
// organiza registros ja normalizados em ATIVO/PASSIVO/PATRIMONIO
// LIQUIDO usando exclusivamente kind/resourceType e a convencao ja
// estabelecida em D-004; nunca cria/altera registro, nunca infere
// patrimonio/caixa/saldo.
// IncomeStatementBuilder/DefaultIncomeStatementBuilder (Mission 055) e
// o Builder oficial responsavel por organizar os registros da
// Demonstracao do Resultado (DRE) — Receitas/Custos/Despesas/
// Financeiro/Tributos/Residual, usando exclusivamente kind/eventType e
// convencoes ja estabelecidas (D-004, Evidence Engine); nunca
// cria/altera/recalcula registro algum.
// CashFlowBuilder/DefaultCashFlowBuilder (Mission 056) e o Builder
// oficial responsavel por organizar os registros do Fluxo de Caixa —
// Entrada/Saida de Caixa Operacional/Residual, usando exclusivamente
// kind/eventType; sem classificacao oficial de Investimento/
// Financiamento, nenhuma convencao nova foi criada para esses grupos
// (instrucao explicita da missao); nunca cria/altera/recalcula
// registro algum.
// KPIBuilder/DefaultKPIBuilder (Mission 057) e o Builder oficial
// responsavel por organizar os indicadores (Indicator, dominio
// oficial) produzidos pelo Indicators Engine — Liquidez/Rentabilidade/
// Endividamento/Eficiencia/Crescimento/Residual, usando exclusivamente
// category (FinancialStateCategory); desempate por name; nunca
// recalcula/cria/remove/altera indicador algum.
// FinancialHealthBuilder/DefaultFinancialHealthBuilder (Mission 058) e
// o Builder oficial responsavel por organizar indicadores para
// avaliacao da saude financeira — Liquidez/Solvencia/Rentabilidade/
// Eficiencia/Crescimento/Residual, usando exclusivamente category;
// desempate por name; nunca recalcula/cria/remove/altera indicador,
// nunca cria score/nota/classificacao.
// FinancialRiskBuilder/DefaultFinancialRiskBuilder (Mission 059) e o
// Builder oficial responsavel por organizar indicadores relacionados a
// analise de risco — Endividamento/Liquidez/Rentabilidade/Eficiencia/
// Crescimento/Residual, usando exclusivamente category; desempate por
// name; nunca calcula score/probabilidade/risco, nunca cria rating,
// nunca infere alerta/perigo/solvencia. Ainda nao integrado a
// FinancialModelEngine.execute() (missao propria futura).
export * from "./FinancialStatementBuilder";
export * from "./DefaultFinancialStatementBuilder";
export * from "./BalanceSheetBuilder";
export * from "./DefaultBalanceSheetBuilder";
export * from "./IncomeStatementBuilder";
export * from "./DefaultIncomeStatementBuilder";
export * from "./CashFlowBuilder";
export * from "./DefaultCashFlowBuilder";
export * from "./KPIBuilder";
export * from "./DefaultKPIBuilder";
export * from "./FinancialHealthBuilder";
export * from "./DefaultFinancialHealthBuilder";
export * from "./FinancialRiskBuilder";
export * from "./DefaultFinancialRiskBuilder";
