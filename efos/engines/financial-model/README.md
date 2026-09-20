# Financial Model Engine

Status: **implementado (Mission 004).** Primeiro Engine funcional do EFOS.

## Objetivo

Transformar dados financeiros normalizados em um Financial Model canônico — a representação única e viva da realidade financeira de uma empresa, que todos os próximos Engines do pipeline (`efos/types/pipeline.ts`) irão consumir. (`docs/01_ARCHITECTURE/06_EFOS CORE.md`, §2)

## Responsabilidade

- Validar estruturalmente os dados de entrada (`financial-model.validator.ts`).
- Mapear registros normalizados para as entidades do domínio (`financial-model.mapper.ts`).
- Retornar o resultado no envelope comum `EfosEngineResult` (`efos/interfaces`).

Não calcula indicadores, não gera evidências, não persiste nada, não chama outro Engine, não integra com Supabase — ver "Limitações".

## Fluxo

```
FinancialModelEngineInput
        ↓
validateFinancialModelEngineInput()  →  falha? retorna EfosEngineResult{status:"failed"}
        ↓ (válido)
mapToFinancialModelAggregate()
        ↓
EfosEngineResult{status:"completed", output: FinancialModelAggregate}
```

## Entrada

`FinancialModelEngineInput`: `companyId` + uma lista de `NormalizedFinancialRecord`. **A partir da Mission 005, este tipo é definido oficialmente pelo Data Engine** (`efos/engines/data/data.types.ts`) e apenas reexportado aqui (`financial-model.types.ts`) para compatibilidade — o Data Engine é o produtor real deste contrato, não mais uma suposição. Cada registro é um `Resource` (Camada 1 da Ontologia) ou um `FinancialEvent` (Camada 2), discriminado pelo campo `kind`.

## Saída

`EfosEngineResult<FinancialModelAggregate>` — em caso de sucesso, `output` é um `FinancialModelAggregate` (`efos/domain`): a raiz `FinancialModel` + os `Resource[]`/`FinancialEvent[]` mapeados. O campo `indicators` do agregado é **sempre retornado vazio** — calculá-lo é responsabilidade do Indicators Engine, fora do escopo desta missão.

## Limitações

- **Não calcula KPIs/Indicators.** `indicators` do agregado de saída é sempre `[]`.
- **Não gera Evidence, Context, Reasoning, Recommendation, Decision nem Forecast.**
- **Não usa IA.** Todo o mapeamento é determinístico.
- **Não dispara Domain Events nem usa Event Bus** — o Engine é uma função pura de entrada/saída, chamada diretamente.
- **Não persiste nada.** Nenhuma escrita em banco; o resultado existe apenas como valor de retorno em memória.
- **Não expõe API nem se integra com outro Engine.** Quem orquestra a chamada (futuro Application Layer) é responsável por obter os dados normalizados e passar adiante o resultado.
- **Confiança de proveniência é fixa** (`very_high`) para todo dado mapeado nesta fase — o Engine não avalia a qualidade do dado recebido, apenas o estrutura. Calibrar confiança de verdade é trabalho futuro (Context/Evidence Engine).
- **Um único `FinancialModel` por empresa**, com ID derivado deterministicamente de `companyId` (`docs/DECISIONS.md`, D-001) — chamadas repetidas para a mesma empresa sempre produzem o mesmo `id` de raiz, nunca um modelo novo por execução.

## Exemplo de uso

```ts
import { FinancialModelEngine } from "@/efos/engines/financial-model";

const engine = new FinancialModelEngine();

const result = await engine.execute(
  {
    companyId: "company-123",
    records: [
      {
        recordId: "res-1",
        kind: "resource",
        resourceType: "cash",
        label: "Caixa",
        amount: 50000,
        currency: "BRL",
        source: "extrato-bancario.pdf",
      },
      {
        recordId: "evt-1",
        kind: "event",
        eventType: "sale",
        label: "Venda #1042",
        amount: 1200,
        currency: "BRL",
        occurredAt: "2026-07-01T00:00:00.000Z",
        source: "extrato-bancario.pdf",
      },
    ],
  },
  { companyId: "company-123", pipelineRunId: "run-001" }
);

if (result.status === "completed") {
  console.log(result.output.root.id); // "financial-model-company-123"
  console.log(result.output.resources.length); // 1
  console.log(result.output.events.length); // 1
}
```
