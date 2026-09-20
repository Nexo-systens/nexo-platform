# EFOS Platform — Classifiers

Status: **implementado (Mission 046 — Financial Line Classification).** Primeiro módulo de classificação determinística de linhas financeiras — antes desta missão, cada `RawFinancialLine` extraída de um PDF (`PdfParser`, Mission 045) só tinha `label` preenchido; agora ganha metadados que permitem ao Data Engine interpretar melhor o documento.

## Responsabilidade

`FinancialLineClassifier`/`DefaultFinancialLineClassifier` recebem um `RawFinancialDocument` já produzido e devolvem um `RawFinancialDocument` — mesmo contrato oficial do Data Engine (`efos/engines/data/data.types.ts`, `RawFinancialDocument`/`RawFinancialLine`), nenhum tipo novo — com cada linha enriquecida:

```
RawFinancialDocument (lines só com label)
        ↓
para cada linha: detectar amount/currency/date/kindHint/resourceTypeHint/eventTypeHint
        ↓
RawFinancialDocument (lines enriquecidas, campos ausentes quando não detectáveis)
```

Classificação puramente sintática — nenhuma IA, LLM ou OCR; apenas regras determinísticas (palavras-chave e padrões de texto). Nenhuma regra financeira/contábil (interpretar DRE/Balanço continua sendo responsabilidade exclusiva dos Builders dos Engines) — este módulo só decide *o quê parece estar escrito na linha*, nunca *o que isso significa para a empresa*.

## Regras implementadas

- **`amount`/`currency`** — um padrão moderado de valor monetário (`AMOUNT_PATTERN`): sinal opcional, prefixo de moeda opcional (`R$`, `US$`, `$`, `€`), dígitos com separador de milhar e decimal. O separador decimal é assumido como o último separador (`,` ou `.`) presente no número — cobre `R$ 15.000,00`, `-4.200,00`, `US$ 1,234.56`. `currency` só é preenchido quando um símbolo de moeda está de fato presente (`R$` → `BRL`, `US$`/`$` → `USD`, `€` → `EUR`) — nunca assumido por padrão.
- **`date`** — dois padrões: `dd/mm/yyyy`/`dd-mm-yyyy` e `yyyy-mm-dd`, ambos com dia/mês/ano já explícitos na linha; normalizado sempre para `yyyy-mm-dd`. Nenhum outro formato é reconhecido (não há tentativa de interpretar "5 de janeiro" ou similar).
- **`eventTypeHint`/`resourceTypeHint`** — tabelas de palavras-chave em português (sem acento, case-insensitive) mapeando para os valores já oficiais de `FinancialEventType`/`ResourceType` (`efos/domain/enums/domain-classification.ts`) — ex.: "venda"/"vendas" → `sale`, "pagamento" → `payment`, "cliente" → `client`, "fornecedor" → `supplier`. A primeira palavra-chave encontrada na linha vence; nenhuma tentativa de desambiguar múltiplas ocorrências.
- **`kindHint`** — `"event"` se um `eventTypeHint` foi detectado, `"resource"` se apenas um `resourceTypeHint` foi detectado (evento tem prioridade — uma linha que descreve uma transação, mesmo mencionando um recurso, é um evento), ausente se nenhum dos dois foi detectado.

## `period` — limitação documentada

O objetivo da missão pede para detectar `period` quando presente. `RawFinancialLine` (`efos/engines/data/data.types.ts`) **não tem** um campo `period` — o contrato do Data Engine é imutável nesta missão ("Não alterar: Engines"). Quando uma linha menciona uma data completa com dia explícito, ela é normalizada para `date` (acima). Um período sem dia (ex.: "Janeiro/2026", "Q1 2026") não é representável sem inventar um dia — permanece apenas no texto original de `label`, nunca sintetizado em `date` nem em nenhum outro campo. Resolver isso exigiria uma futura missão que reabra o contrato de `RawFinancialLine`, fora do escopo desta.

## Sem inventar dado

Todo campo detectado só é incluído no objeto de saída quando há certeza (`amount !== undefined`, `currency` truthy, `date` truthy, etc.) — nenhum campo recebe um valor "provável" ou "padrão"; a ausência de certeza mantém o campo ausente (`undefined`), exatamente como especificado pela missão.

## Integração com o Upload API

`app/api/efos/upload/route.ts` (Mission 042–045) passou a chamar `new DefaultFinancialLineClassifier().classify(document)` para cada `RawFinancialDocument` produzido por `DefaultPdfParser` (Mission 045), antes de `DocumentIntake.prepareDocuments()`. Fluxo completo: `PDF → PdfParser → FinancialLineClassifier → DocumentIntake → EFOSPlatform`.

## Dependências permitidas

- `efos/engines/data` (`RawFinancialDocument`, `RawFinancialLine`) — apenas por tipo, contrato oficial do Data Engine.
- `efos/domain` (`ResourceType`, `FinancialEventType`) — apenas por tipo, vocabulário já oficial da Ontologia (Camadas 1-2).

## Dependências proibidas

- **Domain/Engines/Runtime/Pipeline/Application/Infrastructure/Bootstrap/Platform (o restante de `efos/platform/`)/Persistence/Repository concretos** — `DefaultFinancialLineClassifier` é uma peça isolada, autocontida, que só transforma `RawFinancialDocument` em `RawFinancialDocument`.
- **IA, LLM, prompt** — nenhuma chamada a um serviço de IA existe aqui.
- **Regex gigante, parser de DRE, parser de Balanço** — apenas classificação básica linha a linha, deliberadamente fora de escopo qualquer interpretação estrutural de documento contábil.

## `FinancialStatementClassifier`/`DefaultFinancialStatementClassifier` (Mission 192 — Canonical Financial Statement Ingestion & Period Semantics)

Segundo classificador deste diretório, **estruturalmente separado** de `DefaultFinancialLineClassifier` (acima, inalterado) — resolve o mismatch que a Mission 191 comprovou empiricamente: um demonstrativo agregado por período (DRE) tem seu período declarado UMA vez no cabeçalho, nunca por linha, e suas linhas ("Receita Bruta", "Despesas com Vendas") não são transações — forçá-las pelo Classifier transacional produzia `kind="event"` sem `occurredAt` (rejeitado pelo Financial Model Engine) e falsos-positivos reais ("Despesas com Vendas" casando com o vocabulário de venda por conter a substring "vendas").

```
RawFinancialDocument (lines só com label)
        ↓
looksLikeFinancialStatement()? — vocabulário de categoria + ausência de data por linha
        ↓ sim
extrai o período ÚNICO do documento (cabeçalho — nunca por linha)
        ↓
para cada linha: classifica por FRASE inteira em StatementCategory (nunca substring solta)
        ↓
RawFinancialDocument (lines com kindHint="statement_line", statementCategory, period, isTotalLine)
```

Um documento passa por ESTE classificador OU por `DefaultFinancialLineClassifier` — nunca os dois (dispatch em `app/api/efos/_shared/prepareFinancialDocuments.ts`, por CONTEÚDO, nunca pela `categoria` cosmética escolhida no upload). Quando o período não pode ser determinado com segurança (nenhum dos 3 padrões — `dd/mm/yyyy a dd/mm/yyyy`, `Competência: mm/yyyy`, mês por extenso — casa em nenhuma linha), `classify()` não produz nenhuma `statement_line` — o documento é excluído do lote pelo chamador (D-108), nunca com um período fabricado.

`detectAmountAndCurrency()` (e os padrões de data que ela usa para excluir candidatos) foram extraídos de `DefaultFinancialLineClassifier.ts` para `detectMonetaryAmount.ts` (mesmo diretório) — reaproveitados por AMBOS os classificadores, comportamento idêntico byte a byte ao que existia antes desta missão. Ver `docs/DECISIONS.md`, D-106, e `docs/ENGINEERING_LOG.md`, Mission 192, para o registro completo.
