# Data Engine

Status: **implementado (Mission 005).** Primeiro estágio do pipeline oficial do EFOS.

## Objetivo

Transformar documentos financeiros brutos em `NormalizedFinancialRecord[]` — o contrato oficial de entrada do Financial Model Engine (`efos/engines/financial-model`). (`docs/01_ARCHITECTURE/06_EFOS CORE.md`, §1)

## Responsabilidade

- Validar estruturalmente os documentos recebidos (`data.validator.ts`).
- Mapear documento+linha para um formato candidato intermediário (`data.mapper.ts`).
- Normalizar o formato candidato em registros financeiros padronizados (`data.normalizer.ts`).
- Retornar o resultado no envelope comum `EfosEngineResult` (`efos/interfaces`).

Não interpreta, não recomenda, não calcula, não persiste, não usa IA, não integra com Supabase nem chama outro Engine — ver "Limitações".

## Fluxo

```
DataEngineInput (RawFinancialDocument[])
        ↓
validateDataEngineInput()          →  falha? retorna EfosEngineResult{status:"failed"}
        ↓ (válido)
mapDocumentsToCandidateRecords()   →  CandidateFinancialRecord[] (reshape puro)
        ↓
normalizeCandidateRecords()        →  NormalizedFinancialRecord[] (padronizado)
        ↓
EfosEngineResult{status:"completed", output: NormalizedFinancialRecord[]}
```

## Entrada

`DataEngineInput`: `companyId` + uma lista de `RawFinancialDocument`, cada um com `documentId`, `source` e uma lista de `RawFinancialLine` (label, valor, moeda, data, e "hints" opcionais de tipo de recurso/evento). Assume que a extração de texto/OCR de arquivos binários já aconteceu em uma etapa anterior — este Engine recebe dado já estruturado em linhas, nunca bytes de arquivo.

## Saída

`EfosEngineResult<readonly NormalizedFinancialRecord[]>` — em caso de sucesso, `output` é a lista de registros normalizados, prontos para alimentar o Financial Model Engine sem nenhuma transformação adicional.

## Processo de normalização

`data.normalizer.ts` aplica, por registro:

- **Label**: `trim()` + colapso de espaços múltiplos.
- **Moeda**: default `BRL` quando há `amount` mas a moeda não foi informada; sempre normalizada para maiúsculas.
- **Data**: reformatada para ISO 8601 quando parseável; descartada (não inventada) quando inválida.
- **Registros sem `label` utilizável são descartados** antes de chegar à saída final.

Nenhum cálculo financeiro acontece aqui — nenhuma soma, conversão de moeda ou agregação. Isso é responsabilidade de Engines futuros (Indicators).

## Limitações

- **Não realiza extração/OCR de arquivo binário.** Assume que `RawFinancialLine[]` já existe — construir essa ponte a partir de `modules/documents` (Storage/Supabase) é responsabilidade da Application Layer (`docs/01_ARCHITECTURE/07_SOFTWARE ARCHITECTURE.md`), não deste Engine.
- **Não usa IA.** Todo o processamento é determinístico.
- **Não calcula KPIs, Indicators, Evidence, Context, Reasoning, Recommendation, Decision nem Forecast.**
- **Não dispara Domain Events nem usa Event Bus.**
- **Não persiste nada** e **não se integra com Supabase**.
- **Não chama outro Engine.** A relação com o Financial Model Engine é exclusivamente de **contrato de tipo** (`NormalizedFinancialRecord`, definido aqui e importado por tipo em `efos/engines/financial-model`) — nunca uma chamada de `execute()` entre Engines, o que continuaria proibido por `docs/PROJECT_RULES.md` REGRA 5.
- **`kindHint` ausente é assumido como `"resource"`** — uma decisão de mapeamento simples, não uma inferência inteligente; documentos que não informam o hint corretamente produzirão classificação grosseira.

## Exemplo de utilização

```ts
import { DataEngine } from "@/efos/engines/data";

const engine = new DataEngine();

const result = await engine.execute(
  {
    companyId: "company-123",
    documents: [
      {
        documentId: "doc-1",
        companyId: "company-123",
        source: "extrato-bancario.pdf",
        lines: [
          {
            label: "  Saldo em caixa  ",
            kindHint: "resource",
            resourceTypeHint: "cash",
            amount: 50000,
            currency: "brl",
          },
          {
            label: "Venda #1042",
            kindHint: "event",
            eventTypeHint: "sale",
            amount: 1200,
            date: "2026-07-01",
          },
        ],
      },
    ],
  },
  { companyId: "company-123", pipelineRunId: "run-001" }
);

if (result.status === "completed") {
  console.log(result.output.length); // 2
  console.log(result.output[0].label); // "Saldo em caixa" (normalizado)
  console.log(result.output[0].currency); // "BRL"
}
```

Encadeando com o Financial Model Engine:

```ts
import { DataEngine } from "@/efos/engines/data";
import { FinancialModelEngine } from "@/efos/engines/financial-model";

const context = { companyId: "company-123", pipelineRunId: "run-001" };

const dataResult = await new DataEngine().execute(dataInput, context);

if (dataResult.status === "completed") {
  const modelResult = await new FinancialModelEngine().execute(
    { companyId: "company-123", records: dataResult.output },
    context
  );
}
```
