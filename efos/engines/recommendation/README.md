# Recommendation Engine

Status: **implementado (Mission 012).** Oitavo estágio nomeado do pipeline oficial (`efos/types/pipeline.ts`), propondo ações executivas a partir de Reasonings.

## Objetivo

Transformar `FinancialModelAggregate`, `IndicatorsAggregate`, `FinancialKnowledgeGraphAggregate`, `EvidenceAggregate`, `ContextAggregate` e `ReasoningAggregate` em `Recommendation` — ações propostas claras, objetivas, executáveis, rastreáveis e auditáveis, sem decidir qual será executada, sem ordenar roadmap executivo, sem executar ação (`docs/ARCHITECTURE.md`, "Responsabilidade de cada Engine").

## Responsabilidade

- Validar a consistência entre os seis agregados de entrada (`recommendation.validator.ts`).
- Aplicar regras determinísticas de recomendação (`recommendation.builder.ts`, `detectRecommendations`).
- Mapear os rascunhos (`RecommendationDraft`) para o contrato oficial (`recommendation.mapper.ts` → `RecommendationAggregate`, `efos/domain`).

**Nunca decide, nunca prioriza roadmap, nunca executa, nunca usa IA/LLM.** Apenas propõe ações possíveis a partir de conclusões já produzidas pelo Reasoning Engine — ver "Limitações" abaixo.

## Fluxo

```
RecommendationEngineInput { companyId, financialModel, indicators, financialKnowledgeGraph, evidence, context, reasoning }
        ↓
validateRecommendationEngineInput()  →  falha? retorna EfosEngineResult{status:"failed"}
        ↓ (válido)
detectRecommendations(reasoning, context)   — aplica cada regra de recomendação
        ↓
mapDraftsToAggregate(...)  — RecommendationDraft[] → RecommendationAggregate
        ↓
EfosEngineResult{status:"completed", output: RecommendationAggregate}
```

## Entrada

`RecommendationEngineInput`: `companyId` + `financialModel` (`FinancialModelAggregate`) + `indicators` (`IndicatorsAggregate`) + `financialKnowledgeGraph` (`FinancialKnowledgeGraphAggregate`) + `evidence` (`EvidenceAggregate`) + `context` (`ContextAggregate`) + `reasoning` (`ReasoningAggregate`). Este Engine nunca chama `execute()` de nenhum dos seis Engines anteriores — recebe os agregados já prontos (D-002).

Os seis agregados fazem parte do contrato de entrada formal e são todos validados por consistência (`companyId`/`financialModelId`), mas as regras implementadas nesta fase (ver abaixo) só precisam ler `reasoning` (para encontrar o Reasoning de origem) e `context` (para derivar a prioridade a partir da severidade dos Contexts referenciados pelo Reasoning). `financialModel`, `indicators`, `financialKnowledgeGraph` e `evidence` estão reservados para regras futuras que precisem inspecionar dados mais granulares diretamente.

## Saída

`EfosEngineResult<RecommendationAggregate>` — em caso de sucesso, `output` é um `RecommendationAggregate` (`efos/domain`): `companyId` + `financialModelId` + `recommendations: Recommendation[]`.

## Estrutura da Recommendation

`Recommendation` (`efos/domain/entities/Recommendation.ts`), estendendo `DomainEntity` (`id` + `provenance` + `audit`):

| Campo | Tipo | Origem |
|---|---|---|
| `id` | `string` | Determinístico — `recommendation-{financialModelId}-{key}` (`recommendation.mapper.ts`) |
| `companyId` | `string` | Input |
| `type` | `RecommendationType` (`improve_cash_flow \| reduce_costs \| review_pricing \| renegotiate_debt \| improve_working_capital \| reduce_expenses \| improve_margin \| review_operations \| strengthen_liquidity`) | Regra |
| `priority` | `RecommendationPriority` (`low \| medium \| high \| critical` — já existia em `efos/domain/enums/decision.ts` desde a Mission 003; valor `"urgent"` renomeado para `"critical"` nesta missão, D-010) | Derivada — ver "Estratégia de recomendação" abaixo |
| `confidence` | `RecommendationConfidence` (`low \| medium \| high \| verified` — enum **próprio**, não reaproveita `ReasoningConfidence`, D-010) | Traduzida do Reasoning de origem |
| `title` | `string` | Regra |
| `description` | `string` | Regra |
| `expectedImpact` | `string` — texto estruturado descritivo, nunca cálculo financeiro ou valor monetário | Regra |
| `reasonings` | `readonly string[]` (`Reasoning.id[]`) | Regra — referência por ID, nunca por composição direta de objeto |
| `contexts` | `readonly string[]` (`Context.id[]`) | Regra — repasse direto de `Reasoning.contexts` |
| `evidences` | `readonly string[]` (`Evidence.id[]`) | Regra — repasse direto de `Reasoning.evidences` |
| `supportingData` | `Readonly<Record<string, unknown>>` | Regra |
| `audit.createdAt` | `string` (ISO) | Cumpre o papel de timestamp — nenhum campo duplicado (mesmo precedente de D-003/D-007/D-008/D-009) |

## Estratégia de recomendação

As regras casam por `Reasoning.type` (`ReasoningType`, contrato oficial do Domain — `efos/domain/enums/reasoning.ts`), nunca pelo id interno de cada Reasoning (esquema privado do Reasoning Engine, `reasoning.mapper.ts`) — evita acoplamento com detalhe de implementação de outro Engine (D-002). Cada Recommendation nasce de exatamente um Reasoning nesta fase — nenhuma regra combina múltiplos Reasonings.

### Derivação de prioridade

`Recommendation.priority` nunca é um julgamento independente deste Engine: é derivada da severidade mais grave entre os Contexts que sustentam o Reasoning de origem (`Reasoning.contexts`, resolvidos contra `ContextAggregate` — `priorityFromContexts`, `recommendation.builder.ts`), traduzida para o vocabulário próprio `RecommendationPriority`. Sem Contexts resolvidos (não deveria ocorrer com entrada consistente), a prioridade cai para `"medium"` — nunca inventa severidade.

### Tradução de confiança

`Recommendation.confidence` é sempre traduzida da confiança do Reasoning de origem (`translateConfidence`) — mesma posição ordinal, vocabulário `RecommendationConfidence` distinto (D-010, mesmo princípio de D-009: por instrução explícita da missão, não reaproveita `ReasoningConfidence`).

## Rastreabilidade

Toda referência é mantida por ID — nunca objeto embutido:

- `Recommendation.reasonings` guarda `Reasoning.id` do(s) Reasoning(s) de origem.
- `Recommendation.contexts`/`Recommendation.evidences` são o repasse direto (sem duplicatas) dos mesmos campos já presentes no Reasoning de origem — denormalizado para rastreabilidade direta, sem introduzir referência nova além das que já existiam.

Nenhuma referência é perdida: de uma `Recommendation`, sempre é possível voltar a cada `Reasoning` (`ReasoningAggregate`), `Context` (`ContextAggregate`) e `Evidence` (`EvidenceAggregate`), e a partir desta última às suas próprias `sources` (`Indicator`/`GraphNode`/`FinancialEvent`/`Resource`).

## Regras implementadas (`recommendation.builder.ts`)

| Regra | `Reasoning.type` usado | `RecommendationType` | Título |
|---|---|---|---|
| Reforçar geração de caixa | `cash_risk` | `improve_cash_flow` | "Reforçar geração de caixa operacional" |
| Revisar estrutura de custos | `profitability_risk` | `reduce_costs` | "Revisar estrutura de custos" |
| Revisar operações | `operational_risk` | `review_operations` | "Revisar operações em múltiplas frentes financeiras" |

## Limitações

- **`review_pricing`, `renegotiate_debt`, `improve_working_capital`, `reduce_expenses`, `improve_margin`, `strengthen_liquidity` não são produzidos.** O vocabulário fechado (`efos/domain/enums/recommendation.ts`) reserva os 9 tipos pedidos pela Mission 012, mas só 3 regras estão implementadas nesta fase — mesmo precedente de `GraphEdgeRelation.DERIVED_FROM`/`RELATED_TO` (Mission 008), `EvidenceType.positive` (Mission 009), `ContextType`/`ReasoningType` não implementados (Missions 010/011): vocabulário fechado declarado por completo, produção incremental por missão.
- **Cada Recommendation nasce de exatamente um Reasoning.** A Mission 012 permite "um ou mais Reasonings" por Recommendation, mas nenhuma regra implementada hoje combina múltiplos Reasonings — o Reasoning Engine (Mission 011) só produz 3 `ReasoningType` distintos e cada um já mapeia 1:1 para uma Recommendation específica; não há hoje um cenário real de múltiplos Reasonings simultâneos justificando uma única Recommendation combinada.
- **`expectedImpact` é sempre um texto fixo por regra, não gerado dinamicamente a partir dos dados.** Por instrução explícita da missão ("Não realizar cálculos financeiros. Não estimar valores monetários"), o campo é descritivo e qualitativo — não deriva de nenhum valor numérico do Financial Model/Indicators.
- **Sem detecção de oportunidade.** Nenhuma regra produz `RecommendationType` de natureza positiva (ex.: aproveitar crescimento) porque o Reasoning Engine não produz `ReasoningType.growth_opportunity` hoje — cadeia de limitação documentada desde `efos/engines/evidence/README.md` → `efos/engines/context/README.md` → `efos/engines/reasoning/README.md` → aqui.
- **Não usa IA.** Toda recomendação é determinística — mesma entrada sempre produz o mesmo `RecommendationAggregate` (mesmos ids).
- **Não persiste nada.** Nenhuma escrita em banco; o resultado existe apenas como valor de retorno em memória.
- **Não expõe API nem se integra com outro Engine.** Quem orquestra a chamada (futura Application Layer) é responsável por obter os seis agregados de entrada e passar adiante o resultado.

## Exemplo de uso

```ts
import { ContextEngine } from "@/efos/engines/context";
import { EvidenceEngine } from "@/efos/engines/evidence";
import { FinancialKnowledgeGraphEngine } from "@/efos/engines/financial-knowledge-graph";
import { FinancialModelEngine } from "@/efos/engines/financial-model";
import { IndicatorsEngine } from "@/efos/engines/indicators";
import { ReasoningEngine } from "@/efos/engines/reasoning";
import { RecommendationEngine } from "@/efos/engines/recommendation";

const financialModelEngine = new FinancialModelEngine();
const indicatorsEngine = new IndicatorsEngine();
const knowledgeGraphEngine = new FinancialKnowledgeGraphEngine();
const evidenceEngine = new EvidenceEngine();
const contextEngine = new ContextEngine();
const reasoningEngine = new ReasoningEngine();
const recommendationEngine = new RecommendationEngine();

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
            const recommendationResult = await recommendationEngine.execute(
              {
                companyId: "company-123",
                financialModel: modelResult.output,
                indicators: indicatorsResult.output,
                financialKnowledgeGraph: graphResult.output,
                evidence: evidenceResult.output,
                context: contextResult.output,
                reasoning: reasoningResult.output,
              },
              context
            );

            if (recommendationResult.status === "completed") {
              console.log(recommendationResult.output.recommendations.length);
            }
          }
        }
      }
    }
  }
}
```

Nenhuma chamada acima é feita pelo próprio Engine — a orquestração entre Financial Model Engine, Indicators Engine, Financial Knowledge Graph Engine, Evidence Engine, Context Engine, Reasoning Engine e Recommendation Engine é responsabilidade de quem os invoca (futura Application Layer), nunca de um Engine chamando outro (D-002).
