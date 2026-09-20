# Scenario Simulation (Mission 180)

Primeira vertical real de simulação financeira do EFOS — resposta
determinística a "o que acontece se eu mudar Despesas Operacionais?",
nunca uma previsão/forecast (Product Vision: "Não entregamos previsões.
Entregamos cenários.").

Selecionada entre os candidatos da Seção 7 (receita, custo operacional,
custo fixo, contratação/folha, margem bruta, investimento/capex, prazo
de pagamento/recebimento, dívida) por ser a única que não exige inventar
uma relação financeira não suportada pelo modelo atual — `operatingExpenses`
já é um campo de entrada direto de `FinancialStatementInputs`
(`efos/engines/indicators/`), então simulá-lo nunca precisa decompor
custo fixo/variável (o problema explícito da missão para "Receita
+20% ⇒ Lucro +20%") nem inventar salário médio por funcionário (o
problema explícito para "Contratar 5 funcionários").

`simulateOperatingCostScenario()` é pura — nunca acessa Supabase/banco/
relógio/IA, nunca muta o `FinancialModelAggregate` recebido. Reaproveita
integralmente `extractFinancialStatementInputs()`/
`extractFinancialStatementInputSources()`/`calculateIndicators()`
(`efos/engines/indicators/indicators.calculator.ts`) — a MESMA
implementação de fórmula já em produção, nenhuma segunda cópia. A única
adição ao Indicators Engine nesta missão foi extrair
`deriveIncomeStatementResults()` (Lucro Bruto/EBITDA/EBIT/Lucro
Líquido) de dentro de `extractFinancialStatementInputs()` para uma
função própria, reaproveitável por esta composição sem duplicar a
fórmula.

Baseline sempre resolvido via `resolveCurrentFinancialExecution()`
(`modules/decisions/lib/selectCurrentFinancialExecution.ts`, D-088/
D-089/D-090) — nunca `executedAt`/última linha/ordem de array. Uma
verdade financeira ambígua ou ausente falha fechado antes de qualquer
cálculo (nenhuma simulação "aproximada").

`ScenarioProjection` nunca estende `DomainEntity` — não há persistência
nesta missão (Seção 18: preferir nenhuma persistência nova até a
semântica da simulação estar provada) e, portanto, nenhuma identidade a
preservar (Seção 24: "A Scenario is hypothetical, not an execution").

Comparação (`comparison`) inclui exclusivamente os indicadores
causalmente afetados por uma mudança em `operatingExpenses`
(`ebitda`/`ebit`/`netIncome`/`operatingMargin`/`netMargin`/`roi`/`roe`/
`roa`/`interestCoverage`) — nunca indicadores de balanço patrimonial ou
de giro (liquidez, endividamento, prazos médios, `grossMargin`), que
esta vertical nunca toca. `delta` é sempre `projetado - base` na
própria unidade do indicador (`INDICATOR_DEFINITIONS`, nunca um segundo
dicionário) — para indicadores `percentage`, isso é sempre pontos
percentuais, nunca variação percentual relativa.

Reaproveita `ScenarioType` (`efos/domain/enums/decision.ts`, já
existente desde a fundação do domínio, nunca antes instanciado por
nenhum código) restrito a `"hire"`/`"reduce_workforce"` — as duas
narrativas de negócio que already correspondem, respectivamente, a um
aumento e a uma redução de despesa operacional. Nenhum novo valor de
enum foi adicionado.
