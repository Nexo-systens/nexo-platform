# EFOS Platform — Parsers

Status: **implementado (Mission 045 — PDF Text Extraction; estendido na Mission 083 — EFOS Multi-Format Financial Document Intake).** Primeira extração real de documentos financeiros da plataforma EFOS — antes da Mission 045, `RawFinancialDocument.lines` era sempre `[]` (Mission 042, D-030); agora PDF e CSV produzem linhas de texto reais.

## Matriz de formatos (Mission 083)

| Formato | Upload (NEXO) | Processing (EFOS) | Status |
|---|---|---|---|
| PDF | ✓ | ✓ (`DefaultPdfParser`, Mission 045) | Oficial |
| CSV | ✓ | ✓ (`DefaultCsvParser`, Mission 083) | Oficial |
| XLSX | ✓ | ✗ | Upload supported / EFOS processing unsupported |
| XLS | ✓ | ✗ | Upload supported / EFOS processing unsupported |
| DOCX | ✓ | ✗ | Upload supported / EFOS processing unsupported |
| DOC | ✓ | ✗ | Upload supported / EFOS processing unsupported |
| PNG | ✓ | ✗ (sem OCR) | Upload supported / EFOS processing unsupported |
| JPG | ✓ | ✗ (sem OCR) | Upload supported / EFOS processing unsupported |
| JPEG | ✓ | ✗ (sem OCR) | Upload supported / EFOS processing unsupported |

"Upload supported / EFOS processing unsupported" significa exatamente isso: a NEXO aceita e armazena o arquivo (`modules/documents`, Storage), mas `app/api/efos/analyze/[companyId]` nunca o inclui na análise — nenhum parser existe para transformá-lo em `RawFinancialLine[]`. Não é um bug; é o estado real da capacidade técnica, documentado explicitamente em vez de assumido. Ver `docs/ENGINEERING_LOG.md`, Mission 083, para as 12 auditorias completas (por que XLSX/DOC/imagem não foram implementados nesta missão).

## Responsabilidade

`PdfParser`/`DefaultPdfParser` recebem um `File` (PDF) e o `companyId` já conhecido pelo chamador, e devolvem um `RawFinancialDocument` — contrato oficial do Data Engine (`efos/engines/data/data.types.ts`, `{ documentId, companyId, source, lines }`), nenhum tipo novo:

```
File (PDF)
        ↓
extrair texto (pdf-parse / PDFParse.getText())
        ↓
dividir em linhas (`\n`), remover linhas vazias, preservar ordem
        ↓
RawFinancialDocument { documentId, companyId, source: file.name, lines }
```

Cada linha de texto vira um `RawFinancialLine` só com `label` preenchido (`{ label }`) — nenhuma classificação de valor/data/`kindHint`/`resourceTypeHint`/`eventTypeHint` acontece aqui; interpretar o significado de cada linha (é uma receita? uma despesa? qual valor?) pertence a uma futura etapa, não a este parser, que é estritamente extração/estruturação de texto.

## Biblioteca utilizada

[`pdf-parse`](https://www.npmjs.com/package/pdf-parse) (v2, TypeScript nativo, construído sobre `pdfjs-dist` — a mesma engine de renderização de PDF do Firefox) — biblioteca estável, com mais de um milhão de downloads semanais na v1 e tipos TypeScript nativos na v2. `DefaultPdfParser` usa apenas `PDFParse.getText()`, a extração de texto mais simples e direta oferecida pela biblioteca — nenhum recurso de imagem/tabela/screenshot é usado.

## `DefaultPdfParser`

1. Lê o `File` como `ArrayBuffer` (`file.arrayBuffer()`).
2. `new PDFParse({ data: arrayBuffer })` — nunca lê do disco, nunca faz upload para um serviço externo; o parsing acontece inteiramente em memória/processo.
3. `await parser.getText()` extrai `result.text` — o texto de todas as páginas do PDF, concatenado.
4. `result.text.split("\n")`, `.trim()` cada linha, remove linhas vazias (`length === 0`), preserva a ordem original.
5. Monta `RawFinancialDocument`: `documentId` via `node:crypto` `randomUUID()` (mesmo padrão de `app/api/efos/upload/route.ts`, Mission 042), `companyId` recebido do chamador, `source: file.name`, `lines` como acima.
6. `parser.destroy()` sempre é chamado (em `finally`), liberando os recursos internos do `pdfjs-dist`.

## `DefaultCsvParser` (Mission 083)

Segundo parser real da plataforma — mesmo contrato (`{ documentId, companyId, source, lines }`), nenhuma biblioteca nova (`File.text()`, já parte da Web File API usada em todo o runtime):

```
File (CSV)
        ↓
ler como texto (file.text())
        ↓
dividir em linhas (`\n`), remover linhas vazias, preservar ordem
        ↓
RawFinancialDocument { documentId, companyId, source: file.name, lines }
```

Cada linha do CSV (com seus delimitadores originais preservados, `,`/`;`) vira um `RawFinancialLine { label }`, exatamente como uma linha extraída de PDF — o Classifier (`DefaultFinancialLineClassifier`, Mission 046) processa a linha inteira via regex, sem se importar se ela veio de um PDF ou de uma linha de CSV; nenhuma interpretação de coluna (não separa por `,`/`;`, não trata cabeçalho de forma especial) é feita aqui. `documentId` via `node:crypto` `randomUUID()`, mesmo padrão de `DefaultPdfParser`.

## Limitações

- **Somente PDF com texto extraível** — um PDF digitalizado/escaneado (imagem sem camada de texto) produz `lines: []` ou texto vazio; nenhum OCR é implementado.
- **Somente CSV como texto puro** — nenhuma interpretação de coluna/cabeçalho/delimitador; a linha inteira vira `label`, deixando a extração de `amount`/`date`/`currency` inteiramente para o Classifier (mesma etapa que já processa PDF).
- **Sem Excel (XLSX/XLS), Word (DOC/DOCX) ou imagem (PNG/JPG/JPEG)** — nenhum parser existe para esses formatos (Mission 083 — Auditorias 6/7/8): XLSX/XLS/DOCX/DOC exigiriam uma biblioteca nova, não instalada hoje (`package.json` só tem `pdf-parse`), decisão de dependência deliberadamente não tomada nesta missão; imagem exigiria OCR, capacidade ainda mais complexa, também não implementada. Ver a matriz de formatos acima e `docs/ENGINEERING_LOG.md`, Mission 083.
- **Sem interpretação financeira** — cada `RawFinancialLine` só tem `label` (o texto bruto da linha); nenhum valor, data ou tipo é inferido aqui, em nenhum parser.
- **Arquivo corrompido/inválido lança exceção** — `PDFParse.getText()`/`file.text()` rejeitam a `Promise`; nenhum parser captura esse erro (sem `try/catch`, sem fallback), propagando-o ao chamador, mesmo padrão de tratamento de erro já usado em toda a Application/Platform Layer nesta sessão (ex.: `SupabaseExecutionRepository.save()`, Mission 033).

## Integração com as rotas HTTP

`app/api/efos/_shared/prepareFinancialDocuments.ts` (Mission 082, estendida na Mission 083) seleciona o parser correto por extensão de arquivo (`.pdf` → `DefaultPdfParser`, `.csv` → `DefaultCsvParser`) antes de transformar cada `File` num `RawFinancialDocument` — usada tanto por `app/api/efos/upload/route.ts` (arquivos recebidos diretamente no corpo da requisição) quanto por `app/api/efos/analyze/[companyId]/route.ts` (arquivos já armazenados via `modules/documents`, Mission 082). O restante do fluxo não muda: `DocumentIntake.prepareDocuments()` (D-030) continua preparando a coleção, e `EFOSPlatform.analyzeCompany(companyId, preparedDocuments)` (Mission 044, D-032) continua levando os documentos até o Data Engine — o mesmo pipeline canônico para qualquer formato.

## Dependências permitidas

- `efos/engines/data` (`RawFinancialDocument`, `RawFinancialLine`) — apenas por tipo, contrato oficial do Data Engine.
- `pdf-parse` — o SDK concreto de extração de PDF (`DefaultPdfParser`).
- `node:crypto` (`randomUUID`) — biblioteca padrão do runtime, mesmo espírito já usado em `DefaultAnalysisService`/`app/api/efos/upload/route.ts`.
- Web File API (`file.text()`/`file.arrayBuffer()`) — já parte do runtime, nenhuma biblioteca adicional para `DefaultCsvParser`.

## Dependências proibidas

- **Domain/Engines/Runtime/Pipeline/Application/Infrastructure/Bootstrap/Platform (o restante de `efos/platform/`)/Persistence/Repository concretos** — cada parser é uma peça isolada, autocontida, que só produz `RawFinancialDocument`; não conhece nenhuma dessas camadas.
- **OCR, processamento de imagem, Excel, Word** — nenhuma capacidade técnica real hoje (Mission 083); nenhuma biblioteca foi adicionada para eles.
- **Regra financeira** — nenhuma classificação/cálculo acontece em nenhum parser.
