# Financial Knowledge Graph Engine

Status: **implementado (Mission 008).** Terceiro estágio nomeado do pipeline oficial (`efos/types/pipeline.ts`), organizando o Financial Model e os Indicadores de uma empresa em um grafo semântico navegável.

## Objetivo

Transformar `FinancialModelAggregate` e `IndicatorsAggregate` em um grafo de conhecimento financeiro padronizado — a estrutura navegável que os Engines de Context, Reasoning, Recommendation e Decision usarão futuramente. (`docs/ARCHITECTURE.md`, "Responsabilidade de cada Engine")

## Responsabilidade

- Validar a consistência entre os dois agregados de entrada (`financial-knowledge-graph.validator.ts`).
- Construir todos os nós e arestas do grafo (`financial-knowledge-graph.builder.ts`, `buildFinancialKnowledgeGraph`).
- Mapear o resultado para o contrato oficial (`financial-knowledge-graph.mapper.ts` → `FinancialKnowledgeGraphAggregate`, `efos/domain`).

**Não interpreta, não toma decisões, não gera recomendações.** Apenas organiza conhecimento financeiro já calculado em uma estrutura navegável — ver "Limitações" abaixo.

## Fluxo

```
FinancialKnowledgeGraphEngineInput { companyId, financialModel, indicators }
        ↓
validateFinancialKnowledgeGraphEngineInput()  →  falha? retorna EfosEngineResult{status:"failed"}
        ↓ (válido)
buildFinancialKnowledgeGraph(financialModel, indicators)   — constrói nós/arestas
        ↓
mapBuiltGraphToAggregate(...)                              — resultado interno → FinancialKnowledgeGraphAggregate
        ↓
EfosEngineResult{status:"completed", output: FinancialKnowledgeGraphAggregate}
```

## Entrada

`FinancialKnowledgeGraphEngineInput`: `companyId` + `financialModel` (`FinancialModelAggregate`, do Financial Model Engine) + `indicators` (`IndicatorsAggregate`, do Indicators Engine). Este Engine nunca chama `FinancialModelEngine.execute()` nem `IndicatorsEngine.execute()` — recebe os dois agregados já prontos (D-002).

## Saída

`EfosEngineResult<FinancialKnowledgeGraphAggregate>` — em caso de sucesso, `output` é um `FinancialKnowledgeGraphAggregate` (`efos/domain`): `companyId` + `financialModelId` + `nodes: GraphNode[]` + `edges: GraphEdge[]`.

## Estrutura do grafo

### Nós (`GraphNodeType`, `efos/domain/enums/graph.ts`)

| Tipo | Origem | Quantidade |
|---|---|---|
| `company` | `financialModel.root.companyId` | 1 |
| `period` | `indicators.indicators[0].period` (todos os indicadores de uma execução compartilham o mesmo período) | 0 ou 1 |
| `account` | Categorias distintas (`FinancialStateCategory`) presentes nos indicadores recebidos | 0–8 |
| `resource` | `financialModel.resources` | 1 por Resource |
| `financial_event` | `financialModel.events` | 1 por FinancialEvent |
| `indicator` | `indicators.indicators` | 1 por Indicator |

Cada `GraphNode` tem `id` (determinístico, prefixado por tipo — `NODE_ID_PREFIXES`), `type`, `label` e `metadata` (dados descritivos da entidade de origem — nunca recalculados).

### Arestas (`GraphEdgeRelation`, `efos/domain/enums/graph.ts`)

| Relação | De → Para | Produzida por este Engine? |
|---|---|---|
| `HAS_RESOURCE` | Company → Resource | Sim |
| `GENERATED` | Company → FinancialEvent | Sim |
| `AFFECTS` | FinancialEvent → Resource (quando `relatedResourceIds` aponta para um Resource existente) | Sim |
| `BELONGS_TO` | Period → Company; Account → Company; Indicator → Period | Sim |
| `PART_OF` | Indicator → Account | Sim |
| `MEASURED_BY` | Account → Indicator | Sim |
| `CALCULATED_FROM` | Indicator → Company | Sim |
| `DERIVED_FROM` | — | Não (reservado, ver Limitações) |
| `RELATED_TO` | — | Não (reservado para Engines futuros, ex.: Reasoning) |

Cada `GraphEdge` tem `id` (determinístico: `edge-{relation}-{source}-{target}`), `source`, `target`, `relation` e `metadata`.

## Limitações

- **Sem lineage granular Indicator → Resource/FinancialEvent.** `CALCULATED_FROM` conecta cada `Indicator` diretamente à `Company`, não aos `Resource`/`FinancialEvent` específicos que entraram na fórmula — o Indicators Engine (`indicators.calculator.ts`) agrega valores por tipo antes de calcular, sem rastrear qual registro individual contribuiu para qual indicador. A relação `DERIVED_FROM` está reservada no vocabulário para essa granularidade, mas não é produzida por este Engine nesta fase.
- **Um único nó `Period` por execução.** Todos os indicadores de uma mesma chamada ao Indicators Engine compartilham o mesmo período (`derivePeriod`, `indicators.calculator.ts`) — se isso deixar de ser verdade no futuro (múltiplos períodos numa mesma execução), o builder precisará ser revisado para múltiplos nós `Period`.
- **`Company.label` é o próprio `companyId`.** Nem `FinancialModelAggregate` nem `IndicatorsAggregate` carregam o nome da empresa (isso vive em `modules/companies`, na Plataforma, fora do EFOS Core) — não há dado melhor disponível nesta camada.
- **`RELATED_TO` nunca é produzido por este Engine.** Está reservado no vocabulário fechado (`efos/domain/enums/graph.ts`) para relações genéricas que Engines futuros (Reasoning, por exemplo) possam adicionar ao mesmo grafo — mas este Engine não suporta mutação incremental de um grafo já construído; cada execução produz um grafo completo e novo.
- **Não usa IA.** Toda construção do grafo é determinística — mesma entrada sempre produz o mesmo grafo (mesmos ids).
- **Não persiste nada.** Nenhuma escrita em banco; o resultado existe apenas como valor de retorno em memória.
- **Não expõe API nem se integra com outro Engine.** Quem orquestra a chamada (futura Application Layer) é responsável por obter `FinancialModelAggregate` e `IndicatorsAggregate` (via Financial Model Engine e Indicators Engine) e passar adiante o resultado.

## Exemplo de uso

```ts
import { FinancialKnowledgeGraphEngine } from "@/efos/engines/financial-knowledge-graph";
import { FinancialModelEngine } from "@/efos/engines/financial-model";
import { IndicatorsEngine } from "@/efos/engines/indicators";

const financialModelEngine = new FinancialModelEngine();
const indicatorsEngine = new IndicatorsEngine();
const knowledgeGraphEngine = new FinancialKnowledgeGraphEngine();

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
      console.log(graphResult.output.nodes.length);
      console.log(graphResult.output.edges.length);
    }
  }
}
```

Nenhuma chamada acima é feita pelo próprio Engine — a orquestração entre Financial Model Engine, Indicators Engine e Financial Knowledge Graph Engine é responsabilidade de quem os invoca (futura Application Layer), nunca de um Engine chamando outro (D-002).
