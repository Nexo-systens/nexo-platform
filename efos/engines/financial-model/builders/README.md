# Financial Model Engine — Builders

Status: **implementado (Mission 053 — Financial Statement Builder; Mission 054 — Balance Sheet Builder; Mission 055 — Income Statement Builder; Mission 056 — Cash Flow Builder; Mission 057 — KPI Builder; Mission 058 — Financial Health Builder; Mission 059 — Financial Risk Builder).** Diretório com os Builders do EFOS Core responsáveis por consolidar/organizar registros financeiros e indicadores. Nenhum cálculo financeiro novo, nenhuma IA, nenhuma inferência — apenas organização do que já existe.

**Nota — Mission 194 (Production Executive Report Truth & Presentation Audit, D-118).** As descrições de "residual"/"não classificado" de `BalanceSheetBuilder`/`IncomeStatementBuilder`/`CashFlowBuilder` abaixo (Missions 054-056) documentam o comportamento de CADA Builder isoladamente, dado QUALQUER coleção — continua exato e inalterado (nenhum Builder foi modificado para filtrar/remover nada, preservando "jamais criar/remover registros"). O que mudou foi `DefaultReportService.buildFinancialSections()`: até a Mission 194, os três Builders recebiam `execution.data` INTEIRO e idêntico, então cada demonstração mostrava os MESMOS registros de outras demonstrações caindo em seu grupo residual (ex.: uma linha de DRE aparecia na seção "Fluxo de Caixa"). Desde a Mission 194, cada Builder recebe apenas o SUBCONJUNTO de `execution.data` que pertence à sua demonstração por autoridade canônica de domínio: `kind === "resource"` → exclusivamente `BalanceSheetBuilder`; `kind !== "resource"` (statement_line + event) → `IncomeStatementBuilder`; `kind === "event"` → `CashFlowBuilder`. `IncomeStatementBuilder` também ganhou, na mesma missão, classificação real de `kind === "statement_line"` por `StatementCategory` (Receitas/Custos/Despesas/Financeiro/Tributos) — antes dela, TODA `StatementLine` caía em "Residual" independentemente de sua categoria (o defeito confirmado por três missões consecutivas, 191-193). Ver `docs/DECISIONS.md`, D-118, e `DefaultIncomeStatementBuilder.ts`/`DefaultReportService.ts` para o racional completo.

## `FinancialStatementBuilder` (Mission 053)

### Responsabilidade

`FinancialStatementBuilder`/`DefaultFinancialStatementBuilder` recebem uma coleção de `CandidateFinancialRecord` — tipo intermediário produzido pelo Mapper do Data Engine (`efos/engines/data/data.types.ts`, `data.mapper.ts`; definido lá como produtor oficial, mesma regra de D-002) — e devolvem essa mesma coleção, apenas reorganizada:

```
readonly CandidateFinancialRecord[] (qualquer ordem)
        ↓
agrupar por kind (recursos antes de eventos — mesma convenção de FinancialModelAggregate)
        ↓
agrupar por resourceType/eventType (ordem canônica já declarada pela Ontologia)
        ↓
ordenar por recordId (desempate final, sempre único)
        ↓
readonly CandidateFinancialRecord[] (mesmos registros, mesma referência de cada objeto — possivelmente reordenados)
```

Nenhum registro é criado. Nenhum valor, data, `label`, `currency`, `resourceType`, `eventType` ou `kind` é alterado. `amount` nunca é recalculado. Nenhum patrimônio, caixa ou fluxo é inferido. Cada `CandidateFinancialRecord` devolvido é exatamente o mesmo objeto recebido (mesma referência) — a única mudança observável possível é a **posição** de um registro dentro do array.

### Operações implementadas

Todas deterministas — nenhuma IA:

- **Agrupar registros / separar por tipo / separar recursos / separar eventos.** Registros com `kind === "resource"` ficam todos contíguos antes de registros com `kind === "event"` — a mesma convenção estrutural já usada por `FinancialModelAggregate` (`root` + `resources` + `events`, `efos/domain`), nenhuma ordem inventada. Dentro de cada `kind`, os registros são agrupados por `resourceType`/`eventType`, na ordem canônica já declarada pelo vocabulário oficial da Ontologia (`RESOURCE_TYPES`/`FINANCIAL_EVENT_TYPES`, `efos/domain/enums/domain-classification.ts`) — nenhuma heurística nova. Registros sem `resourceType`/`eventType` detectado ficam ao final do seu grupo de `kind`.
- **Ordenar registros / consolidar estrutura.** Dentro de cada grupo de tipo, os registros são ordenados por `recordId` (sempre único, campo já existente no contrato) — desempate determinístico final. Como `recordId` nunca se repete, o critério inteiro (kind → tipo → recordId) forma uma ordem total determinística: ordenar uma coleção já ordenada produz exatamente a mesma ordem (idempotente por construção).

### Por que `build()` não é chamado por `FinancialModelEngine.execute()` nesta missão

O CONTRATO desta missão especifica `build(records: readonly CandidateFinancialRecord[]): readonly CandidateFinancialRecord[]`. Porém o contrato oficial de entrada de `FinancialModelEngine.execute()` — `FinancialModelEngineInput.records: readonly NormalizedFinancialRecord[]` (`financial-model.types.ts`) — usa `NormalizedFinancialRecord`, não `CandidateFinancialRecord`; esses são tipos estruturalmente idênticos mas semanticamente distintos no Data Engine: `CandidateFinancialRecord` é a forma intermediária produzida pelo Mapper (`data.mapper.ts`), **antes** de qualquer limpeza/padronização; `NormalizedFinancialRecord` é a forma final já normalizada (`data.normalizer.ts`) e é o contrato oficial imutável entre Data Engine e Financial Model Engine (D-002).

Reescrever `FinancialModelEngineInput`/`execute()` para aceitar `CandidateFinancialRecord` alteraria um contrato oficial estabelecido (D-002) e obrigaria revisar todo consumidor já existente desse contrato (Application Layer, Platform, todos os módulos de `efos/platform/` construídos desde a Mission 045) — muito além do escopo único desta missão (REGRA 9, `docs/PROJECT_RULES.md`). Por isso `FinancialStatementBuilder` foi implementado literalmente conforme o CONTRATO da missão (`CandidateFinancialRecord`), como um módulo standalone dentro do próprio Financial Model Engine (`builders/`), exportado publicamente por `efos/engines/financial-model/index.ts` — disponível para uma futura orquestração usar como etapa de organização **antes** de dados chegarem normalizados ao Engine, mas não invocado automaticamente por `execute()` nesta missão. Ver D-033.

### Dependências permitidas

- `@/efos/engines/data` (`CandidateFinancialRecord`) — apenas por tipo, produtor oficial (D-002).
- `@/efos/domain` (`RESOURCE_TYPES`, `FINANCIAL_EVENT_TYPES`, `ResourceType`, `FinancialEventType`) — vocabulário já oficial da Ontologia, usado apenas para ordenação, nenhum enum novo.

## `BalanceSheetBuilder` (Mission 054)

### Responsabilidade

`BalanceSheetBuilder`/`DefaultBalanceSheetBuilder` recebem a mesma coleção de `NormalizedFinancialRecord` que `FinancialModelEngine.execute()` aceita — o contrato oficial e imutável de entrada do Engine (D-002) — e devolvem essa mesma coleção, organizada em três grupos do Balanço Patrimonial:

```
readonly NormalizedFinancialRecord[] (qualquer ordem)
        ↓
ATIVO (cash, client, inventory — circulante; asset, investment — não circulante)
        ↓
PASSIVO (supplier — circulante; loan — não circulante)
        ↓
PATRIMÔNIO LÍQUIDO (sempre vazio — ver "Por que PATRIMÔNIO LÍQUIDO nunca recebe registro")
        ↓
NÃO CLASSIFICADO (eventos; employee/contract/product/service; recursos sem resourceType)
        ↓
readonly NormalizedFinancialRecord[] (mesmos registros, mesma referência de cada objeto — possivelmente reordenados)
```

Nenhum registro é criado, alterado ou removido. Nenhum valor é recalculado. Nenhuma data é alterada. Cada `NormalizedFinancialRecord` devolvido é exatamente o mesmo objeto recebido (mesma referência) — a única mudança observável possível é a **posição** de um registro dentro do array.

### Operações implementadas

Usando exclusivamente `kind`, `resourceType` (campos já existentes) e a convenção de classificação já estabelecida em D-004 (`docs/DECISIONS.md`, `efos/engines/indicators/indicators.calculator.ts`, `extractFinancialStatementInputs`) — nenhuma heurística nova, nenhum cálculo, nenhuma inferência:

- **ATIVO.** `resourceType` `cash`/`client`/`inventory` (Ativo Circulante, nesta ordem) e `asset`/`investment` (Ativo Não Circulante, nesta ordem) — exatamente a mesma classificação e ordem já usada por D-004.
- **PASSIVO.** `resourceType` `supplier` (Passivo Circulante) e `loan` (Passivo Não Circulante) — mesma classificação de D-004.
- **PATRIMÔNIO LÍQUIDO.** Nenhum `resourceType` é classificado neste grupo. D-004 define Patrimônio Líquido como identidade contábil (**Ativo Total − Passivo Total**), nunca como classificação de um registro individual — não existe, na Ontologia atual, um `ResourceType` que represente Patrimônio Líquido. Classificar qualquer registro aqui exigiria inventar uma heurística nova, exatamente o que a missão proíbe ("jamais inferir patrimônio"). Este grupo existe na ordem (entre PASSIVO e o residual) porque a missão pede as três seções — mas permanece estruturalmente vazio até que uma futura decisão de domínio introduza um `ResourceType` dedicado.
- **NÃO CLASSIFICADO (residual).** Todo registro que a convenção de D-004 não cobre — todo registro com `kind === "event"` (eventos pertencem à Demonstração de Resultado, não ao Balanço Patrimonial) e todo recurso com `resourceType` `employee`/`contract`/`product`/`service`/ausente. Nunca descartados — apenas preservados ao final, satisfazendo "jamais criar/alterar registros" (o `build()` devolve o mesmo conjunto de entrada, sempre).
- **Ordenação/desempate.** Dentro de cada grupo, os registros são ordenados por `recordId` (sempre único) — desempate determinístico final, formando uma ordem total: idempotente por construção.

### Dependências permitidas

- `@/efos/engines/data` (`NormalizedFinancialRecord`) — apenas por tipo, contrato oficial de entrada do Engine (D-002).
- `@/efos/domain` (`ResourceType`) — apenas por tipo, vocabulário já oficial da Ontologia.

## `IncomeStatementBuilder` (Mission 055)

### Responsabilidade

`IncomeStatementBuilder`/`DefaultIncomeStatementBuilder` recebem a mesma coleção de `NormalizedFinancialRecord` que `FinancialModelEngine.execute()` aceita — o contrato oficial e imutável de entrada do Engine (D-002) — e devolvem essa mesma coleção, organizada nos seis grupos da Demonstração do Resultado (DRE):

```
readonly NormalizedFinancialRecord[] (qualquer ordem)
        ↓
Receitas (sale, receipt)
        ↓
Custos (purchase)
        ↓
Despesas (payment)
        ↓
Financeiro (sempre vazio — ver "Por que Financeiro e Tributos nunca recebem registro")
        ↓
Tributos (sempre vazio)
        ↓
Residual (hiring, termination, investment, financing, renegotiation, delinquency; todo kind === "resource")
        ↓
readonly NormalizedFinancialRecord[] (mesmos registros, mesma referência de cada objeto — possivelmente reordenados)
```

Nenhum registro é criado, removido ou alterado. `amount` nunca é recalculado. Lucro/EBITDA/margem nunca são inferidos. Nenhuma data ou `currency` é alterada. Cada `NormalizedFinancialRecord` devolvido é exatamente o mesmo objeto recebido (mesma referência) — a única mudança observável possível é a **posição** de um registro dentro do array.

### Operações implementadas

Usando exclusivamente `kind`, `eventType` (campos já existentes) e convenções já estabelecidas — nenhuma heurística nova, nenhum cálculo, nenhuma inferência:

- **Receitas.** `eventType` `sale` (D-004: Receita) e `receipt` — mesma classificação de `sale` como entrada de caixa operacional, já documentada pelo Evidence Engine ("mesmo espírito de D-004", `efos/engines/evidence/evidence.constants.ts`, `OPERATING_CASH_INFLOW_EVENT_TYPES`).
- **Custos.** `eventType` `purchase` — D-004: CMV.
- **Despesas.** `eventType` `payment` — D-004: Despesas Operacionais.
- **Financeiro / Tributos.** Nenhum `eventType` é classificado nestes dois grupos. Nenhuma convenção já estabelecida no projeto (D-004, Evidence Engine, ou qualquer outro Engine) classifica `financing`/`renegotiation`/`delinquency` como resultado financeiro, nem existe qualquer `FinancialEventType` para tributos/impostos — D-004 já registra explicitamente que "Impostos... não são modelados no domínio hoje... tratados como 0, nunca inventados". Classificar qualquer registro nesses grupos exigiria inventar uma heurística nova, exatamente o que a missão proíbe. Os dois grupos existem na ordem (a missão pede as seis seções) mas permanecem estruturalmente vazios até que uma futura decisão de domínio introduza convenção/vocabulário dedicado.
- **Residual.** Todo registro que nenhuma convenção acima cobre — `eventType` `hiring`/`termination`/`investment`/`financing`/`renegotiation`/`delinquency`, e todo registro com `kind === "resource"` (Resources não fazem parte da DRE; pertencem ao Balanço Patrimonial, `BalanceSheetBuilder`, Mission 054). Nunca descartados — apenas preservados ao final, satisfazendo "jamais criar/remover registros" (o `build()` devolve o mesmo conjunto de entrada, sempre).
- **Ordenação/desempate.** Dentro de cada grupo, os registros são ordenados pela ordem canônica de `eventType` já declarada por `FINANCIAL_EVENT_TYPES` (`efos/domain/enums/domain-classification.ts`), depois por `recordId` (sempre único) — desempate determinístico final, formando uma ordem total: idempotente por construção.

### Dependências permitidas

- `@/efos/engines/data` (`NormalizedFinancialRecord`) — apenas por tipo, contrato oficial de entrada do Engine (D-002).
- `@/efos/domain` (`FINANCIAL_EVENT_TYPES`, `FinancialEventType`) — vocabulário já oficial da Ontologia, usado apenas para ordenação, nenhum enum novo.

## `CashFlowBuilder` (Mission 056)

### Responsabilidade

`CashFlowBuilder`/`DefaultCashFlowBuilder` recebem a mesma coleção de `NormalizedFinancialRecord` que `FinancialModelEngine.execute()` aceita — o contrato oficial e imutável de entrada do Engine (D-002) — e devolvem essa mesma coleção, organizada em três grupos:

```
readonly NormalizedFinancialRecord[] (qualquer ordem)
        ↓
Entrada de Caixa Operacional (sale, receipt)
        ↓
Saída de Caixa Operacional (purchase, payment)
        ↓
Residual (todo o resto — ver "Por que não existem grupos de Investimento/Financiamento")
        ↓
readonly NormalizedFinancialRecord[] (mesmos registros, mesma referência de cada objeto — possivelmente reordenados)
```

Nenhum registro é criado, removido ou alterado. Nenhum valor/saldo é recalculado. Nenhum fluxo líquido é inferido. Nenhuma data ou `currency` é alterada. Cada `NormalizedFinancialRecord` devolvido é exatamente o mesmo objeto recebido (mesma referência) — a única mudança observável possível é a **posição** de um registro dentro do array.

### Operações implementadas

Usando exclusivamente `kind`, `eventType` (campos já existentes) e a única convenção oficial já estabelecida para Fluxo de Caixa — nenhuma heurística nova, nenhum cálculo, nenhuma inferência:

- **Entrada de Caixa Operacional.** `eventType` `sale`/`receipt` — mesmos dois valores já documentados como `OPERATING_CASH_INFLOW_EVENT_TYPES` pelo Evidence Engine (`efos/engines/evidence/evidence.constants.ts`, "mesmo espírito de D-004") e já reutilizados por `IncomeStatementBuilder` (Mission 055) para o grupo Receitas.
- **Saída de Caixa Operacional.** `eventType` `purchase`/`payment` — mesmos dois valores de `OPERATING_CASH_OUTFLOW_EVENT_TYPES` (Evidence Engine).
- **Por que não existem grupos de Investimento/Financiamento.** A Ontologia Financeira oficial e as convenções já estabelecidas no projeto (D-004; Evidence Engine) só classificam Entrada/Saída de Caixa **operacional** — não existe, hoje, nenhuma classificação oficial de Fluxo de Caixa de Investimento ou Financiamento (os `FinancialEventType` `investment`/`financing`/`renegotiation`/`delinquency` nunca foram classificados como tal por nenhum Engine já implementado). A missão instrui explicitamente: "Caso não exista classificação oficial para Fluxo de Caixa, não criar convenções novas" — por isso esses dois grupos simplesmente não existem nesta implementação, em vez de existirem vazios por design (diferente do padrão usado em PATRIMÔNIO LÍQUIDO/Financeiro/Tributos nas Missions 054/055, onde a própria missão exigia literalmente essas seções). Nenhuma decisão arquitetural nova foi necessária — a instrução da própria missão já resolve a ambiguidade.
- **Residual.** Todo registro que as duas convenções acima não cobrem — `eventType` `hiring`/`termination`/`investment`/`financing`/`renegotiation`/`delinquency`, e todo registro com `kind === "resource"`. Nunca descartados — apenas preservados ao final, satisfazendo "jamais criar/remover registros" (o `build()` devolve o mesmo conjunto de entrada, sempre).
- **Ordenação/desempate.** Dentro de cada grupo, os registros são ordenados pela ordem canônica de `eventType` já declarada por `FINANCIAL_EVENT_TYPES`, depois por `recordId` (sempre único) — desempate determinístico final, formando uma ordem total: idempotente por construção.

### Por que a classificação não foi importada diretamente do Evidence Engine

`OPERATING_CASH_INFLOW_EVENT_TYPES`/`OPERATING_CASH_OUTFLOW_EVENT_TYPES` (`efos/engines/evidence/evidence.constants.ts`) são exportados publicamente por `efos/engines/evidence/index.ts`, mas o Financial Model Engine (estágio 2 da cadeia principal, `docs/DECISIONS.md` D-006) nunca deve depender do Evidence Engine (estágio 5) — um Engine anterior no pipeline nunca importa de um Engine posterior. Por isso os mesmos quatro `FinancialEventType` foram reproduzidos aqui como constante local, com a origem documentada em comentário — mesmos valores, nenhuma heurística nova, sem violar a direção de dependência entre Engines.

### Dependências permitidas

- `@/efos/engines/data` (`NormalizedFinancialRecord`) — apenas por tipo, contrato oficial de entrada do Engine (D-002).
- `@/efos/domain` (`FINANCIAL_EVENT_TYPES`, `FinancialEventType`) — vocabulário já oficial da Ontologia, usado apenas para ordenação, nenhum enum novo.

## `KPIBuilder` (Mission 057)

### Responsabilidade

`KPIBuilder`/`DefaultKPIBuilder` recebem uma coleção de `Indicator` — a entidade oficial já existente no domínio (`efos/domain/entities/Indicator.ts`), o mesmo tipo produzido pelo Indicators Engine (`IndicatorsAggregate.indicators`) — e devolvem essa mesma coleção, organizada em cinco grupos mais um residual:

```
readonly Indicator[] (qualquer ordem)
        ↓
Liquidez (category === "liquidity")
        ↓
Rentabilidade (category === "profitability")
        ↓
Endividamento (category === "debt")
        ↓
Eficiência (category === "efficiency")
        ↓
Crescimento (category === "growth")
        ↓
Residual (category === "solvency"/"risk"/"competitiveness", ou qualquer categoria não reconhecida)
        ↓
readonly Indicator[] (mesmos indicadores, mesma referência de cada objeto — possivelmente reordenados)
```

Nenhum indicador é criado, removido ou recalculado. Nenhum valor, `unit`, fórmula ou data é alterada. Cada `Indicator` devolvido é exatamente o mesmo objeto recebido (mesma referência) — a única mudança observável possível é a **posição** de um indicador dentro do array.

### Por que o tipo é `Indicator`, não `FinancialIndicator`

O CONTRATO da missão especifica `build(indicators: readonly FinancialIndicator[]): readonly FinancialIndicator[]` e instrui explicitamente "utilizar exatamente o tipo oficial já existente no domínio do EFOS... não criar novo DTO... não criar novo tipo paralelo". Porém **nenhum tipo chamado `FinancialIndicator` existe** em `efos/domain` ou em qualquer Engine do projeto — o único tipo oficial já existente com exatamente os campos descritos pela missão (`category`, `name`) é `Indicator` (`efos/domain/entities/Indicator.ts`, Mission 003/D-003), o mesmo produzido pelo Indicators Engine. Seguindo a própria instrução da missão ("usar o tipo oficial já existente", "não criar novo tipo paralelo"), `KPIBuilder`/`DefaultKPIBuilder` usam `Indicator` — a leitura mais literal possível da instrução, já que criar um tipo `FinancialIndicator` novo (mesmo que apenas um alias) seria exatamente o "tipo paralelo" que a missão proíbe.

### Por que o desempate final usa `name`, não `code`

A missão pede "desempate final por código oficial do indicador", mas `Indicator` não tem nenhum campo `code` — apenas `name`. `name` é o único campo do contrato oficial que identifica de forma legível e estável qual indicador é qual (cada um dos vinte indicadores calculados pelo Indicators Engine tem um `name` único e fixo, `efos/engines/indicators/indicators.constants.ts`, `INDICATOR_DEFINITIONS`) — mesmo racional já documentado pelo Evidence Engine para o mesmo campo (`RECOGNIZED_INDICATOR_NAMES`, `evidence.constants.ts`: "`Indicator` não expõe um `slug`/`key` estável — `name`... é o único campo do contrato oficial que identifica de forma legível qual indicador é qual"). Por isso `name` cumpre aqui o papel de "código oficial" pedido pela missão — nenhum campo novo foi criado, nenhuma heurística inventada.

### Operações implementadas

Usando exclusivamente `category` (campo já existente) — nenhuma heurística nova, nenhum cálculo, nenhuma inferência:

- **Liquidez / Rentabilidade / Endividamento / Eficiência / Crescimento.** `Indicator.category` já é um `FinancialStateCategory` (`efos/domain/enums/domain-classification.ts`) — quatro dos oito valores desse enum correspondem diretamente, pelo próprio nome, aos grupos pedidos pela missão: `liquidity`→Liquidez, `profitability`→Rentabilidade, `debt`→Endividamento, `efficiency`→Eficiência, `growth`→Crescimento. Mapeamento direto, nenhuma tradução/heurística — apenas reconhecer o vocabulário já oficial.
- **Residual.** `category` `solvency`/`risk`/`competitiveness` (os três valores restantes do enum, nunca usados por nenhum dos vinte indicadores hoje calculados pelo Indicators Engine — `INDICATOR_DEFINITIONS`) e qualquer categoria não reconhecida. Nunca descartados — apenas preservados ao final, satisfazendo "jamais criar/remover indicadores" (o `build()` devolve o mesmo conjunto de entrada, sempre).
- **Ordenação/desempate.** Dentro de cada grupo, os indicadores são ordenados por `name` (sempre único entre os vinte indicadores oficiais) — desempate determinístico final, formando uma ordem total: idempotente por construção.

### Dependências permitidas

- `@/efos/domain` (`Indicator`, `FinancialStateCategory`) — apenas por tipo, entidade e vocabulário já oficiais do domínio.

## `FinancialHealthBuilder` (Mission 058)

### Responsabilidade

`FinancialHealthBuilder`/`DefaultFinancialHealthBuilder` recebem uma coleção de `Indicator` — mesmo tipo já usado por `KPIBuilder` (Mission 057) — e devolvem essa mesma coleção, organizada em cinco grupos mais um residual:

```
readonly Indicator[] (qualquer ordem)
        ↓
Liquidez (category === "liquidity")
        ↓
Solvência (category === "solvency" — estruturalmente vazio hoje, ver abaixo)
        ↓
Rentabilidade (category === "profitability")
        ↓
Eficiência (category === "efficiency")
        ↓
Crescimento (category === "growth")
        ↓
Residual (category === "debt"/"risk"/"competitiveness", ou qualquer categoria não reconhecida)
        ↓
readonly Indicator[] (mesmos indicadores, mesma referência de cada objeto — possivelmente reordenados)
```

Nenhum indicador é criado, removido ou recalculado. Nenhum valor, `unit` ou fórmula é alterada. Nenhum score, nota ou classificação é criado. Cada `Indicator` devolvido é exatamente o mesmo objeto recebido (mesma referência) — a única mudança observável possível é a **posição** de um indicador dentro do array.

### Mesmas duas resoluções já documentadas em `KPIBuilder` (Mission 057)

O CONTRATO desta missão repete o mesmo padrão da Mission 057: especifica `FinancialIndicator` (tipo inexistente no domínio) e pede desempate por "código oficial do indicador" (campo `code`, também inexistente em `Indicator`). Mesma resolução, sem repetir aqui todo o racional (ver seção `KPIBuilder` acima): o tipo usado é `Indicator`, e o desempate usa `name`.

### Por que Solvência é diferente de Endividamento (`KPIBuilder`, Mission 057)

`KPIBuilder` (Mission 057) pedia um grupo "Endividamento", mapeado para `category: "debt"`. Esta missão pede um grupo diferente, "Solvência", mapeado literalmente para `category: "solvency"` — os dois são valores distintos do mesmo enum `FinancialStateCategory`. Nenhum dos vinte indicadores hoje calculados pelo Indicators Engine (`efos/engines/indicators/indicators.constants.ts`, `INDICATOR_DEFINITIONS`) usa `category: "solvency"` — todos os indicadores de dívida usam `category: "debt"` (Endividamento Geral, Composição do Endividamento, Cobertura de Juros). Por isso o grupo Solvência é **estruturalmente vazio** nesta implementação: não por uma convenção nova inventada, mas porque o mapeamento literal e direto do enum (a única regra permitida, sem heurística) não encontra nenhum indicador com essa categoria hoje. `category: "debt"` cai no grupo Residual desta missão (já que "Endividamento" não está entre os cinco grupos pedidos aqui).

### Operações implementadas

Usando exclusivamente `category` (campo já existente) — nenhuma heurística nova, nenhum cálculo, nenhuma inferência:

- **Liquidez / Solvência / Rentabilidade / Eficiência / Crescimento.** Mapeamento direto pelo próprio nome do enum `FinancialStateCategory`: `liquidity`→Liquidez, `solvency`→Solvência, `profitability`→Rentabilidade, `efficiency`→Eficiência, `growth`→Crescimento.
- **Residual.** `category` `debt`/`risk`/`competitiveness` e qualquer categoria não reconhecida. Nunca descartados — apenas preservados ao final, satisfazendo "jamais criar/remover indicadores".
- **Ordenação/desempate.** Dentro de cada grupo, os indicadores são ordenados por `name` (sempre único) — desempate determinístico final, formando uma ordem total: idempotente por construção.

### Dependências permitidas

- `@/efos/domain` (`Indicator`, `FinancialStateCategory`) — apenas por tipo, entidade e vocabulário já oficiais do domínio.

## `FinancialRiskBuilder` (Mission 059)

### Responsabilidade

`FinancialRiskBuilder`/`DefaultFinancialRiskBuilder` recebem uma coleção de `Indicator` — mesmo tipo já usado por `KPIBuilder` (Mission 057) e `FinancialHealthBuilder` (Mission 058) — e devolvem essa mesma coleção, organizada em cinco grupos mais um residual:

```
readonly Indicator[] (qualquer ordem)
        ↓
Endividamento (category === "debt")
        ↓
Liquidez (category === "liquidity")
        ↓
Rentabilidade (category === "profitability")
        ↓
Eficiência (category === "efficiency")
        ↓
Crescimento (category === "growth")
        ↓
Residual (category === "solvency"/"risk"/"competitiveness", ou qualquer categoria não reconhecida)
        ↓
readonly Indicator[] (mesmos indicadores, mesma referência de cada objeto — possivelmente reordenados)
```

Nenhum indicador é criado, removido ou alterado. Nenhum `value`, `unit`, `category` ou `name` é alterado. Nenhum score, probabilidade, risco, rating ou classificação é calculado/criado; nenhum alerta, perigo ou solvência é inferido. Cada `Indicator` devolvido é exatamente o mesmo objeto recebido (mesma referência) — a única mudança observável possível é a **posição** de um indicador dentro do array. Este Builder organiza — ele não interpreta.

### Mesmas duas resoluções já documentadas em `KPIBuilder` (Mission 057)

O tipo é `Indicator` — nenhum `FinancialRiskIndicator`/`RiskDTO`/`RiskScore`/enum novo foi criado, exatamente como a missão instrui explicitamente. O desempate usa `name` — `Indicator` não tem campo `code`; `name` já é documentado como o único campo que identifica de forma estável qual indicador é qual (mesmo racional já usado em `KPIBuilder`/`FinancialHealthBuilder`).

### Por que Endividamento aqui é diferente de Solvência em `FinancialHealthBuilder` (Mission 058)

`FinancialHealthBuilder` (Mission 058) pedia um grupo "Solvência" (`category: "solvency"`, estruturalmente vazio hoje) e deixava `category: "debt"` no grupo residual. Esta missão pede o oposto: um grupo "Endividamento" mapeado para `category: "debt"` — mesmo mapeamento já usado por `KPIBuilder` (Mission 057). Como todos os indicadores de dívida hoje calculados pelo Indicators Engine usam `category: "debt"` (Endividamento Geral, Composição do Endividamento, Cobertura de Juros — `indicators.constants.ts`, `INDICATOR_DEFINITIONS`), o grupo Endividamento desta missão **não é vazio** — ao contrário de Solvência na Mission 058. Nesta missão, `category: "solvency"` (sem indicador algum hoje) cai no grupo residual.

### Operações implementadas

Usando exclusivamente `category` (campo já existente) — nenhuma heurística nova, nenhum cálculo, nenhuma inferência, nenhuma classificação de risco nova:

- **Endividamento / Liquidez / Rentabilidade / Eficiência / Crescimento.** Mapeamento direto pelo próprio nome do enum `FinancialStateCategory`: `debt`→Endividamento, `liquidity`→Liquidez, `profitability`→Rentabilidade, `efficiency`→Eficiência, `growth`→Crescimento.
- **Residual.** `category` `solvency`/`risk`/`competitiveness` e qualquer categoria não reconhecida. Nunca descartados — apenas preservados ao final, satisfazendo "nenhum indicador pode desaparecer".
- **Ordenação/desempate.** Dentro de cada grupo, os indicadores são ordenados por `name` (sempre único) — desempate determinístico final, formando uma ordem total: idempotente por construção.

### Por que ainda não está integrado a `FinancialModelEngine.execute()`

A missão instrui explicitamente: "Não integrar ainda ao `FinancialModelEngine.execute()`. A integração efetiva dos Builders será tratada posteriormente em uma missão própria." — mesmo estado dos seis Builders anteriores (Missions 053–058): todos exportados publicamente por `efos/engines/financial-model/index.ts`, nenhum chamado por `execute()`.

### Dependências permitidas

- `@/efos/domain` (`Indicator`, `FinancialStateCategory`) — apenas por tipo, entidade e vocabulário já oficiais do domínio.

## Verificação de que o Engine continua funcionando

`FinancialModelEngine.execute()` não foi alterado por nenhum dos sete Builders — nenhuma linha de `financial-model.engine.ts`, `financial-model.types.ts`, `financial-model.mapper.ts` ou `financial-model.validator.ts` foi modificada. Todos os Builders são aditivos: novos módulos, novas exportações em `index.ts`, nenhuma mudança de comportamento em código já existente.

## Dependências proibidas

- **Application/Platform/Infrastructure/Bootstrap/Persistence/Pipeline/Runtime/Repository** — `DefaultFinancialStatementBuilder`/`DefaultBalanceSheetBuilder`/`DefaultIncomeStatementBuilder`/`DefaultCashFlowBuilder`/`DefaultKPIBuilder`/`DefaultFinancialHealthBuilder`/`DefaultFinancialRiskBuilder` são peças isoladas, autocontidas, que só devolvem a mesma coleção recebida.
- **Engines posteriores na cadeia principal** (Evidence Engine e além) — nenhum Builder do Financial Model Engine importa de um Engine posterior; convenções já estabelecidas por Engines posteriores são reproduzidas localmente, nunca importadas.
- **IA, inferência, heurística nova** — toda ordenação usa exclusivamente campos já existentes (`kind`/`resourceType`/`eventType`/`recordId`/`category`/`name`) e convenções já estabelecidas (`RESOURCE_TYPES`/`FINANCIAL_EVENT_TYPES`/`FinancialStateCategory` da Ontologia; D-004 para o Balanço Patrimonial e a DRE; a mesma classificação de Entrada/Saída de Caixa Operacional já documentada pelo Evidence Engine).
- **Qualquer alteração de dado** — valores, datas, labels, classificação, `currency`, `unit`, fórmula: nada é criado, removido ou modificado. Apenas a ordem do array pode mudar. Nenhum score, nota, rating, classificação de risco ou saúde financeira é criado.
