# EFOS Platform — Builders

Status: **implementado (Mission 050 — Financial Knowledge Builder).** Camada final de preparação de documentos financeiros da plataforma EFOS — transforma documentos consolidados em conhecimento financeiro estruturado antes de a `EFOSPlatform` entregá-los ao EFOS Core. **Esta camada nunca executa o Pipeline.**

## Responsabilidade

`FinancialKnowledgeBuilder`/`DefaultFinancialKnowledgeBuilder` recebem a coleção completa de `RawFinancialDocument` já classificada (`FinancialLineClassifier`, Mission 046), normalizada (`FinancialLineNormalizer`, Mission 047), resolvida (`FinancialEventResolver`, Mission 048) e consolidada (`FinancialDocumentConsolidator`, Mission 049), e devolvem uma coleção — mesmo contrato oficial do Data Engine (`efos/engines/data/data.types.ts`), nenhum tipo novo:

```
readonly RawFinancialDocument[] (já classificados, normalizados, resolvidos, consolidados)
        ↓
para cada linha: consolidar/certificar kindHint a partir de
                 eventTypeHint/resourceTypeHint já detectados
        ↓
readonly RawFinancialDocument[] (mesmos documentos, na mesma ordem)
```

## Regra implementada

Para cada linha, `kindHint` é recalculado a partir de `eventTypeHint`/`resourceTypeHint` já detectados, usando exatamente a mesma regra determinística já usada por `FinancialLineClassifier` (Mission 046) e `FinancialEventResolver` (Mission 048) — nenhuma heurística nova. Para qualquer documento que já passou pelo pipeline oficial de preparação (`FinancialLineClassifier` → `FinancialLineNormalizer` → `FinancialEventResolver` → `FinancialDocumentConsolidator`), isso é sempre um no-op: `kindHint` já está correto, e a linha é devolvida exatamente como recebida. Esse recálculo existe como uma certificação final defensiva — mesmo espírito do que `FinancialEventResolver` já faz por documento (Mission 048), agora reafirmado no último ponto antes de `DocumentIntake`/`EFOSPlatform` — nunca como fonte de uma classificação nova.

Nenhuma outra transformação é aplicada: `label`/`amount`/`currency`/`date`/`resourceTypeHint`/`eventTypeHint` de cada linha, e `documentId`/`companyId`/`source` de cada documento, permanecem exatamente como recebidos. Nenhum documento é removido, criado ou fundido — a coleção devolvida tem exatamente os mesmos documentos, na mesma ordem.

## Por que as demais operações "permitidas" pela missão não têm uma realização segura aqui

A missão lista quatro operações permitidas: "consolidar campos já classificados" (implementada, acima), "validar consistência entre linhas", "remover ambiguidades já resolvidas" e "padronizar relações entre eventos". As três últimas foram deliberadamente **não implementadas** além do que a consolidação de `kindHint` já cobre, porque nenhuma delas tem uma realização segura dentro das restrições desta mesma missão:

- **"Validar consistência entre linhas"** — `RawFinancialLine`/`RawFinancialDocument` não têm nenhum campo para registrar o resultado de uma validação (sem `isValid`, sem `warnings`, sem `errors`) — criar um desses campos seria alterar o contrato do Data Engine, proibido ("Não alterar: Engine"). Uma validação que não pode ser registrada em lugar nenhum não tem efeito observável; implementá-la seria código morto.
- **"Remover ambiguidades já resolvidas"** — a única ambiguidade genuína e resolvível sem inventar informação é exatamente a consistência de `kindHint` com `eventTypeHint`/`resourceTypeHint`, já coberta pela regra implementada acima. Uma linha com **ambos** `eventTypeHint` e `resourceTypeHint` detectados (ex.: "Pagamento de fornecedor" → `payment` + `supplier`) não é uma ambiguidade a resolver — os dois campos coexistem legitimamente no contrato (`data.mapper.ts` sempre repassa ambos para `CandidateFinancialRecord`, independente de `kind`); removeria um dos dois seria "alterar classificação", proibido.
- **"Padronizar relações entre eventos"** — `RawFinancialLine` não tem nenhum campo de relação com outra linha (sem `relatedLineId`, sem `groupId`). A única "relação" implícita entre linhas é a ordem em que aparecem — e reordenar linhas violaria a garantia de ordem já estabelecida por `FinancialDocumentConsolidator` (Mission 049) e não tem nenhum critério determinístico e seguro definido por esta missão para decidir uma nova ordem "padronizada".

Nenhuma IA, LLM ou heurística nova foi criada para tentar viabilizar essas três operações — fazer isso seria precisamente o que a missão proíbe.

## Integração com o Upload API

`app/api/efos/upload/route.ts` (Mission 042–049) passou a chamar `new DefaultFinancialKnowledgeBuilder().build(documents)` sobre a coleção completa já consolidada por `DefaultFinancialDocumentConsolidator` (Mission 049), antes de `DocumentIntake.prepareDocuments()`. Fluxo completo: `PDF → PdfParser → FinancialLineClassifier → FinancialLineNormalizer → FinancialEventResolver → FinancialDocumentConsolidator → FinancialKnowledgeBuilder → DocumentIntake → EFOSPlatform`.

## Dependências permitidas

- `efos/engines/data` (`RawFinancialDocument`, `RawFinancialLine`) — apenas por tipo, contrato oficial do Data Engine.

## Dependências proibidas

- **Domain/Application/Runtime/Pipeline/Infrastructure/Bootstrap/Persistence/Repository/Engine concretos** — `DefaultFinancialKnowledgeBuilder` é uma peça isolada, autocontida, que só transforma `readonly RawFinancialDocument[]` em `readonly RawFinancialDocument[]`; **nunca executa o Pipeline** (nunca conhece `EFOSPipelineOrchestrator`/`EFOSPipelineRuntime`/`EFOSFacade`/`EFOSPlatform`).
- **IA, LLM, heurística nova** — nenhuma regra além da já reutilizada de `FinancialLineClassifier`/`FinancialEventResolver` existe aqui.
- **Criação de valor, data, documento ou campo novo** — ver seção "Por que as demais operações... não têm uma realização segura" acima.
