# Reasoning Engine

Status: **implementado (Mission 011).** Sétimo estágio do pipeline oficial (`efos/types/pipeline.ts`), combinando Contextos relacionados em conclusões executivas determinísticas.

## Objetivo

Transformar `FinancialModelAggregate`, `IndicatorsAggregate`, `FinancialKnowledgeGraphAggregate`, `EvidenceAggregate` e `ContextAggregate` em `Reasoning` — conclusões executivas objetivas, explicáveis, auditáveis e determinísticas, sem recomendar ação, sem decidir, sem prever cenário (`docs/ARCHITECTURE.md`, "Responsabilidade de cada Engine").

## Responsabilidade

- Validar a consistência entre os cinco agregados de entrada (`reasoning.validator.ts`).
- Aplicar regras determinísticas de inferência (`reasoning.builder.ts`, `detectReasonings`).
- Mapear os rascunhos (`ReasoningDraft`) para o contrato oficial (`reasoning.mapper.ts` → `ReasoningAggregate`, `efos/domain`).

**Nunca recomenda, nunca decide, nunca prevê cenários, nunca usa IA/LLM.** Apenas combina Contextos já produzidos em uma conclusão de nível executivo — ver "Limitações" abaixo.

## Fluxo

```
ReasoningEngineInput { companyId, financialModel, indicators, financialKnowledgeGraph, evidence, context }
        ↓
validateReasoningEngineInput()  →  falha? retorna EfosEngineResult{status:"failed"}
        ↓ (válido)
detectReasonings(context)   — aplica cada regra de inferência sobre ContextAggregate
        ↓
mapDraftsToAggregate(...)  — ReasoningDraft[] → ReasoningAggregate
        ↓
EfosEngineResult{status:"completed", output: ReasoningAggregate}
```

## Entrada

`ReasoningEngineInput`: `companyId` + `financialModel` (`FinancialModelAggregate`) + `indicators` (`IndicatorsAggregate`) + `financialKnowledgeGraph` (`FinancialKnowledgeGraphAggregate`) + `evidence` (`EvidenceAggregate`) + `context` (`ContextAggregate`). Este Engine nunca chama `execute()` de nenhum dos cinco Engines anteriores — recebe os agregados já prontos (D-002).

Os cinco agregados fazem parte do contrato de entrada formal e são todos validados por consistência (`companyId`/`financialModelId`), mas as regras de inferência implementadas nesta fase (ver abaixo) só precisam ler `context` — o Context Engine (Mission 010) já consolida Evidências relacionadas em uma única situação composta por tipo, então `Context.type` já basta para identificar as conclusões cobertas hoje. `financialModel`, `indicators`, `financialKnowledgeGraph` e `evidence` estão reservados para regras futuras que precisem inspecionar dados mais granulares diretamente.

## Saída

`EfosEngineResult<ReasoningAggregate>` — em caso de sucesso, `output` é um `ReasoningAggregate` (`efos/domain`): `companyId` + `financialModelId` + `reasonings: Reasoning[]`.

## Estrutura do Reasoning

`Reasoning` (`efos/domain/entities/Reasoning.ts`), estendendo `DomainEntity` (`id` + `provenance` + `audit`):

| Campo | Tipo | Origem |
|---|---|---|
| `id` | `string` | Determinístico — `reasoning-{financialModelId}-{key}` (`reasoning.mapper.ts`) |
| `companyId` | `string` | Input |
| `type` | `ReasoningType` (`cash_risk \| liquidity_risk \| profitability_risk \| operational_risk \| working_capital_risk \| debt_risk \| growth_opportunity \| cost_pressure \| revenue_pressure`) | Regra |
| `confidence` | `ReasoningConfidence` (`low \| medium \| high \| verified` — enum **próprio**, não reaproveita `EvidenceConfidence`, D-009) | Consolidada — ver "Estratégia de inferência" abaixo |
| `title` | `string` | Regra |
| `description` | `string` | Regra |
| `contexts` | `readonly string[]` (`Context.id[]`) | Regra — referência por ID, nunca por composição direta de objeto |
| `evidences` | `readonly string[]` (`Evidence.id[]`) | Regra — união (sem duplicatas) das `Evidence.id` já referenciadas pelos Contexts incluídos |
| `supportingData` | `Readonly<Record<string, unknown>>` | Regra |
| `audit.createdAt` | `string` (ISO) | Cumpre o papel de timestamp — nenhum campo duplicado (mesmo precedente de D-003/D-007/D-008) |

Sem campo `severity`: a Mission 011 não pede um eixo de gravidade próprio para `Reasoning` (diferente de `Evidence`/`Context`) — a gravidade da situação já está em `Context.severity`, acessível via `contexts` + `ContextAggregate`.

## Estratégia de inferência

As regras casam por `Context.type` (`ContextType`, contrato oficial do Domain — `efos/domain/enums/context.ts`), nunca pelo id interno de cada Context (esquema privado do Context Engine, `context.mapper.ts`) — evita acoplamento com detalhe de implementação de outro Engine (D-002).

Diferente do Context Engine (que exige ≥2 Evidências para caracterizar uma situação composta), aqui um único Context de um tipo reconhecido já é sinal suficiente: o Context Engine já fez o trabalho de consolidar múltiplas Evidências relacionadas em uma única situação — promover esse Context a uma conclusão executiva é o próximo nível de abstração, não uma repetição. A única regra que de fato combina **dois** Contexts distintos é "Risco operacional" (ver tabela abaixo), quando risco de caixa e deterioração de rentabilidade coexistem.

### Consolidação de confiança

`Reasoning.confidence` é sempre derivada da confiança dos Contexts combinados — nunca um julgamento independente deste Engine:

- Regras de um único Context: a confiança do Reasoning é a mesma posição ordinal da confiança do Context (`translateConfidence`, `reasoning.builder.ts`) — traduzida para o vocabulário próprio `ReasoningConfidence` (D-009), não copiada como `EvidenceConfidence`.
- Regra de dois Contexts ("Risco operacional"): a confiança mais fraca entre eles (`consolidateConfidence`) — "elo mais fraco", mesmo princípio de `Context.confidence` (D-008).

## Rastreabilidade

Toda referência é mantida por ID — nunca objeto embutido:

- `Reasoning.contexts` guarda `Context.id` de cada Context combinado.
- `Reasoning.evidences` guarda a união de todas as `Evidence.id` já presentes em `Context.evidences` dos Contexts combinados — denormalizado para rastreabilidade direta (sem exigir resolver `Context → Evidence` a cada consulta), mas sem introduzir nenhuma referência nova além das que já existiam nos Contexts de origem.

Nenhuma referência é perdida: de um `Reasoning`, sempre é possível voltar a cada `Context` (`ContextAggregate`) e, a partir dele, a cada `Evidence` (`EvidenceAggregate`) e suas próprias `sources` (`Indicator`/`GraphNode`/`FinancialEvent`/`Resource`).

## Regras implementadas (`reasoning.builder.ts`)

| Regra | Context(s) usado(s) | Condição | `ReasoningType` | Combina 2+ Contexts? |
|---|---|---|---|---|
| Risco de caixa | `cash_pressure` | Presente | `cash_risk` | Não — promove um único Context |
| Risco de rentabilidade | `profitability` | Presente | `profitability_risk` | Não — promove um único Context |
| Risco operacional | `cash_pressure` **e** `profitability` | Ambos presentes simultaneamente | `operational_risk` | Sim |

## Limitações

- **Os exemplos literais da Mission 011 não são reproduzidos ao pé da letra.** A missão descreve combinar Contexts nomeados "Pressão de Caixa", "Liquidez" e "Capital de Giro" separadamente — mas o Context Engine (Mission 010) já consolida Evidências de liquidez, capital de giro e fluxo de caixa em um **único** Context (`cash_pressure`), por design (`efos/engines/context/README.md`). Não existem três Contexts distintos para combinar; o Reasoning Engine promove o Context já consolidado a uma conclusão executiva. O mesmo vale para "Pressão de custos" no segundo exemplo — esse `ContextType` (`cost_structure`) não é produzido pelo Context Engine hoje (ver `efos/engines/context/README.md`, "Limitações"); a regra de rentabilidade usa apenas o Context `profitability` disponível.
- **`liquidity_risk`, `working_capital_risk`, `debt_risk`, `growth_opportunity`, `cost_pressure`, `revenue_pressure` não são produzidos.** O vocabulário fechado (`efos/domain/enums/reasoning.ts`) reserva os 9 tipos pedidos pela Mission 011, mas só 3 regras estão implementadas nesta fase — mesmo precedente de `GraphEdgeRelation.DERIVED_FROM`/`RELATED_TO` (Mission 008), `EvidenceType.positive` (Mission 009) e `ContextType` não implementados (Mission 010): vocabulário fechado declarado por completo, produção incremental por missão.
- **Sem detecção de tendência/oportunidade.** `growth_opportunity` exigiria Contexts de tipo `growth`, que o Context Engine não produz hoje (por sua vez, por falta de Evidências de tendência do Evidence Engine — cadeia de limitação documentada em `efos/engines/evidence/README.md` → `efos/engines/context/README.md` → aqui).
- **Não usa IA.** Toda inferência é determinística — mesma entrada sempre produz o mesmo `ReasoningAggregate` (mesmos ids).
- **Não persiste nada.** Nenhuma escrita em banco; o resultado existe apenas como valor de retorno em memória.
- **Não expõe API nem se integra com outro Engine.** Quem orquestra a chamada (futura Application Layer) é responsável por obter os cinco agregados de entrada e passar adiante o resultado.

## Exemplo de uso

```ts
import { ContextEngine } from "@/efos/engines/context";
import { EvidenceEngine } from "@/efos/engines/evidence";
import { FinancialKnowledgeGraphEngine } from "@/efos/engines/financial-knowledge-graph";
import { FinancialModelEngine } from "@/efos/engines/financial-model";
import { IndicatorsEngine } from "@/efos/engines/indicators";
import { ReasoningEngine } from "@/efos/engines/reasoning";

const financialModelEngine = new FinancialModelEngine();
const indicatorsEngine = new IndicatorsEngine();
const knowledgeGraphEngine = new FinancialKnowledgeGraphEngine();
const evidenceEngine = new EvidenceEngine();
const contextEngine = new ContextEngine();
const reasoningEngine = new ReasoningEngine();

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
          const reasoningResult = await reasoningEngine.execute(
            {
              companyId: "company-123",
              financialModel: modelResult.output,
              indicators: indicatorsResult.output,
              financialKnowledgeGraph: graphResult.output,
              evidence: evidenceResult.output,
              context: contextResult.output,
            },
            context
          );

          if (reasoningResult.status === "completed") {
            console.log(reasoningResult.output.reasonings.length);
          }
        }
      }
    }
  }
}
```

Nenhuma chamada acima é feita pelo próprio Engine — a orquestração entre Financial Model Engine, Indicators Engine, Financial Knowledge Graph Engine, Evidence Engine, Context Engine e Reasoning Engine é responsabilidade de quem os invoca (futura Application Layer), nunca de um Engine chamando outro (D-002).
