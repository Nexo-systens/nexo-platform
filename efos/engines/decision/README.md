# Decision Engine

Status: **implementado (Mission 013).** Décimo estágio nomeado do pipeline oficial (`efos/types/pipeline.ts`), priorizando Recommendations de forma determinística.

## Objetivo

Transformar `EvidenceAggregate`, `ContextAggregate`, `ReasoningAggregate` e `RecommendationAggregate` em `Decision` — priorizações executivas estruturadas, sem executar ação, sem simular cenário, sem usar IA (`docs/ARCHITECTURE.md`, "Responsabilidade de cada Engine").

## Reconciliação com "o EFOS nunca decide"

`docs/PROJECT_RULES.md`/`docs/AI_START.md` estabelecem a Regra Fundamental: **o EFOS nunca decide, apenas apoia quem decide**. O `Decision` produzido por este Engine **não é o registro de uma escolha humana** — é uma *proposta estruturada de priorização*: o EFOS organiza e ordena Recommendations deterministicamente, mas não executa, não conclui, não substitui a decisão humana. A captura da escolha humana real (quem aceitou, quando, por quê) é um conceito diferente, ainda não modelado — o formato anterior de `Decision` (Mission 003: `recommendationId`, `decidedByUserId`, `decidedAt`, `justification`, `accepted`) representava exatamente esse registro humano, mas nunca foi consumido por nenhum Engine. A Mission 013 pede uma estrutura diferente e explícita (`type, priority, confidence, title, description, rationale, recommendations, reasonings, contexts, evidences, supportingData`), e a entidade foi reescrita para refleti-la — ver `docs/DECISIONS.md` D-011 para a decisão completa e sua justificativa.

## Responsabilidade

- Validar a consistência entre os quatro agregados de entrada (`decision.validator.ts`).
- Aplicar regras determinísticas de priorização (`decision.builder.ts`, `detectDecisions`).
- Mapear os rascunhos (`DecisionDraft`) para o contrato oficial (`decision.mapper.ts` → `DecisionAggregate`, `efos/domain`).

**Nunca executa, nunca simula, nunca usa IA/LLM.** Apenas organiza e prioriza Recommendations já produzidas — ver "Limitações" abaixo.

## Fluxo

```
DecisionEngineInput { companyId, evidence, context, reasoning, recommendation }
        ↓
validateDecisionEngineInput()  →  falha? retorna EfosEngineResult{status:"failed"}
        ↓ (válido)
detectDecisions(recommendation)   — aplica cada regra de priorização sobre RecommendationAggregate
        ↓
mapDraftsToAggregate(...)  — DecisionDraft[] → DecisionAggregate
        ↓
EfosEngineResult{status:"completed", output: DecisionAggregate}
```

## Entrada

`DecisionEngineInput`: `companyId` + `evidence` (`EvidenceAggregate`) + `context` (`ContextAggregate`) + `reasoning` (`ReasoningAggregate`) + `recommendation` (`RecommendationAggregate`). **Não recebe `FinancialModelAggregate`** — fora do escopo explícito da Mission 013 (diferente de todos os Engines anteriores); `financialModelId` é obtido diretamente de `recommendation.financialModelId`, usado como referência para validar a consistência dos demais agregados. Este Engine nunca chama `execute()` de nenhum dos quatro Engines anteriores — recebe os agregados já prontos (D-002).

Os quatro agregados fazem parte do contrato de entrada formal e são todos validados por consistência (`companyId`/`financialModelId`), mas a regra implementada nesta fase (ver abaixo) só precisa ler `recommendation` — prioridade e confiança de cada Recommendation já bastam. `evidence`, `context` e `reasoning` estão reservados para regras futuras que precisem inspecionar dados mais granulares diretamente.

## Saída

`EfosEngineResult<DecisionAggregate>` — em caso de sucesso, `output` é um `DecisionAggregate` (`efos/domain`): `companyId` + `financialModelId` + `decisions: Decision[]`.

## Estrutura da Decision

`Decision` (`efos/domain/entities/Decision.ts`), estendendo `DomainEntity` (`id` + `provenance` + `audit`):

| Campo | Tipo | Origem |
|---|---|---|
| `id` | `string` | Determinístico — `decision-{financialModelId}-{key}` (`decision.mapper.ts`) |
| `companyId` | `string` | Input |
| `type` | `DecisionType` (`execute_immediately \| prioritize_sequence` — enum novo, mínimo, D-011) | Regra |
| `priority` | `RecommendationPriority` (reaproveitado de `efos/domain/enums/decision.ts`, sem `DecisionPriority` novo — D-011) | Derivada — ver "Estratégia de priorização" |
| `confidence` | `RecommendationConfidence` (reaproveitado de `efos/domain/enums/recommendation.ts`, sem `DecisionConfidence` novo — D-011) | Derivada |
| `title` | `string` | Regra |
| `description` | `string` | Regra |
| `rationale` | `string` — texto determinístico explicando o critério de priorização, nunca gerado por IA, nunca subjetivo | Regra |
| `recommendations` | `readonly string[]` (`Recommendation.id[]`) | Regra — referência por ID, nunca por composição direta de objeto |
| `reasonings` | `readonly string[]` (`Reasoning.id[]`) | Regra — união das `Reasoning.id` já presentes nas Recommendations incluídas |
| `contexts` | `readonly string[]` (`Context.id[]`) | Regra — união das `Context.id` já presentes |
| `evidences` | `readonly string[]` (`Evidence.id[]`) | Regra — união das `Evidence.id` já presentes |
| `supportingData` | `Readonly<Record<string, unknown>>` | Regra |
| `audit.createdAt` | `string` (ISO) | Cumpre o papel de timestamp — nenhum campo duplicado (mesmo precedente de D-003/D-007/D-008/D-009/D-010) |

## Estratégia de priorização

A prioridade e a confiança de uma Decision **nunca são arbitrárias** — são sempre derivadas diretamente das Recommendations que a compõem:

- **Prioridade** (`consolidatePriority`, regra de sequência): a mais grave entre as Recommendations combinadas.
- **Confiança** (`consolidateConfidence`, regra de sequência): a mais fraca entre as Recommendations combinadas — "elo mais fraco", mesmo princípio de D-008/D-009.
- **Ordenação** (`orderByPriorityThenConfidence`): critério único e determinístico — prioridade decrescente (`critical > high > medium > low`) e, em empate, confiança decrescente (`verified > high > medium > low`). Nunca ordem arbitrária ou dependente de IA.

## Rastreabilidade

Toda referência é mantida por ID — nunca objeto embutido: `Decision.recommendations` guarda `Recommendation.id`; `Decision.reasonings`/`contexts`/`evidences` são a união (sem duplicatas) dos mesmos campos já presentes nas Recommendations incluídas — denormalizado para rastreabilidade direta, sem introduzir referência nova além das que já existiam. De uma `Decision`, sempre é possível voltar a cada `Recommendation`, `Reasoning`, `Context` e `Evidence`, e a partir desta última às suas próprias `sources`.

## Regras implementadas (`decision.builder.ts`)

| Regra | Condição | `DecisionType` | Prioridade/Confiança |
|---|---|---|---|
| Executar imediatamente | Exatamente 1 `Recommendation`, com `priority` `high` ou `critical` | `execute_immediately` | Repassadas diretamente da Recommendation |
| Priorizar sequência | 2+ `Recommendations` (qualquer prioridade) | `prioritize_sequence` | Consolidadas (mais grave / mais fraca) |

As duas regras são mutuamente exclusivas por construção: nunca ambas disparam na mesma execução.

## Limitações

- **Uma única Recommendation de prioridade baixa/média, isolada, não gera Decision.** Nenhuma regra cobre esse caso nesta fase — não há concorrência de priorização (então "priorizar sequência" não se aplica) nem urgência suficiente (então "executar imediatamente" também não se aplica). Um `Recommendation.priority` `low`/`medium` isolado fica sem `Decision` correspondente; poderia justificar um terceiro tipo futuro (ex.: "monitorar"), fora do escopo desta missão.
- **`rationale` é sempre um texto templado, não gerado dinamicamente além dos dados de entrada.** O texto descreve o critério aplicado (ordem, prioridades, confiança) de forma determinística — nunca inventa justificativa além do que os dados já expressam.
- **Reconciliação com "EFOS nunca decide" (ver seção acima).** O nome "Decision" pode sugerir uma escolha final — não é: é uma proposta de priorização. A captura da escolha humana real (aceitar/rejeitar, quem, quando) permanece um conceito futuro, fora do escopo desta missão.
- **Não usa IA.** Toda priorização é determinística — mesma entrada sempre produz o mesmo `DecisionAggregate` (mesmos ids).
- **Não persiste nada.** Nenhuma escrita em banco; o resultado existe apenas como valor de retorno em memória.
- **Não expõe API nem se integra com outro Engine.** Quem orquestra a chamada (futura Application Layer) é responsável por obter os quatro agregados de entrada e passar adiante o resultado.

## Exemplo de uso

```ts
import { ContextEngine } from "@/efos/engines/context";
import { DecisionEngine } from "@/efos/engines/decision";
import { EvidenceEngine } from "@/efos/engines/evidence";
import { FinancialKnowledgeGraphEngine } from "@/efos/engines/financial-knowledge-graph";
import { FinancialModelEngine } from "@/efos/engines/financial-model";
import { IndicatorsEngine } from "@/efos/engines/indicators";
import { ReasoningEngine } from "@/efos/engines/reasoning";
import { RecommendationEngine } from "@/efos/engines/recommendation";

// ... financialModelEngine, indicatorsEngine, knowledgeGraphEngine,
// evidenceEngine, contextEngine, reasoningEngine, recommendationEngine
// executados em sequência (ver READMEs anteriores) até obter
// evidenceResult, contextResult, reasoningResult, recommendationResult.

const decisionEngine = new DecisionEngine();
const context = { companyId: "company-123", pipelineRunId: "run-001" };

const decisionResult = await decisionEngine.execute(
  {
    companyId: "company-123",
    evidence: evidenceResult.output,
    context: contextResult.output,
    reasoning: reasoningResult.output,
    recommendation: recommendationResult.output,
  },
  context
);

if (decisionResult.status === "completed") {
  console.log(decisionResult.output.decisions.length);
}
```

Nenhuma chamada acima é feita pelo próprio Engine — a orquestração entre todos os Engines do pipeline é responsabilidade de quem os invoca (futura Application Layer), nunca de um Engine chamando outro (D-002).
