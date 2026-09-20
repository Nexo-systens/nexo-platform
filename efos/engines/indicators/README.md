# Indicators Engine

Status: **implementado (Mission 007).** Quarto estágio do pipeline oficial (`efos/types/pipeline.ts`), calculando indicadores financeiros determinísticos a partir do Financial Model.

## Objetivo

Transformar o Financial Model de uma empresa em indicadores financeiros canônicos — Liquidez, Margem, EBITDA, ROE, Ciclo Financeiro, entre outros. É o primeiro Engine a produzir inteligência quantitativa do EFOS. (`docs/ARCHITECTURE.md`, "Responsabilidade de cada Engine")

## Responsabilidade

- Validar estruturalmente a entrada (`indicators.validator.ts`).
- Extrair inputs contábeis estruturados do `FinancialModelAggregate` (`indicators.calculator.ts`, `extractFinancialStatementInputs`), aplicando a convenção de classificação registrada em `docs/DECISIONS.md`, D-004.
- Calcular todas as fórmulas (`indicators.calculator.ts`, `calculateIndicators`).
- Mapear os resultados brutos para o contrato oficial de domínio (`indicators.mapper.ts` → `IndicatorsAggregate`, `efos/domain`).

**Não interpreta resultados, não produz recomendações, não gera contexto, não gera evidências, não usa IA, não persiste nada, não chama outro Engine.** Apenas calcula, organiza e disponibiliza indicadores — ver "Limitações" abaixo para o que isso implica na prática.

## Fluxo

```
IndicatorsEngineInput { companyId, financialModel }
        ↓
validateIndicatorsEngineInput()  →  falha? retorna EfosEngineResult{status:"failed"}
        ↓ (válido)
extractFinancialStatementInputs(financialModel)   — classifica Resources/Events (D-004)
        ↓
calculateIndicators(statementInputs)              — 20 fórmulas puras
        ↓
mapCalculatedIndicatorsToAggregate(...)           — resultado bruto → Indicator[] (efos/domain)
        ↓
EfosEngineResult{status:"completed", output: IndicatorsAggregate}
```

## Entrada

`IndicatorsEngineInput`: `companyId` + `financialModel` (`FinancialModelAggregate`, produzido pelo Financial Model Engine — `efos/engines/financial-model`). Este Engine nunca chama `FinancialModelEngine.execute()`; recebe o agregado já pronto (D-002).

## Saída

`EfosEngineResult<IndicatorsAggregate>` — em caso de sucesso, `output` é um `IndicatorsAggregate` (`efos/domain`): `companyId` + `financialModelId` + 20 `Indicator[]`, um por fórmula da lista abaixo.

## Indicadores calculados

| Indicador | Categoria | Unidade | Fórmula |
|---|---|---|---|
| Liquidez Corrente | liquidity | ratio | Ativo Circulante / Passivo Circulante |
| Liquidez Seca | liquidity | ratio | (Ativo Circulante − Estoque) / Passivo Circulante |
| Liquidez Imediata | liquidity | ratio | Caixa / Passivo Circulante |
| Capital de Giro | liquidity | currency | Ativo Circulante − Passivo Circulante |
| Margem Bruta | profitability | percentage | (Receita − CMV) / Receita × 100 |
| Margem Operacional | profitability | percentage | EBIT / Receita × 100 |
| Margem Líquida | profitability | percentage | Lucro Líquido / Receita × 100 |
| EBITDA | profitability | currency | Lucro Bruto − Despesas Operacionais |
| EBIT | profitability | currency | EBITDA − Depreciação e Amortização |
| ROI | profitability | percentage | Lucro Líquido / Investimento Total × 100 |
| ROE | profitability | percentage | Lucro Líquido / Patrimônio Líquido × 100 |
| ROA | profitability | percentage | Lucro Líquido / Ativo Total × 100 |
| Giro do Ativo | efficiency | ratio | Receita / Ativo Total |
| Endividamento Geral | debt | percentage | Passivo Total / Ativo Total × 100 |
| Composição do Endividamento | debt | percentage | Passivo Circulante / Passivo Total × 100 |
| Cobertura de Juros | debt | ratio | EBIT / Despesa com Juros |
| Ciclo Financeiro | efficiency | days | PME + PMR − PMP |
| Prazo Médio de Recebimento | efficiency | days | (Contas a Receber / Receita) × Dias no Período |
| Prazo Médio de Pagamento | efficiency | days | (Contas a Pagar / CMV) × Dias no Período |
| Prazo Médio de Estoque | efficiency | days | (Estoque / CMV) × Dias no Período |

Cada `Indicator` de saída carrega `id`, `name`, `category`, `unit`, `value`, `formula` (texto descritivo, tabela acima) e `period` — mais os campos herdados de `DomainEntity` (`provenance`, `audit`; `audit.createdAt` cumpre o papel de timestamp de cálculo).

## Limitações

- **Divisão por zero nunca lança erro — retorna 0.** Todo denominador ausente ou zerado (ex.: empresa sem eventos de `sale`, sem `FinancialEvent` de despesa com juros) produz `value: 0` para aquele indicador, não uma exceção. Isso significa que `0` pode representar tanto "resultado real zero" quanto "dado insuficiente para calcular" — o Engine não distingue os dois casos nesta fase. Calibrar essa distinção (e a confiança de cada indicador) é trabalho futuro do Context/Evidence Engine.
- **A convenção de classificação de Resources/Events em conceitos contábeis clássicos (D-004) é uma interpretação, não um fato do domínio.** `Resource`/`FinancialEvent` (`efos/domain`, Mission 003) são genéricos por design (Camadas 1-2 da Ontologia) — não carregam rótulos como "Ativo Circulante" ou "CMV". Este Engine classifica `type` de cada Resource/Event nesses conceitos (ver `indicators.calculator.ts`, `extractFinancialStatementInputs`, e D-004 em `docs/DECISIONS.md`). Uma reclassificação de domínio mais granular (ex.: distinguir prazo curto/longo de empréstimos) tornaria vários destes indicadores mais precisos.
- **EBIT numericamente igual a EBITDA nesta fase.** O domínio não modela depreciação/amortização (nenhum `ResourceType`/`FinancialEventType` os representa) — o Engine assume `0` para esse valor, documentado, não inventado. O mesmo vale para **Cobertura de Juros**, que sempre retorna `0` porque `interestExpense` não é modelado.
- **"Dias no Período" (usado por Ciclo Financeiro, PMR, PMP, PME) é derivado do intervalo entre o primeiro e o último `FinancialEvent.occurredAt`**, com um padrão de 365 dias quando há menos de dois eventos com data. Não é um período fiscal declarado explicitamente — o domínio (`FinancialModel`) não carrega um campo de período.
- **Patrimônio Líquido (equity) é derivado pela identidade contábil** `Ativo Total − Passivo Total`, não por um `ResourceType` dedicado (o domínio não tem um).
- **Nunca usa IA.** Todo cálculo é determinístico — mesma entrada sempre produz a mesma saída.
- **Não persiste nada.** Nenhuma escrita em banco; o resultado existe apenas como valor de retorno em memória. A tabela `financial_metrics` (já existente, RLS habilitada) é o destino conceitual futuro, ainda não integrado.
- **Não expõe API nem se integra com outro Engine.** Quem orquestra a chamada (futuro Application Layer) é responsável por obter o `FinancialModelAggregate` (via Financial Model Engine) e passar adiante o resultado.

## Exemplo de uso

```ts
import { IndicatorsEngine } from "@/efos/engines/indicators";
import { FinancialModelEngine } from "@/efos/engines/financial-model";

const financialModelEngine = new FinancialModelEngine();
const indicatorsEngine = new IndicatorsEngine();

const context = { companyId: "company-123", pipelineRunId: "run-001" };

const modelResult = await financialModelEngine.execute(
  { companyId: "company-123", records: [/* NormalizedFinancialRecord[] */] },
  context
);

if (modelResult.status === "completed") {
  const indicatorsResult = await indicatorsEngine.execute(
    { companyId: "company-123", financialModel: modelResult.output },
    context
  );

  if (indicatorsResult.status === "completed") {
    console.log(indicatorsResult.output.indicators.length); // 20
  }
}
```

Nenhuma chamada acima é feita pelo próprio Engine — a orquestração entre Financial Model Engine e Indicators Engine é responsabilidade de quem os invoca (futura Application Layer), nunca de um Engine chamando outro (D-002).
