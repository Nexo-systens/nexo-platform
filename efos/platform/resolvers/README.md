# EFOS Platform — Resolvers

Status: **implementado (Mission 048 — Financial Event Resolution).** Primeiro módulo de resolução de eventos financeiros — a última etapa da preparação de um documento antes de `DocumentIntake`/`EFOSPlatform`, consolidando os sinais já detectados e normalizados num evento internamente consistente para o Data Engine.

## Responsabilidade

`FinancialEventResolver`/`DefaultFinancialEventResolver` recebem um `RawFinancialDocument` já classificado (`FinancialLineClassifier`, Mission 046) e normalizado (`FinancialLineNormalizer`, Mission 047), e devolvem um `RawFinancialDocument` — mesmo contrato oficial do Data Engine (`efos/engines/data/data.types.ts`), nenhum tipo novo:

```
RawFinancialDocument (já classificado e normalizado)
        ↓
para cada linha: se amount + eventTypeHint + date estiverem todos presentes,
                 confirmar kindHint = "event"; caso contrário, devolver
                 a linha exatamente como recebida
        ↓
RawFinancialDocument (eventos consolidados)
```

## Por que não existe um tipo `FinancialEvent` novo

O objetivo da missão fala em "resolver cada `RawFinancialLine` em um `FinancialEvent` canônico", mas o contrato explícito da missão é `resolve(document: RawFinancialDocument): RawFinancialDocument` — o mesmo tipo de entrada e saída. `RawFinancialLine` (`efos/engines/data/data.types.ts`) não tem campos separados `eventType`/`occurredAt`/`kind` — o Data Engine (`data.mapper.ts`, `mapDocumentsToCandidateRecords()`) já deriva esses três campos diretamente de `eventTypeHint`/`date`/`kindHint` na hora de montar `CandidateFinancialRecord`:

```ts
kind: line.kindHint ?? "resource",
resourceType: line.resourceTypeHint,
eventType: line.eventTypeHint,
occurredAt: line.date,
```

"Resolver" um evento financeiro, portanto, significa **consolidar** esses três campos já existentes (`kindHint`/`eventTypeHint`/`date`) quando os sinais necessários estiverem inequivocamente presentes — nunca criar um campo novo em `RawFinancialLine` (o contrato do Data Engine é imutável nesta missão, "Não alterar: Engine"), nunca inventar um valor.

## Regra de resolução implementada

Uma linha é resolvível como evento financeiro somente quando os três sinais explicitamente exigidos pela missão já estão presentes, sem ambiguidade: `amount`, `eventTypeHint` e `date`. Esses três, juntos, já satisfazem os únicos campos que o Financial Model Engine exige para um registro `kind="event"` — `eventType`/`occurredAt` (`efos/engines/financial-model/financial-model.constants.ts`: `missingEventType`, `missingOccurredAt`) — nada é inventado, apenas confirmado.

Quando a linha é resolvível: `kindHint` é explicitamente confirmado como `"event"` — mesma decisão que `FinancialLineClassifier` (Mission 046) já toma internamente sempre que detecta `eventTypeHint`, mas agora certificada nesta camada final, independente da lógica interna do Classifier. `resourceTypeHint`/`currency`/`amount`/`date`/`eventTypeHint`/`label` já detectados **nunca são alterados, nunca removidos** — permanecem exatamente como chegaram do Normalizer.

Quando a linha **não** é resolvível (falta `amount`, `eventTypeHint` ou `date`): devolvida exatamente como recebida, sem nenhuma alteração — nenhum campo obrigatório é preenchido por suposição. Isso inclui linhas classificadas como recurso (`kindHint: "resource"`, ex.: "Saldo em caixa") — esta missão resolve apenas o caminho de evento explicitamente descrito no objetivo; resolver `resourceType` para linhas de recurso sem um `resourceTypeHint` já detectado exigiria inferência, proibida.

## O que NÃO foi feito (deliberadamente)

- **Nenhum novo tipo `FinancialEvent`** — ver seção acima.
- **Nenhuma inferência de `resourceType`/`currency`/`amount`/`date` a partir de outro campo** — cada um só é considerado resolvido se já estava presente antes desta etapa (Classifier/Normalizer); o Resolver nunca deriva um desses valores a partir de outro.
- **Nenhuma tentativa de resolver linhas de recurso (`kindHint: "resource"`) sem `resourceTypeHint` já detectado** — faria exatamente o tipo de suposição que a missão proíbe.

## Integração com o Upload API

`app/api/efos/upload/route.ts` (Mission 042–047) passou a chamar `new DefaultFinancialEventResolver().resolve(document)` para cada `RawFinancialDocument` já normalizado por `DefaultFinancialLineNormalizer` (Mission 047), antes de `DocumentIntake.prepareDocuments()`. Fluxo completo: `PDF → PdfParser → FinancialLineClassifier → FinancialLineNormalizer → FinancialEventResolver → DocumentIntake → EFOSPlatform`.

## Dependências permitidas

- `efos/engines/data` (`RawFinancialDocument`, `RawFinancialLine`) — apenas por tipo, contrato oficial do Data Engine.

## Dependências proibidas

- **Domain/Application/Runtime/Pipeline/Infrastructure/Bootstrap/Repository/Persistence/Engine concretos** — `DefaultFinancialEventResolver` é uma peça isolada, autocontida, que só transforma `RawFinancialDocument` em `RawFinancialDocument`.
- **IA, LLM** — nenhuma chamada a um serviço de IA existe aqui.
- **Heurística de classificação** — este módulo nunca decide `eventTypeHint`/`resourceTypeHint`/`amount`/`currency`/`date` quando ausentes; isso é exclusividade de `FinancialLineClassifier`.
- **Formatação/limpeza de texto** — isso é exclusividade de `FinancialLineNormalizer`.
