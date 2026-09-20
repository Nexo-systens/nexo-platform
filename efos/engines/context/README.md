# Context Engine

Status: **implementado (Mission 010).** Sexto estágio do pipeline oficial (`efos/types/pipeline.ts`), agrupando Evidências relacionadas em situações compostas.

## Objetivo

Transformar `FinancialModelAggregate`, `IndicatorsAggregate`, `FinancialKnowledgeGraphAggregate` e `EvidenceAggregate` em `Context` — situações financeiras compostas, cada uma agrupando as Evidências que a originaram, sem nenhuma interpretação de causa, inferência, previsão ou recomendação (`docs/ARCHITECTURE.md`, "Responsabilidade de cada Engine").

## Responsabilidade

- Validar a consistência entre os quatro agregados de entrada (`context.validator.ts`).
- Aplicar regras determinísticas de agrupamento (`context.builder.ts`, `detectContexts`).
- Mapear os rascunhos (`ContextDraft`) para o contrato oficial (`context.mapper.ts` → `ContextAggregate`, `efos/domain`).

**Nunca interpreta, nunca infere, nunca prevê cenários, nunca recomenda, nunca usa IA.** Apenas agrupa Evidências já produzidas — ver "Limitações" abaixo.

## Fluxo

```
ContextEngineInput { companyId, financialModel, indicators, financialKnowledgeGraph, evidence }
        ↓
validateContextEngineInput()  →  falha? retorna EfosEngineResult{status:"failed"}
        ↓ (válido)
detectContexts(evidence)   — aplica cada regra de agrupamento sobre EvidenceAggregate
        ↓
mapDraftsToAggregate(...)  — ContextDraft[] → ContextAggregate
        ↓
EfosEngineResult{status:"completed", output: ContextAggregate}
```

## Entrada

`ContextEngineInput`: `companyId` + `financialModel` (`FinancialModelAggregate`) + `indicators` (`IndicatorsAggregate`) + `financialKnowledgeGraph` (`FinancialKnowledgeGraphAggregate`) + `evidence` (`EvidenceAggregate`). Este Engine nunca chama `execute()` de nenhum dos quatro Engines anteriores — recebe os agregados já prontos (D-002).

Os quatro agregados fazem parte do contrato de entrada formal e são todos validados por consistência (`companyId`/`financialModelId`), mas as regras de agrupamento implementadas nesta fase (ver abaixo) só precisam ler `evidence` — `Evidence.category`/`Evidence.type` já bastam para identificar as situações compostas cobertas hoje. `financialModel`, `indicators` e `financialKnowledgeGraph` estão reservados para regras futuras que precisem inspecionar o grafo ou o modelo diretamente.

## Saída

`EfosEngineResult<ContextAggregate>` — em caso de sucesso, `output` é um `ContextAggregate` (`efos/domain`): `companyId` + `financialModelId` + `contexts: Context[]`.

## Estrutura do Context

`Context` (`efos/domain/entities/Context.ts`), estendendo `DomainEntity` (`id` + `provenance` + `audit`):

| Campo | Tipo | Origem |
|---|---|---|
| `id` | `string` | Determinístico — `context-{financialModelId}-{key}` (`context.mapper.ts`) |
| `companyId` | `string` | Input |
| `type` | `ContextType` (`cash_pressure \| liquidity \| profitability \| growth \| working_capital \| debt \| operational \| cost_structure \| revenue \| expense`) | Regra |
| `severity` | `ContextSeverity` (`low \| medium \| high \| critical`) | Consolidada — ver "Consolidação" abaixo |
| `confidence` | `EvidenceConfidence` (`low \| medium \| high \| verified` — reaproveitado de `efos/domain/enums/evidence.ts`, sem novo enum `ContextConfidence`) | Consolidada |
| `title` | `string` | Regra |
| `description` | `string` | Regra |
| `evidences` | `readonly string[]` (`Evidence.id[]`) | Regra — referência por ID, nunca por composição direta de objeto |
| `supportingData` | `Readonly<Record<string, unknown>>` | Regra |
| `audit.createdAt` | `string` (ISO) | Cumpre o papel de timestamp — nenhum campo duplicado (mesmo precedente de D-003/D-007) |

## Estratégia de agrupamento

As regras casam Evidências por `Evidence.category` (`EvidenceCategory`, campo do contrato oficial do Domain) e `Evidence.type` (só `"negative"`/`"warning"` são considerados — situações adversas), nunca pelo id interno de cada Evidence (esquema privado do Evidence Engine, `evidence.mapper.ts`) — evita acoplamento com detalhe de implementação de outro Engine (D-002).

Um Context só é produzido quando **pelo menos `MINIMUM_EVIDENCES_FOR_CONTEXT` (2)** Evidências relacionadas estão presentes simultaneamente (`context.constants.ts`) — abaixo disso, o fato já é coberto sozinho pela própria Evidence; um Context só existe quando há uma situação genuinamente composta, não a repetição de uma única Evidence.

### Consolidação

- **Severidade** (`ContextSeverity`): a mais grave entre as Evidências agrupadas (`consolidateSeverity`, `context.builder.ts`) — a situação composta é, no mínimo, tão grave quanto seu sintoma mais grave.
- **Confiança** (`EvidenceConfidence`): a mais fraca entre as Evidências agrupadas (`consolidateConfidence`) — "elo mais fraco": a situação composta só é tão bem fundamentada quanto sua Evidência menos verificada.

## Rastreabilidade

Toda Evidência usada continua rastreável: `Context.evidences` guarda `Evidence.id`, nunca uma cópia do objeto — quem consome um `Context` sempre pode voltar à `Evidence` original (`EvidenceAggregate`) e, a partir dela, às suas próprias `sources` (`Indicator`/`GraphNode`/`FinancialEvent`/`Resource`). Nenhuma referência é perdida na composição.

## Regras implementadas (`context.builder.ts`)

| Regra | Categorias de Evidence usadas | Condição | `ContextType` |
|---|---|---|---|
| Pressão de caixa | `liquidity`, `working_capital`, `cash_flow` | ≥ 2 Evidências adversas dessas categorias | `cash_pressure` |
| Rentabilidade comprometida | `profitability` | ≥ 2 Evidências adversas de margem negativa | `profitability` |

## Limitações

- **"Crescimento saudável" (exemplo da Mission 010) não é implementado.** Exigiria Evidências de tipo `positive`/tendência (ex.: "Receita crescente", "Margem crescente") — o Evidence Engine (Mission 009) não produz esse tipo de Evidence hoje, por falta de série histórica entre execuções (ver `efos/engines/evidence/README.md`, "Limitações"). Nenhum Context é fabricado sem Evidência real por trás — mesmo princípio de D-004/D-007: nenhum dado inventado. `ContextType.growth` está reservado no vocabulário para quando esse tipo de regra existir.
- **`liquidity`, `working_capital`, `debt`, `operational`, `cost_structure`, `revenue`, `expense` (como `ContextType` isolado) não são produzidos.** O vocabulário fechado (`efos/domain/enums/context.ts`) reserva os 10 tipos pedidos pela Mission 010, mas só duas regras estão implementadas nesta fase — mesmo precedente de `GraphEdgeRelation.DERIVED_FROM`/`RELATED_TO` (Mission 008) e `EvidenceType.positive`/`information` (Mission 009): vocabulário fechado declarado por completo, produção incremental por missão.
- **Threshold fixo (2) para todas as regras.** `MINIMUM_EVIDENCES_FOR_CONTEXT` não varia por tipo de situação — simplificação deliberada (REGRA 15, clareza acima de complexidade); pode precisar de calibração por `ContextType` no futuro.
- **Não usa IA.** Todo agrupamento é determinístico — mesma entrada sempre produz o mesmo `ContextAggregate` (mesmos ids).
- **Não persiste nada.** Nenhuma escrita em banco; o resultado existe apenas como valor de retorno em memória.
- **Não expõe API nem se integra com outro Engine.** Quem orquestra a chamada (futura Application Layer) é responsável por obter os quatro agregados de entrada e passar adiante o resultado.

## Exemplo de uso

```ts
import { ContextEngine } from "@/efos/engines/context";
import { EvidenceEngine } from "@/efos/engines/evidence";
import { FinancialKnowledgeGraphEngine } from "@/efos/engines/financial-knowledge-graph";
import { FinancialModelEngine } from "@/efos/engines/financial-model";
import { IndicatorsEngine } from "@/efos/engines/indicators";

const financialModelEngine = new FinancialModelEngine();
const indicatorsEngine = new IndicatorsEngine();
const knowledgeGraphEngine = new FinancialKnowledgeGraphEngine();
const evidenceEngine = new EvidenceEngine();
const contextEngine = new ContextEngine();

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
        const contextResult = await contextEngine.execute(
          {
            companyId: "company-123",
            financialModel: modelResult.output,
            indicators: indicatorsResult.output,
            financialKnowledgeGraph: graphResult.output,
            evidence: evidenceResult.output,
          },
          context
        );

        if (contextResult.status === "completed") {
          console.log(contextResult.output.contexts.length);
        }
      }
    }
  }
}
```

Nenhuma chamada acima é feita pelo próprio Engine — a orquestração entre Financial Model Engine, Indicators Engine, Financial Knowledge Graph Engine, Evidence Engine e Context Engine é responsabilidade de quem os invoca (futura Application Layer), nunca de um Engine chamando outro (D-002).
