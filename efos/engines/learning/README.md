# Learning Engine

Status: **implementado (Mission 015).** Décimo e último estágio da cadeia principal do pipeline oficial (`efos/types/pipeline.ts`, `EFOS_PIPELINE`), registrando conhecimento consolidado a partir do que já foi produzido pelos Engines anteriores.

## Objetivo

Transformar `EvidenceAggregate`, `ContextAggregate`, `ReasoningAggregate`, `RecommendationAggregate` e `DecisionAggregate` em `LearningRecord` — conhecimento consolidado, registrado para evolução futura da metodologia. **Não modifica o comportamento do EFOS**: não altera nenhuma regra, não altera `Evidence`/`Context`/`Reasoning`/`Recommendation`/`Decision` já produzidos (`docs/ARCHITECTURE.md`, "Responsabilidade de cada Engine").

## Responsabilidade

- Validar a consistência entre os cinco agregados de entrada (`learning.validator.ts`).
- Aplicar regras determinísticas de consolidação (`learning.builder.ts`, `detectLearnings`).
- Mapear os rascunhos (`LearningDraft`) para o contrato oficial (`learning.mapper.ts` → `LearningAggregate`, `efos/domain`).

**Nunca altera comportamento, nunca modifica regra existente, nunca usa IA/LLM/Machine Learning/auto-tuning/auto-learning, nunca executa decisão.** Apenas observa e registra o que já foi produzido na mesma execução — ver "Limitações" abaixo.

## Fluxo

```
LearningEngineInput { companyId, evidence, context, reasoning, recommendation, decision }
        ↓
validateLearningEngineInput()  →  falha? retorna EfosEngineResult{status:"failed"}
        ↓ (válido)
detectLearnings(reasoning, recommendation, decision)   — aplica cada regra de consolidação
        ↓
mapDraftsToAggregate(...)  — LearningDraft[] → LearningAggregate
        ↓
EfosEngineResult{status:"completed", output: LearningAggregate}
```

## Entrada

`LearningEngineInput`: `companyId` + `evidence` (`EvidenceAggregate`) + `context` (`ContextAggregate`) + `reasoning` (`ReasoningAggregate`) + `recommendation` (`RecommendationAggregate`) + `decision` (`DecisionAggregate`). **Não recebe `FinancialModelAggregate`** — mesmo padrão do Decision Engine (Mission 013); `financialModelId` é obtido diretamente de `decision.financialModelId`, usado como referência para validar a consistência dos demais agregados. Este Engine nunca chama `execute()` de nenhum dos cinco Engines anteriores — recebe os agregados já prontos (D-002).

Os cinco agregados fazem parte do contrato de entrada formal e são todos validados por consistência (`companyId`/`financialModelId`), mas as regras implementadas nesta fase (ver abaixo) só precisam ler `reasoning`, `recommendation` e `decision` diretamente — `evidence` e `context` são alcançados apenas por referência de ID (via `Reasoning.contexts`/`Reasoning.evidences`/`Decision.contexts`/`Decision.evidences`), nunca lidos/filtrados diretamente pelas regras atuais.

## Saída

`EfosEngineResult<LearningAggregate>` — em caso de sucesso, `output` é um `LearningAggregate` (`efos/domain`): `companyId` + `financialModelId` + `learnings: LearningRecord[]`.

## Estrutura do LearningRecord

`LearningRecord` (`efos/domain/entities/LearningRecord.ts`), estendendo `DomainEntity` (`id` + `provenance` + `audit`):

| Campo | Tipo | Origem |
|---|---|---|
| `id` | `string` | Determinístico — `learning-{financialModelId}-{key}` (`learning.mapper.ts`) |
| `companyId` | `string` | Input |
| `type` | `LearningType` (`pattern \| observation \| recurring_risk \| methodology_note \| executive_insight`) | Regra |
| `confidence` | `LearningConfidence` (`low \| medium \| high \| verified` — enum **próprio**, não reaproveita `ReasoningConfidence`/`RecommendationConfidence`, D-013) | Traduzida da Reasoning/Decision de origem |
| `title` | `string` | Regra |
| `description` | `string` | Regra |
| `source` | `LearningSource` (`rule \| execution \| user_feedback \| historical_pattern` — enum próprio, D-013) | Regra — sempre `"execution"` nesta fase |
| `decisions` | `readonly string[]` (`Decision.id[]`) | Regra — referência por ID, nunca por composição direta de objeto |
| `recommendations` | `readonly string[]` (`Recommendation.id[]`) | Regra |
| `reasonings` | `readonly string[]` (`Reasoning.id[]`) | Regra |
| `contexts` | `readonly string[]` (`Context.id[]`) | Regra |
| `evidences` | `readonly string[]` (`Evidence.id[]`) | Regra |
| `supportingData` | `Readonly<Record<string, unknown>>` | Regra |
| `audit.createdAt` | `string` (ISO) | Cumpre o papel de timestamp — nenhum campo duplicado (mesmo precedente de D-003/D-007/D-008/D-009/D-010/D-011) |

### Relação com `Knowledge`

`Knowledge` (`efos/domain/entities/Knowledge.ts`, Mission 003) é um conceito **distinto**, não fundido a `LearningRecord` por esta missão: `Knowledge` representa um fato permanente sobre uma empresa, derivado de `Outcome`s observados ao longo do tempo (`derivedFromOutcomeIds`) — ainda não consumido por nenhum Engine, pois depende de `Outcome` (que depende de uma `Decision` já executada e avaliada, fora do escopo de qualquer Engine implementado até agora). `LearningRecord` é mais imediato: um registro estrutural do que foi observado dentro de uma única execução do pipeline, sem depender de nenhum resultado futuro. Ver `docs/DECISIONS.md` D-013.

## Estratégia de consolidação

As regras casam por `Reasoning.type`/estrutura de `Decision` (contratos oficiais do Domain), nunca pelo id interno de outro Engine (D-002). Nenhuma regra altera os agregados que consome — apenas os lê e produz um registro novo e independente.

### Confiança

`LearningRecord.confidence` é sempre traduzida da confiança da entidade de origem (`Reasoning.confidence` ou `Decision.confidence`) para o vocabulário próprio `LearningConfidence` — mesma posição ordinal, nunca um julgamento independente deste Engine (mesmo princípio de D-007/D-008/D-009/D-010/D-011).

## Rastreabilidade

Toda referência é mantida por ID — nunca objeto embutido: `decisions`/`recommendations`/`reasonings`/`contexts`/`evidences` sempre referenciam a entidade de origem por `id`. De um `LearningRecord`, sempre é possível voltar a cada `Decision`, `Recommendation`, `Reasoning`, `Context` e `Evidence`, e a partir desta última às suas próprias `sources`.

## Regras implementadas (`learning.builder.ts`)

| Regra | Entrada usada | Condição | `LearningType` | `LearningSource` |
|---|---|---|---|---|
| Padrão de risco recorrente | `Reasoning.type === "operational_risk"` | Presente | `recurring_risk` | `execution` |
| Nota metodológica | Toda `Decision` produzida | Sempre (1 registro por Decision) | `methodology_note` | `execution` |

## Limitações

- **"Recorrência" é observada dentro de uma única execução, nunca entre execuções.** O exemplo da Mission 015 — "Empresas com recorrência de pressão de caixa costumam apresentar deterioração operacional" — descreve um padrão observado *ao longo do tempo*, entre múltiplas execuções. Este Engine só recebe agregados de uma única execução do pipeline; a regra "Padrão de risco recorrente" documenta a **coexistência estrutural** de risco de caixa e deterioração de rentabilidade dentro da mesma execução (via `Reasoning.type === "operational_risk"`, que já combina os dois — Mission 011), com linguagem deliberadamente condicional ("se esse padrão se repetir em execuções futuras..."), nunca afirmando recorrência real sem dado histórico — mesmo princípio das limitações já documentadas em `efos/engines/evidence/README.md` → `efos/engines/context/README.md` → `efos/engines/reasoning/README.md` → `efos/engines/recommendation/README.md`.
- **`pattern`, `observation`, `executive_insight` não são produzidos.** O vocabulário fechado (`efos/domain/enums/learning.ts`) reserva os 5 tipos pedidos pela Mission 015, mas só 2 regras estão implementadas nesta fase — mesmo precedente de todos os Engines anteriores: vocabulário fechado declarado por completo, produção incremental por missão.
- **`source` é sempre `"execution"`.** `rule`, `user_feedback` e `historical_pattern` estão reservados no vocabulário (instrução explícita da missão: "mesmo que alguns ainda não sejam utilizados"), mas nenhuma regra atual tem acesso a uma regra explícita nomeada, feedback humano ou série histórica entre execuções.
- **Nota metodológica é produzida para toda Decision, sem filtro de materialidade.** Diferente da regra de risco recorrente (que só dispara para um `Reasoning.type` específico), a nota metodológica documenta cada Decision indistintamente — decisão deliberada, já que o próprio ato de registrar "o que levou a esta Decision" é sempre metodologicamente relevante, não um evento raro a ser filtrado.
- **Não usa IA.** Todo registro é determinístico — mesma entrada sempre produz o mesmo `LearningAggregate` (mesmos ids).
- **Não persiste nada.** Nenhuma escrita em banco; o resultado existe apenas como valor de retorno em memória.
- **Não expõe API nem se integra com outro Engine.** Quem orquestra a chamada (futura Application Layer) é responsável por obter os cinco agregados de entrada e passar adiante o resultado.

## Exemplo de uso

```ts
import { ContextEngine } from "@/efos/engines/context";
import { DecisionEngine } from "@/efos/engines/decision";
import { EvidenceEngine } from "@/efos/engines/evidence";
import { FinancialKnowledgeGraphEngine } from "@/efos/engines/financial-knowledge-graph";
import { FinancialModelEngine } from "@/efos/engines/financial-model";
import { IndicatorsEngine } from "@/efos/engines/indicators";
import { LearningEngine } from "@/efos/engines/learning";
import { ReasoningEngine } from "@/efos/engines/reasoning";
import { RecommendationEngine } from "@/efos/engines/recommendation";

// ... financialModelEngine, indicatorsEngine, knowledgeGraphEngine,
// evidenceEngine, contextEngine, reasoningEngine, recommendationEngine,
// decisionEngine executados em sequência (ver READMEs anteriores) até
// obter evidenceResult, contextResult, reasoningResult,
// recommendationResult, decisionResult.

const learningEngine = new LearningEngine();
const context = { companyId: "company-123", pipelineRunId: "run-001" };

const learningResult = await learningEngine.execute(
  {
    companyId: "company-123",
    evidence: evidenceResult.output,
    context: contextResult.output,
    reasoning: reasoningResult.output,
    recommendation: recommendationResult.output,
    decision: decisionResult.output,
  },
  context
);

if (learningResult.status === "completed") {
  console.log(learningResult.output.learnings.length);
}
```

Nenhuma chamada acima é feita pelo próprio Engine — a orquestração entre todos os Engines da cadeia principal é responsabilidade de quem os invoca (futura Application Layer), nunca de um Engine chamando outro (D-002).
