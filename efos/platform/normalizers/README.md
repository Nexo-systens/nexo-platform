# EFOS Platform — Normalizers

Status: **implementado (Mission 047 — Financial Line Normalization).** Primeiro módulo de normalização de linhas financeiras já classificadas — reduz variações de nomenclatura, formatação e representação antes de o documento entrar no Pipeline, sem alterar nenhum significado financeiro.

## Responsabilidade

`FinancialLineNormalizer`/`DefaultFinancialLineNormalizer` recebem um `RawFinancialDocument` já classificado (`FinancialLineClassifier`, Mission 046) e devolvem um `RawFinancialDocument` — mesmo contrato oficial do Data Engine (`efos/engines/data/data.types.ts`), nenhum tipo novo:

```
RawFinancialDocument (já classificado por FinancialLineClassifier)
        ↓
para cada linha: limpar label, remover símbolo monetário redundante,
                 padronizar currency/date/amount já detectados
        ↓
RawFinancialDocument (linhas normalizadas)
```

**Estritamente formatação/representação — nunca classificação.** `FinancialLineClassifier` (Mission 046) continua sendo a única camada que decide `kindHint`/`resourceTypeHint`/`eventTypeHint`/`amount`/`currency`/`date` a partir do texto bruto; `DefaultFinancialLineNormalizer` nunca infere um campo que o Classifier deixou ausente, nunca reclassifica, nunca usa heurística de classificação. Sem IA, sem LLM, sem embeddings.

## Regras de normalização implementadas

- **Espaços em branco** — `label.trim()` + colapso de espaços internos consecutivos em um único espaço (`/\s+/g` → `" "`).
- **Unicode** — `label.normalize("NFC")`: garante forma canônica composta (ex.: um "é" representado como `e` + acento combinante vira um único codepoint precomposto). Nunca remove acento nem altera qualquer letra — apenas a *representação* Unicode do mesmo caractere, nunca o caractere em si.
- **Símbolo monetário redundante** — quando `currency` já foi detectado pelo Classifier, os símbolos (`R$`, `US$`, `$`, `€`) são removidos de `label` (o valor numérico continua no texto, só o símbolo — agora redundante com o campo estruturado — é removido).
- **`currency`** — sempre maiúsculo (`toUpperCase()`); defensivo, já que o Classifier só produz códigos ISO em maiúsculas (`BRL`/`USD`/`EUR`).
- **`date`** — re-emitida com mês/dia sempre com dois dígitos a partir do formato ISO já produzido pelo Classifier; defensivo/idempotente na prática, garante a forma canônica final independentemente de qual componente produziu a data.
- **`amount`** — arredondado para no máximo duas casas decimais (`Math.round(amount * 100) / 100`) — elimina ruído de ponto flutuante binário (ex.: `4200.000000000001`); o padrão de valor do Classifier já só captura até duas casas, então isso é defensivo/idempotente na prática, nunca muda o valor de fato representado na linha.

## O que NÃO foi feito (deliberadamente)

- **Caixa alta/baixa do texto de `label`** — o objetivo da missão cita "caixa alta/baixa quando apropriado" como exemplo de normalização, mas decidir quando transformar a caixa de um texto livre (ex.: converter tudo-maiúsculo para uma capitalização "normal") exigiria uma heurística de linguagem — sem uma regra determinística e inequívoca, isso arriscaria alterar a legibilidade/forma de siglas (`CNPJ`, `NF-e`) sem nenhum ganho real de significado. Aplicado apenas onde é seguro e determinístico: `currency` (código ISO, sempre maiúsculo).
- **Remoção de acentos** — normalizar a *representação* Unicode (NFC) não é o mesmo que remover acentos; isso mudaria palavras reais (`Contratação` → `Contratacao`) sem necessidade, então não foi feito.
- **Qualquer inferência de dado ausente** — se o Classifier não detectou `amount`/`currency`/`date`/`kindHint`/`resourceTypeHint`/`eventTypeHint`, o Normalizer nunca preenche esses campos; permanecem ausentes.

## Integração com o Upload API

`app/api/efos/upload/route.ts` (Mission 042–046) passou a chamar `new DefaultFinancialLineNormalizer().normalize(document)` para cada `RawFinancialDocument` já classificado por `DefaultFinancialLineClassifier` (Mission 046), antes de `DocumentIntake.prepareDocuments()`. Fluxo completo: `PDF → PdfParser → FinancialLineClassifier → FinancialLineNormalizer → DocumentIntake → EFOSPlatform`.

## Dependências permitidas

- `efos/engines/data` (`RawFinancialDocument`, `RawFinancialLine`) — apenas por tipo, contrato oficial do Data Engine.

## Dependências proibidas

- **Domain/Engines/Runtime/Pipeline/Application/Infrastructure/Bootstrap/Platform (o restante de `efos/platform/`)/Persistence/Repository concretos** — `DefaultFinancialLineNormalizer` é uma peça isolada, autocontida, que só transforma `RawFinancialDocument` em `RawFinancialDocument`.
- **IA, LLM, embeddings** — nenhuma chamada a um serviço de IA existe aqui.
- **Heurística de classificação** — este módulo nunca decide `kindHint`/`resourceTypeHint`/`eventTypeHint`/`amount`/`currency`/`date` quando ausentes; isso é exclusividade de `FinancialLineClassifier`.
