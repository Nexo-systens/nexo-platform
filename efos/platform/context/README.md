# EFOS Platform — Context

Status: **implementado (Mission 052 — Financial Context Builder).** Camada responsável por consolidar o contexto financeiro entre documentos, preparando a coleção que será entregue ao EFOS Core. **Esta camada nunca executa o Pipeline.**

## Responsabilidade

`FinancialContextBuilder`/`DefaultFinancialContextBuilder` recebem a coleção completa de `RawFinancialDocument` já validada (`FinancialRecordValidator`, Mission 051) e devolvem uma coleção com **os mesmos documentos** — mesmo contrato oficial do Data Engine (`efos/engines/data/data.types.ts`), nenhum tipo novo:

```
readonly RawFinancialDocument[] (já validados)
        ↓
confirmar relações já existentes / identificar contexto compartilhado (diagnóstico interno, sem efeito no conteúdo)
        ↓
organizar os documentos (única operação com efeito observável: ordem do array)
        ↓
readonly RawFinancialDocument[] (mesmos documentos, mesmas linhas, mesma referência de cada objeto — possivelmente reordenados)
```

Nenhum documento é criado. Nenhuma linha é criada. Nenhum valor, data, label, `currency`, classificação ou hint é alterado. Cada `RawFinancialDocument`/`RawFinancialLine` devolvido é exatamente o mesmo objeto recebido (mesma referência) — a única mudança observável possível é a **posição** de um documento dentro do array.

## Operações implementadas

Todas deterministas — nenhuma IA, LLM ou heurística nova:

- **Confirmar relações já existentes — `companyId` compartilhado.** Todos os documentos de uma mesma coleção pertencem à mesma empresa, já que `app/api/efos/upload/route.ts` sempre chama `PdfParser.parse(file, companyId)` com o mesmo `companyId` para todos os arquivos de um único upload. Esta checagem apenas **confirma** essa relação já existente, nunca a cria.
- **Identificar contexto compartilhado / validar consistência entre documentos — `currency` compartilhada.** Mesma checagem de moeda já feita pelo `FinancialRecordValidator` (Mission 051), agora estendida entre documentos (em vez de só dentro de um único documento) — todas as linhas de todos os documentos que já têm `currency` detectado deveriam usar o mesmo código.
- **Organizar os documentos.** Único requisito da missão com efeito observável real. A coleção é ordenada por `companyId`, depois `source`, depois `documentId` (desempate final, sempre único) — todos campos já existentes no contrato oficial, nenhum campo inventado. Como `documentId` nunca se repete, o critério forma uma ordem total determinística: ordenar uma coleção já ordenada produz exatamente a mesma ordem (idempotente por construção).

## Diagnósticos internos — por que não são registrados em lugar nenhum

As duas checagens de confirmação/consistência acima são implementadas como funções reais, executadas de fato para cada `build()` (satisfazendo "validar consistência"/"identificar contexto compartilhado"/"confirmar relações já existentes" — as regras rodam, não são puladas), produzindo uma lista interna de `ContextIssue` (tipo interno deste módulo, nunca exportado no contrato público). Esse diagnóstico **nunca é anexado a nenhum documento, nunca é logado, nunca é lançado como exceção** — é computado e descartado, exatamente o mesmo racional já usado por `FinancialRecordValidator` (Mission 051): `RawFinancialLine`/`RawFinancialDocument` não têm nenhum campo para registrar contexto ou resultado de validação, e o contrato do Data Engine é imutável nesta missão ("Não alterar: Engine").

## Por que "organizar os documentos" foi limitado a um critério de campos já existentes

A missão permite "organizar os documentos" mas proíbe inventar dado. O único critério defensável sem heurística nova é ordenar por campos que o contrato já garante existir em todo documento (`companyId`, `source`, `documentId`) — nunca por um campo derivado (ex.: valor total, data mais recente), o que exigiria somar/comparar dados financeiros e se aproximaria de uma heurística de negócio nova, fora do escopo desta missão. A ordenação nunca reordena as `lines` dentro de um documento (isso pertenceria a uma camada de classificação/consolidação, não de contexto entre documentos) e nunca funde ou remove documentos — essa é responsabilidade exclusiva de `FinancialDocumentConsolidator` (Mission 049).

## Integração com o Upload API

`app/api/efos/upload/route.ts` (Mission 042–052) passou a chamar `new DefaultFinancialContextBuilder().build(validatedDocuments)` sobre a coleção completa já validada por `DefaultFinancialRecordValidator` (Mission 051), antes de `DocumentIntake.prepareDocuments()`. Fluxo completo: `PDF → PdfParser → FinancialLineClassifier → FinancialLineNormalizer → FinancialEventResolver → FinancialDocumentConsolidator → FinancialKnowledgeBuilder → FinancialRecordValidator → FinancialContextBuilder → DocumentIntake → EFOSPlatform`.

## Dependências permitidas

- `efos/engines/data` (`RawFinancialDocument`, `RawFinancialLine`) — apenas por tipo, contrato oficial do Data Engine.

## Dependências proibidas

- **Domain/Application/Runtime/Pipeline/Infrastructure/Bootstrap/Repository/Persistence/Engine concretos** — `DefaultFinancialContextBuilder` é uma peça isolada, autocontida, que só devolve `readonly RawFinancialDocument[]` com os mesmos documentos recebidos.
- **IA, LLM, heurística nova** — a checagem de `currency` reaproveita a lógica já existente de `FinancialRecordValidator`; a ordenação usa exclusivamente campos já garantidos pelo contrato.
- **Qualquer alteração de dado** — valores, datas, labels, linhas, documentos: nada é criado, removido, fundido ou modificado. Apenas a ordem do array pode mudar.
