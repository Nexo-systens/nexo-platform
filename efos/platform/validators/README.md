# EFOS Platform — Validators

Status: **implementado (Mission 051 — Financial Record Validation).** Camada oficial responsável por validar registros financeiros antes de serem consumidos pelo EFOS Core. **Nenhum dado é corrigido. Nenhum dado é inventado. A camada apenas valida.**

## Responsabilidade

`FinancialRecordValidator`/`DefaultFinancialRecordValidator` recebem a coleção completa de `RawFinancialDocument` já certificada (`FinancialKnowledgeBuilder`, Mission 050) e devolvem **exatamente essa mesma coleção** — mesmo contrato oficial do Data Engine (`efos/engines/data/data.types.ts`), nenhum tipo novo:

```
readonly RawFinancialDocument[] (já certificados)
        ↓
executar validações deterministas (sem efeito no retorno)
        ↓
readonly RawFinancialDocument[] (a mesma coleção, sem alteração)
```

Seja o registro válido ou inconsistente, o retorno é **sempre** exatamente igual à entrada — mesma referência. O Validator nunca modifica, nunca remove linha, nunca adiciona linha, nunca corrige valor/data/label/currency/classificação. Toda a lógica é idempotente por construção: como `validate()` nunca produz um efeito observável sobre o dado, `validate(validate(x))` é sempre igual a `validate(x)`.

## Validações implementadas

Todas deterministas — nenhuma IA, LLM ou heurística nova (as regras de compatibilidade reaproveitam exatamente a mesma lógica já usada por `FinancialLineClassifier`, Mission 046, e `FinancialEventResolver`/`FinancialKnowledgeBuilder`, Missions 048/050):

- **`amount` obrigatório quando existir `eventTypeHint`** — uma linha com um tipo de evento detectado mas sem valor associado.
- **`date` obrigatória quando `kindHint == "event"`** — mesmo campo exigido pelo Financial Model Engine para registros `kind="event"` (`efos/engines/financial-model/financial-model.constants.ts`, `missingOccurredAt`).
- **`resourceTypeHint`/`eventTypeHint` compatíveis com `kindHint`** — um único check: `kindHint` recalculado a partir de `eventTypeHint`/`resourceTypeHint` (mesma regra de `deriveKindHint()`, já usada por `FinancialLineClassifier`/`FinancialEventResolver`/`FinancialKnowledgeBuilder`) deve coincidir com o `kindHint` já registrado na linha. Qualquer divergência é o "conflito óbvio" explicitamente citado pela missão.
- **`currency` consistente dentro do mesmo documento** — todas as linhas de um documento que já têm `currency` detectado devem usar o mesmo código; duas moedas diferentes no mesmo documento é sinalizado.

## Diagnósticos internos — por que não são registrados em lugar nenhum

Cada verificação acima é implementada como uma função real, executada de fato para cada linha/documento (satisfazendo "executar apenas validações determinísticas" — as regras rodam, não são puladas), produzindo uma lista interna de `ValidationIssue` (tipo interno deste módulo, nunca exportado no contrato público). Esse diagnóstico **nunca é anexado a nenhum documento, nunca é logado, nunca é lançado como exceção** — é computado e descartado.

Isso é deliberado, não uma limitação de implementação: `RawFinancialLine`/`RawFinancialDocument` (`efos/engines/data/data.types.ts`) não têm nenhum campo para registrar um resultado de validação (sem `isValid`, sem `warnings`, sem `errors`), e o contrato do Data Engine é imutável nesta missão ("Não alterar: Engine"). A própria missão exige explicitamente que "se o registro for válido → retornar exatamente igual" e "se o registro possuir inconsistência → retornar exatamente igual" — ou seja, o comportamento observável do Validator é idêntico para qualquer entrada, por design. Lançar uma exceção também foi descartado: a seção "COMPORTAMENTO" da missão descreve apenas dois casos, ambos terminando em "retornar exatamente igual" — nenhum terceiro caminho (exceção) é mencionado, e lançar uma exceção quebraria a garantia de idempotência/retorno-sempre-igual pedida.

Este módulo existe, portanto, como o lugar oficial e nomeado onde a regra de validação determinística vive — pronto para uma futura missão conectar seus diagnósticos a um mecanismo real (log, campo de relatório, endpoint de erro), sem precisar reescrever a lógica de validação em si.

## Integração com o Upload API

`app/api/efos/upload/route.ts` (Mission 042–050) passou a chamar `new DefaultFinancialRecordValidator().validate(documents)` sobre a coleção completa já certificada por `DefaultFinancialKnowledgeBuilder` (Mission 050), antes de `DocumentIntake.prepareDocuments()`. Fluxo completo: `PDF → PdfParser → FinancialLineClassifier → FinancialLineNormalizer → FinancialEventResolver → FinancialDocumentConsolidator → FinancialKnowledgeBuilder → FinancialRecordValidator → DocumentIntake → EFOSPlatform`.

## Dependências permitidas

- `efos/engines/data` (`RawFinancialDocument`, `RawFinancialLine`) — apenas por tipo, contrato oficial do Data Engine.

## Dependências proibidas

- **Domain/Application/Runtime/Pipeline/Infrastructure/Bootstrap/Repository/Persistence/Engine concretos** — `DefaultFinancialRecordValidator` é uma peça isolada, autocontida, que só devolve `readonly RawFinancialDocument[]` inalterada.
- **IA, LLM, heurística nova** — todas as regras de compatibilidade reaproveitam a lógica já existente de `FinancialLineClassifier`/`FinancialEventResolver`/`FinancialKnowledgeBuilder`.
- **Qualquer alteração de dado** — valores, datas, labels, documentos, linhas: nada é criado, removido ou modificado.
