# Evidence Engine

Status: **implementado (Mission 009).** Quinto estágio do pipeline oficial (`efos/types/pipeline.ts`), transformando Financial Model, Indicadores e Financial Knowledge Graph em fatos financeiros objetivos e auditáveis.

## Objetivo

Transformar `FinancialModelAggregate`, `IndicatorsAggregate` e `FinancialKnowledgeGraphAggregate` em um conjunto de `Evidence` — fatos materiais, cada um com origem rastreável, sem nenhuma interpretação de causa, recomendação ou previsão (`docs/ARCHITECTURE.md`, "Responsabilidade de cada Engine"; D-006).

## Responsabilidade

- Validar a consistência entre os três agregados de entrada (`evidence.validator.ts`).
- Aplicar regras determinísticas de detecção de fatos (`evidence.builder.ts`, `detectEvidence`).
- Mapear os rascunhos (`EvidenceDraft`) para o contrato oficial (`evidence.mapper.ts` → `EvidenceAggregate`, `efos/domain`).

**Nunca interpreta, nunca recomenda, nunca prevê, nunca usa IA.** Apenas compara valores já calculados contra limiares determinísticos e produz fatos — ver "Limitações" abaixo.

## Fluxo

```
EvidenceEngineInput { companyId, financialModel, indicators, financialKnowledgeGraph }
        ↓
validateEvidenceEngineInput()  →  falha? retorna EfosEngineResult{status:"failed"}
        ↓ (válido)
detectEvidence(financialModel, indicators, financialKnowledgeGraph)   — aplica cada regra de detecção
        ↓
mapDraftsToAggregate(...)                                             — EvidenceDraft[] → EvidenceAggregate
        ↓
EfosEngineResult{status:"completed", output: EvidenceAggregate}
```

## Entrada

`EvidenceEngineInput`: `companyId` + `financialModel` (`FinancialModelAggregate`) + `indicators` (`IndicatorsAggregate`) + `financialKnowledgeGraph` (`FinancialKnowledgeGraphAggregate`). Este Engine nunca chama `execute()` de nenhum dos três Engines anteriores — recebe os agregados já prontos (D-002; entrada formalizada em `docs/ARCHITECTURE.md` e D-006).

## Saída

`EfosEngineResult<EvidenceAggregate>` — em caso de sucesso, `output` é um `EvidenceAggregate` (`efos/domain`): `companyId` + `financialModelId` + `evidences: Evidence[]`.

## Estrutura da Evidence

`Evidence` (`efos/domain/entities/Evidence.ts`), estendendo `DomainEntity` (`id` + `provenance` + `audit`):

| Campo | Tipo | Origem |
|---|---|---|
| `id` | `string` | Determinístico — `evidence-{financialModelId}-{key}` (`evidence.mapper.ts`) |
| `companyId` | `string` | Input |
| `type` | `EvidenceType` (`positive \| negative \| warning \| information`) | Regra |
| `category` | `EvidenceCategory` (`cash_flow \| profitability \| liquidity \| working_capital \| debt \| costs \| revenue \| expense \| operational`) | Regra |
| `severity` | `EvidenceSeverity` (`low \| medium \| high \| critical`) | Regra |
| `confidence` | `EvidenceConfidence` (`low \| medium \| high \| verified`) | Regra — ver "Confiança" abaixo |
| `title` | `string` | Regra |
| `description` | `string` | Regra |
| `supportingData` | `Readonly<Record<string, unknown>>` | Regra — valores/limiares usados na decisão |
| `sources` | `readonly EvidenceSource[]` | Regra — ver "Rastreabilidade" abaixo |
| `audit.createdAt` | `string` (ISO) | Cumpre o papel de timestamp — nenhum campo duplicado (mesmo precedente de D-003 para `Indicator`) |

## Rastreabilidade

Toda `Evidence` carrega `sources: readonly EvidenceSource[]` — nunca vazio. Cada `EvidenceSource` é `{ type: EvidenceSourceType, id: string }`, com `EvidenceSourceType` = `indicator | graph_node | graph_edge | financial_event | resource` (`efos/domain/enums/evidence.ts`).

- Evidências baseadas em `Indicator` (liquidez, margens, capital de giro) carregam `{ type: "indicator", id: indicator.id }` e, quando existe, o nó correspondente no grafo — `{ type: "graph_node", id }`, localizado pelo esquema de id determinístico do Financial Knowledge Graph Engine (`NODE_ID_PREFIXES`, exportado publicamente por `@/efos/engines/financial-knowledge-graph` — importado por tipo/constante, nunca por `execute()`, D-002).
- Evidências baseadas em `FinancialEvent` (fluxo de caixa operacional) carregam `{ type: "financial_event", id }` de cada evento envolvido, e o nó de grafo correspondente quando presente.
- Nenhum id de nó/aresta é inventado: o builder só adiciona uma fonte de grafo quando o id esperado de fato existe em `financialKnowledgeGraph.nodes`/`.edges`.

## Regras implementadas (`evidence.builder.ts`)

| Regra | Indicator/dado usado | Condição | Severidade | Confiança |
|---|---|---|---|---|
| Liquidez abaixo do mínimo | `Liquidez Corrente` | `value < 1` | `critical` (`<0.5`) / `high` (`<0.8`) / `medium` | `verified` |
| Margem negativa (bruta/operacional/líquida) | `Margem Bruta`/`Margem Operacional`/`Margem Líquida` | `value < 0` | `critical` (`<-20`) / `high` (`<-10`) / `medium` | `verified` |
| Capital de giro insuficiente | `Capital de Giro` | `value < 0` | `high` | `verified` |
| Fluxo de caixa operacional negativo | `FinancialEvent` tipos `sale`/`receipt` (entrada) vs. `purchase`/`payment` (saída) | soma de saídas > soma de entradas | `medium` | `high` (convenção própria, não um Indicator oficial — ver "Confiança") |

## Confiança

`Evidence.confidence` (`EvidenceConfidence`) é distinta de `Provenance.confidence` (`ConfidenceScore`/`ConfidenceLevel`, herdada de `DomainEntity`): `Provenance.confidence` descreve a confiança no *processo* que gerou o dado — sempre `very_high` nesta fase, pois o Engine é inteiramente determinístico. `Evidence.confidence` descreve o quão fundamentado o *fato em si* está: `verified` quando lido diretamente de um `Indicator` oficial (calculado e validado pelo Indicators Engine), `high` quando depende de uma convenção de classificação adicional deste próprio Engine (ex.: fluxo de caixa operacional, que não é um `Indicator` oficial).

## Limitações

- **Não detecta tendência (crescimento/queda ao longo do tempo).** "Receita crescente" e "despesas aumentaram" (exemplos da Mission 009) exigem comparar dois ou mais períodos — `FinancialModelAggregate`/`IndicatorsAggregate` representam uma única execução/período. Implementar isso corretamente exigiria receber histórico de execuções anteriores, o que não é uma entrada deste Engine hoje. Não fabricado (mesmo princípio de D-004: nenhum valor é inventado quando o dado de origem não existe). `EvidenceType.positive` e `EvidenceType.information` estão reservados no vocabulário para quando esse tipo de regra existir.
- **Fluxo de caixa operacional é uma convenção própria, não um Indicator oficial.** O Indicators Engine não calcula fluxo de caixa — este Engine classifica `FinancialEvent` diretamente (`sale`/`receipt` como entrada, `purchase`/`payment` como saída), mesmo espírito de D-004. Por isso a confiança dessa Evidence específica é `high`, nunca `verified`.
- **Nomes de Indicator reconhecidos por string.** `IndicatorsAggregate` não expõe um `slug`/`key` estável por indicador — apenas `name` (string em português, definida pelo Indicators Engine). As regras casam por `Indicator.name` (`RECOGNIZED_INDICATOR_NAMES`, `evidence.constants.ts`); se o Indicators Engine renomear um indicador reconhecido, a regra correspondente deixa de disparar silenciosamente, sem erro.
- **Sem severidade calibrada para capital de giro/fluxo de caixa.** Ao contrário de liquidez/margem (escalas de razão/percentual com limiares graduais), capital de giro e fluxo de caixa usam severidade fixa (`high`/`medium`) — o valor monetário absoluto não tem uma escala natural sem mais contexto (ex.: porte da empresa), que este Engine não recebe.
- **Não usa IA.** Toda detecção é determinística — mesma entrada sempre produz o mesmo `EvidenceAggregate` (mesmos ids).
- **Não persiste nada.** Nenhuma escrita em banco; o resultado existe apenas como valor de retorno em memória.
- **Não expõe API nem se integra com outro Engine.** Quem orquestra a chamada (futura Application Layer) é responsável por obter os três agregados de entrada e passar adiante o resultado.

## Exemplo de uso

```ts
import { EvidenceEngine } from "@/efos/engines/evidence";
import { FinancialKnowledgeGraphEngine } from "@/efos/engines/financial-knowledge-graph";
import { FinancialModelEngine } from "@/efos/engines/financial-model";
import { IndicatorsEngine } from "@/efos/engines/indicators";

const financialModelEngine = new FinancialModelEngine();
const indicatorsEngine = new IndicatorsEngine();
const knowledgeGraphEngine = new FinancialKnowledgeGraphEngine();
const evidenceEngine = new EvidenceEngine();

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
    const graphResult = await knowledgeGraphEngine.execute(
      {
        companyId: "company-123",
        financialModel: modelResult.output,
        indicators: indicatorsResult.output,
      },
      context
    );

    if (graphResult.status === "completed") {
      const evidenceResult = await evidenceEngine.execute(
        {
          companyId: "company-123",
          financialModel: modelResult.output,
          indicators: indicatorsResult.output,
          financialKnowledgeGraph: graphResult.output,
        },
        context
      );

      if (evidenceResult.status === "completed") {
        console.log(evidenceResult.output.evidences.length);
      }
    }
  }
}
```

Nenhuma chamada acima é feita pelo próprio Engine — a orquestração entre Financial Model Engine, Indicators Engine, Financial Knowledge Graph Engine e Evidence Engine é responsabilidade de quem os invoca (futura Application Layer), nunca de um Engine chamando outro (D-002).
