# Application Layer — Orchestrators

Status: **encadeamento real dos 10 Engines (Mission 020A) + estado completo da execução preservado (Mission 020B — Pipeline Execution State).** Contratos definidos na Mission 018; `EFOSPipelineRuntime` (Mission 019) é a primeira implementação concreta de `EFOSPipelineOrchestrator` — inicialmente percorria `EFOS_PIPELINE` só registrando cada estágio, sem chamar nenhum Engine. Desde a Mission 020A, `execute()` chama de fato `Engine.execute()` de cada um dos 10 Engines da cadeia principal, na ordem oficial, encadeando a saída de um estágio como entrada do próximo. Desde a Mission 020B, cada saída de estágio é armazenada em `PipelineExecution`, retornado junto de `PipelineMetadata` em `PipelineResult`. Nenhum Service/Use Case invoca o Runtime ainda — isso permanece trabalho de uma missão futura.

## Responsabilidade do Orchestrator

O `EFOSPipelineOrchestrator` é a peça que, quando implementada (Mission 019), vai encadear a execução dos 10 Engines da cadeia principal (`EFOS_PIPELINE`, `efos/types/pipeline.ts`), na ordem oficial (D-006, D-012): Data → Financial Model → Indicators → Financial Knowledge Graph → Evidence → Context → Reasoning → Recommendation → Decision → Learning. É a **única** peça autorizada a chamar `Engine.execute()` de múltiplos Engines em sequência (`docs/ARCHITECTURE.md`, "Camadas" — "Application... é a única camada autorizada a encadear `execute()` de múltiplos Engines"). Nenhum Engine chama outro Engine (D-002); nenhum Service chama um Engine diretamente (`docs/application/services/README.md`) — só o Orchestrator tem essa autorização.

## Relação com Services

Um Service (`efos/application/services/`) que precisar de um diagnóstico completo (ex.: `AnalysisService.analyze()`) vai, quando implementado, invocar o Orchestrator — nunca os Engines diretamente. O Orchestrator é consumido por Services, não o contrário: Services conhecem o Orchestrator (via `EFOSPipelineOrchestrator`, injetado ou referenciado), mas o Orchestrator nunca importa um Service específico — ele só conhece Engines e `EFOS_PIPELINE`.

## Relação com Use Cases

Use Cases (`efos/application/use-cases/`) nunca conhecem o Orchestrator diretamente — dependem apenas de Services (`docs/application/use-cases/README.md`, regra já estabelecida na Mission 017). O Orchestrator fica uma camada abaixo de Use Case, acessível só através de um Service.

## Relação com Engines

O Orchestrator é o único ponto do sistema autorizado a conhecer e encadear múltiplos Engines (`efos/engines/*`) em sequência — nenhum Engine chama outro (D-002), então essa responsabilidade não pode viver dentro de nenhum Engine; ela vive aqui. Desde a Mission 020A, `EFOSPipelineRuntime` importa e instancia os 10 Engines da cadeia principal, conhecendo cada um apenas através do contrato comum `EfosEngine`/`EfosEngineContext`/`EfosEngineResult` (`efos/interfaces/engine.ts`).

## Fluxo completo da execução

```
Service (ex.: AnalysisService)
        ↓
EFOSPipelineOrchestrator.execute(PipelineContext)
        ↓
Data Engine.execute() → Financial Model Engine.execute() → Indicators Engine.execute() →
Financial Knowledge Graph Engine.execute() → Evidence Engine.execute() → Context Engine.execute() →
Reasoning Engine.execute() → Recommendation Engine.execute() → Decision Engine.execute() →
Learning Engine.execute()
        ↓
PipelineResult { success: true, value: { metadata: PipelineMetadata, execution: PipelineExecution } }
```

O `PipelineResult` retornado, no caminho de sucesso, contém **tanto** `PipelineMetadata` (estágio atual, estágios concluídos, status, duração) **quanto** `PipelineExecution` (a saída de cada estágio, armazenada tal como produzida pelo Engine correspondente — Mission 020B, D-017). Antes da Mission 020B, `PipelineResult` só carregava `PipelineMetadata` — decisão deliberada da Mission 018, para manter o contrato de saída do Orchestrator estável independentemente de quantos/quais Engines existiam; a Mission 020B revisita essa decisão agora que os Engines de fato produzem agregados a preservar. No caminho de falha (`success: false`), `Result` continua só com `error` — nenhuma execução parcial é exposta. **A chamada real a cada `Engine.execute()` existe desde a Mission 020A** — ver seção "Runtime" abaixo.

## Runtime (`EFOSPipelineRuntime.ts`, Mission 019; encadeamento real desde a Mission 020A; preserva `PipelineExecution` desde a Mission 020B)

`EFOSPipelineRuntime` é a primeira classe concreta que implementa `EFOSPipelineOrchestrator`. Segue um ciclo de vida de 4 métodos — todos existem, mas só `execute()` tem fluxo de negócio real:

| Método | Visibilidade | Implementado? | Responsabilidade |
|---|---|---|---|
| `prepare(context)` | privado | Não — no-op | Ponto de extensão reservado para preparo de recursos antes da execução (ex.: resolver Ports concretos, inicializar um `Logger`). |
| `validate(context)` | privado | Parcial — única verificação estrutural | Confirma que `companyId`/`requestId`/`executionId` estão presentes no `PipelineContext`; retorna um `PipelineError` se não. Nunca valida regra de negócio (isso pertence a cada `<engine>.validator.ts`). |
| `execute(context)` | público (contrato) | Sim — encadeia os 10 Engines | Ver "Fluxo implementado" abaixo. |
| `finalize(context, state)` | privado | Não — no-op | Ponto de extensão reservado para limpeza pós-execução (ex.: liberar recursos, registrar conclusão via `Logger`). Chamado no caminho de sucesso, no de falha de validação e no de falha de um Engine. |

### Fluxo implementado em `execute()` (Mission 020A/020B)

```
execute(context)
  → prepare(context)                          — no-op
  → validate(context)
      → inválido? → finalize(context, failedState) → retorna PipelineResult{success:false}
      → válido, continua
  → cria PipelineRuntimeState { status:"running", completedStages:[], startedAt }
  → cria EfosEngineContext { companyId: context.companyId, pipelineRunId: context.executionId }
  → cria PipelineExecution (rascunho) { pipelineContext: context }
  → para cada stage em EFOS_PIPELINE (nunca um array próprio):
        state.currentStage = stage
        # chama Engine.execute(input, engineContext) do Engine correspondente
        # `input` é montado lendo os campos já preenchidos de PipelineExecution
        # (nunca uma variável paralela) — exatamente o contrato de tipo oficial
        # entre os dois Engines (D-002)
        → EfosEngineResult.status === "failed"?
              → finalize(context, failedState com failedStage=stage)
              → retorna PipelineResult{success:false, error:{code:"unexpected", message}}
        → sucesso → execution.<campo do estágio> = result.output (guardado por
          referência, nunca copiado ou recalculado — D-017)
        state.completedStages.push(stage)
  → state.status = "completed"; state.finishedAt; state.duration calculado
  → finalize(context, state)                  — no-op
  → retorna PipelineResult{success:true, value: { metadata: PipelineMetadata, execution: PipelineExecution }}
```

O primeiro estágio (Data Engine) exige `RawFinancialDocument[]`, dado que nenhum estágio anterior produz — lido de `context.metadata.documents`, tipado com o contrato oficial já definido pelo Data Engine como produtor (D-016), em vez de um campo novo em `PipelineContext`. Todos os demais estágios recebem exclusivamente agregados produzidos pelo estágio imediatamente anterior (ou por vários estágios anteriores, quando o contrato formal de um Engine exige mais de um agregado — ver `docs/ARCHITECTURE.md`, seção "Contracts") — com uma única exceção, o estágio `"evidence"` (Mission 174): além dos agregados anteriores, `extractPriorPeriods(context)` (espelha `extractRawDocuments()`) lê `context.metadata.priorPeriods?: readonly EvidenceHistoricalPeriod[]` — histórico comparável já canonicalizado por `buildCanonicalPriorPeriods()` (`efos/application/history/`), espalhado na chamada de `EvidenceEngine.execute()` apenas quando não-vazio, permitindo Evidence temporal (D-087) numa execução real de produção pela primeira vez. Mesmo mecanismo de transporte de `documents`, mesma justificativa (D-016) — nunca um campo novo em `PipelineContext`, nunca um parâmetro novo em `EFOSPipelineOrchestrator.execute()`.

**Mission 175R — Reanalysis Safety & Temporal Degradation Closure (D-090).** `buildCanonicalPriorPeriods()` canonicaliza o histórico comparável ENTRE SI, mas roda ANTES deste pipeline calcular o período que a execução ATUAL vai descrever — estruturalmente incapaz de excluir uma execução histórica que coincida com esse período (reanálise) ou que seja cronologicamente FUTURA (persistida fora de ordem). Sem correção, `evidence.validator.ts` (Mission 166) rejeitava a chamada INTEIRA do Evidence Engine por sobreposição, derrubando toda a execução. Novo helper privado `restrictToPeriodsStrictlyBeforeCurrent(priorPeriods, currentIndicators)`, aplicado no estágio `"evidence"` logo após `extractPriorPeriods()` — exatamente o primeiro ponto em que `execution.indicators` (o período ATUAL, já calculado pelo estágio `"indicators"` desta MESMA execução) está disponível ao lado de `priorPeriods`. Filtra (nunca reordena/recanonicaliza) o array já canonicalizado, mantendo somente entradas cujo `Period.endDate` seja menor ou igual ao `Period.startDate` atual — cronologia financeira estrita (D-090), nunca `executedAt`/ordem de execução/chegada. Aplicado ANTES de qualquer chamada ao Engine — nunca uma tentativa-e-erro (o `DefaultEFOSFacade` não tenta mais uma segunda análise sem `priorPeriods` em caso de falha, comportamento removido pela mesma missão).

### `PipelineRuntimeState` — estado interno

Estrutura privada, mutável, nunca persistida e nunca exposta fora de `execute()`: `status` (`EngineStatus`), `currentStage?`, `completedStages` (array mutável durante a execução), `failedStage?`, `startedAt`, `finishedAt?`, `duration?`. Ao final, é convertida (função `toPipelineMetadata`) em `PipelineMetadata` (imutável) para compor o `PipelineResult`.

### `PipelineExecution` — estado completo da execução (Mission 020B)

Construído incrementalmente dentro de `execute()` como `PipelineExecutionDraft` — mesma forma de `PipelineExecution` (`PipelineExecution.ts`) sem `readonly`, privada a este arquivo, nunca exposta fora de `execute()`. Cada campo (`data`, `financialModel`, `indicators`, `financialKnowledgeGraph`, `evidence`, `context`, `reasoning`, `recommendation`, `decision`, `learning`) é preenchido uma única vez, logo após o `Engine.execute()` daquele estágio retornar `status: "completed"` — nunca recalculado, nunca modificado depois. O mesmo objeto é lido diretamente para montar a entrada do próximo estágio (em vez de manter uma variável de saída por Engine **e** o campo de `PipelineExecution` simultaneamente — D-017, elimina duplicação de dado). Ao final de uma execução bem-sucedida, o rascunho (já totalmente preenchido) é devolvido como o `PipelineExecution` (readonly) dentro de `PipelineResult`.

### `PipelineError` — interrupção limpa

`{ stage?, code: ApplicationErrorCode, message }` — reaproveita `ApplicationErrorCode` (`efos/application/shared/Errors.ts`), sem criar um novo vocabulário. Usado por `validate()` (falha antes de qualquer estágio) e, desde a Mission 020A, pelo próprio `execute()` quando um `Engine.execute()` retorna `status: "failed"` (`stage` preenchido com o estágio que falhou) — em ambos os casos apenas para interromper a execução de forma limpa, nunca para retry, rollback ou recovery.

### Pontos de extensão de log

`prepare()`, `validate()` e `finalize()` têm comentários marcando exatamente onde um `Logger` (`efos/application/ports/Logger.ts`, ainda sem implementação) seria chamado — nenhum Logger é instanciado ou usado nesta missão.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `EFOSPipelineOrchestrator.ts` | Contrato único: `execute(context: PipelineContext): Promise<PipelineResult>`. |
| `EFOSPipelineRuntime.ts` | Primeira implementação concreta do contrato (Mission 019); encadeia os 10 Engines de verdade desde a Mission 020A e preserva `PipelineExecution` desde a Mission 020B — ver "Runtime" acima. |
| `PipelineContext.ts` | `companyId`, `requestId`, `executionId`, `timestamp`, `metadata?` — contexto mínimo de uma execução. |
| `PipelineExecution.ts` (Mission 020B) | Objeto canônico de uma execução completa — `pipelineContext` + um campo opcional por estágio (`data`…`learning`), cada um armazenando o Aggregate produzido pelo Engine correspondente (D-017). |
| `PipelineExecutionSnapshot.ts` (Mission 020B) | Value Object imutável que combina `PipelineMetadata` + `PipelineExecution` para consumo externo futuro (API/Dashboard) — ainda não produzido nem consumido por nenhum componente. |
| `PipelineResult.ts` | `ApplicationResult<{ metadata: PipelineMetadata; execution: PipelineExecution }>` (revisado na Mission 020B, D-017) — reaproveita o envelope de resultado já definido em `efos/application/contracts/ApplicationResult.ts` (Mission 017), sem duplicar conceito. |
| `PipelineStage.ts` | Reexporta `EFOS_PIPELINE`/`PipelineStage` de `efos/types/pipeline.ts` — não redeclara a ordem oficial do pipeline, nunca uma segunda fonte de verdade. |
| `PipelineMetadata.ts` | `startedAt`, `finishedAt?`, `duration?`, `currentStage?`, `completedStages`, `failedStage?`, `status` (reaproveita `EngineStatus`, `efos/types/common.ts`). |

## Dependências permitidas

- `efos/types` (`EFOS_PIPELINE`, `PipelineStage`, `EngineStatus`, `EngineId`) — vocabulário já oficial do EFOS Core.
- `efos/interfaces` (`EfosEngine`, `EfosEngineContext`, `EfosEngineResult`) — contrato comum a todo Engine; forma como o Runtime conhece e chama cada um (desde a Mission 020A).
- `efos/engines/*` (as 10 classes de Engine da cadeia principal + seus tipos de Input/Output oficiais) — o Runtime é a única peça da Application Layer autorizada a importar e instanciar Engines (Mission 020A).
- `efos/domain` (os 8 agregados encadeados entre Engines — `FinancialModelAggregate`, `IndicatorsAggregate`, `FinancialKnowledgeGraphAggregate`, `EvidenceAggregate`, `ContextAggregate`, `ReasoningAggregate`, `RecommendationAggregate`, `DecisionAggregate`, mais `LearningAggregate`) — apenas por tipo, para tipar os campos de `PipelineExecution` (Mission 020B) que `execute()` preenche incrementalmente.
- `efos/application/contracts` (`ApplicationResult`) — envelope de resultado já estabelecido pela Mission 017.
- `efos/application/shared` (`ApplicationErrorCode`) — vocabulário de erro já estabelecido pela Mission 017, reaproveitado por `PipelineError`.

## Dependências proibidas

- **HTTP/Controllers/API** — o Orchestrator não sabe que existe uma API REST/HTTP.
- **Banco/Persistência/Filas/Eventos** — nenhuma implementação concreta, nenhuma fila de jobs, nenhum barramento de eventos.
- **Retries/Rollback/Recovery** — `PipelineError` só permite interromper a execução de forma limpa, nunca repetir, desfazer ou recuperar automaticamente.
- **Paralelismo** — o `for` sobre `EFOS_PIPELINE` é estritamente sequencial; nenhuma execução concorrente de estágios.
- **Infraestrutura em geral** (Supabase, Next.js, sistema de arquivos) — mesma restrição de toda a Application Layer (`efos/application/README.md`).
