# EFOS Platform — Consolidators

Status: **implementado (Mission 049 — Financial Document Consolidation).** Primeiro módulo de consolidação estrutural de múltiplos documentos financeiros — antes desta missão, cada `RawFinancialDocument` era tratado isoladamente, sem nenhuma verificação de duplicação entre documentos ou entre linhas do mesmo documento.

## Responsabilidade

`FinancialDocumentConsolidator`/`DefaultFinancialDocumentConsolidator` recebem a coleção completa de `RawFinancialDocument` já resolvida (`FinancialEventResolver`, Mission 048) e devolvem uma coleção sem duplicações estruturais — mesmo contrato oficial do Data Engine (`efos/engines/data/data.types.ts`), nenhum tipo novo:

```
readonly RawFinancialDocument[] (já resolvidos)
        ↓
para cada documento: remover linhas duplicadas dentro dele
        ↓
entre documentos: remover documentos estruturalmente idênticos
        ↓
readonly RawFinancialDocument[] (consolidados, ordem preservada)
```

## Regras de consolidação implementadas

- **Linhas duplicadas dentro do mesmo documento** — duas linhas são consideradas a mesma linha somente se todos os campos já detectados forem idênticos (`label`, `amount`, `currency`, `date`, `kindHint`, `resourceTypeHint`, `eventTypeHint`). Primeira ocorrência vence, ordem original preservada.
- **Documentos duplicados** — dois documentos são considerados o mesmo documento estrutural quando têm o mesmo `source` e a mesma sequência de linhas (já deduplicadas). Primeira ocorrência vence, ordem original preservada. **`documentId` nunca é usado como chave de deduplicação** — cada `File` recebe um `documentId` novo via `randomUUID()` (`DefaultPdfParser`, Mission 042/045), então dois uploads do mesmo arquivo sempre têm `documentId` diferentes; a única forma real de detectar "o mesmo arquivo enviado duas vezes" é por conteúdo (`source`+linhas), não pelo identificador técnico.
- **`documentId`/`companyId`/`source`** de cada documento remanescente permanecem exatamente como recebidos — nenhum campo é reescrito, apenas entradas duplicadas inteiras são descartadas.

## O que NUNCA é feito

- **Recalcular valor** — nenhum `amount`/`currency` é somado, arredondado ou transformado.
- **Fundir documentos diferentes** — documentos com conteúdo parcialmente semelhante (mas não idêntico) permanecem como entradas separadas; consolidação só remove duplicatas exatas, nunca combina documentos distintos num só.
- **Alterar `label`/`date`/`amount`/classificação** — nenhuma linha remanescente é modificada; apenas entradas inteiras duplicadas são removidas.

## Integração com o Upload API

`app/api/efos/upload/route.ts` (Mission 042–048) passou a chamar `new DefaultFinancialDocumentConsolidator().consolidate(documents)` sobre a coleção completa de documentos já resolvidos por `DefaultFinancialEventResolver` (Mission 048), antes de `DocumentIntake.prepareDocuments()`. Fluxo completo: `PDF → PdfParser → FinancialLineClassifier → FinancialLineNormalizer → FinancialEventResolver → FinancialDocumentConsolidator → DocumentIntake → EFOSPlatform`.

`DocumentIntake.prepareDocuments()` (Mission 026, D-022) continua existindo depois do Consolidator e continua fazendo seu próprio trabalho (remove nulos/duplicatas por `documentId`, preserva ordem) — os dois módulos não se substituem: `DocumentIntake` deduplica por identificador técnico (`documentId`), `FinancialDocumentConsolidator` deduplica por conteúdo estrutural (`source`+linhas). Como cada documento desta missão sempre chega com `documentId` único (gerado por `DefaultPdfParser`), `DocumentIntake` nunca remove nada nesse ponto do fluxo hoje — mas seu papel permanece válido para qualquer chamador futuro de `EFOSPlatform` que não passe por este pipeline de upload.

## Dependências permitidas

- `efos/engines/data` (`RawFinancialDocument`, `RawFinancialLine`) — apenas por tipo, contrato oficial do Data Engine.

## Dependências proibidas

- **Domain/Application/Runtime/Pipeline/Infrastructure/Bootstrap/Repository/Persistence/Engines concretos** — `DefaultFinancialDocumentConsolidator` é uma peça isolada, autocontida, que só transforma `readonly RawFinancialDocument[]` em `readonly RawFinancialDocument[]`.
- **IA, LLM** — nenhuma chamada a um serviço de IA existe aqui.
- **Fusão de documentos, recálculo de valor, alteração de classificação** — ver seção "O que NUNCA é feito" acima.
