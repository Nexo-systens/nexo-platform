# Application Layer — Document Intake

Status: **implementado (Mission 026 — Document Intake Layer).** Camada oficial responsável por receber os documentos enviados pela Plataforma antes da execução do EFOS. Não faz upload, não salva arquivos — apenas normaliza e valida a entrada estrutural dos documentos que serão enviados ao Data Engine.

## Responsabilidade

Converter uma coleção de documentos externos em uma coleção oficial de `RawFinancialDocument` (`efos/engines/data/data.types.ts`, contrato oficial já definido pelo Data Engine como produtor, D-002) — nenhuma regra financeira, nenhum parsing contábil, nenhum OCR, nenhuma IA.

## Contrato

`DocumentIntake` (`DocumentIntake.ts`) tem um único método:

```ts
prepareDocuments(
  documents: readonly RawFinancialDocument[]
): readonly RawFinancialDocument[]
```

## `DefaultDocumentIntake`

Primeira implementação concreta:

1. Coleção vazia é um caso válido, nunca um erro — devolve `[]`.
2. Entradas nulas/indefinidas são descartadas.
3. Duplicatas por `documentId` são descartadas — primeira ocorrência vence.
4. A ordem original dos documentos remanescentes é preservada.
5. A coleção retornada é sempre uma cópia nova (`readonly`), nunca o array de entrada — sem referência compartilhada.

Nenhum `RawFinancialDocument` individual é modificado — cada documento mantido na saída é exatamente a mesma referência recebida na entrada; nenhum documento novo é sintetizado.

## Integração — fluxo oficial

```
AnalysisService.analyze(request, documents?)
        ↓
DocumentIntake.prepareDocuments(documents)
        ↓
PipelineContext.metadata.documents  (D-016)
        ↓
EFOSPipelineOrchestrator.execute(context)
        ↓
EFOSPipelineRuntime → Data Engine
```

`DefaultAnalysisService` (`efos/application/services/DefaultAnalysisService.ts`, Mission 021, revisado na Mission 026) recebe `DocumentIntake` via construtor, ao lado de `EFOSPipelineOrchestrator` — inversão de dependência, nunca instanciando `DefaultDocumentIntake` internamente. `analyze()` ganhou um segundo parâmetro opcional, `documents: readonly RawFinancialDocument[] = []` — não um DTO novo, apenas um parâmetro adicional tipado com o contrato oficial já existente do Data Engine. Antes de montar `PipelineContext`, `analyze()` passa `documents` por `this.documentIntake.prepareDocuments(documents)` e usa o resultado para preencher `context.metadata.documents` — nenhum outro componente prepara documentos: `EFOSPipelineRuntime` continua apenas lendo `context.metadata.documents` (`extractRawDocuments`, sem nenhuma lógica de limpeza própria, D-016), e o Data Engine continua recebendo `RawFinancialDocument[]` já prontos.

`DefaultEFOSContainer` (`efos/application/composition/DefaultEFOSContainer.ts`, Mission 024) é quem instancia `DefaultDocumentIntake` e o injeta em `DefaultAnalysisService` — mesma regra de exclusividade de `new` já estabelecida por D-021, agora estendida a este novo componente.

## Dependências permitidas

- `@/efos/engines/data` (`RawFinancialDocument`) — apenas por tipo, o contrato oficial já produzido pelo Data Engine.

## Dependências proibidas

- **Upload/Storage/Banco/Supabase** — esta camada nunca persiste nem transfere arquivo.
- **OCR/PDF Parser/Excel Parser/IA** — nenhuma extração de conteúdo binário; assume que os `RawFinancialDocument` recebidos já estão estruturados (mesma premissa do Data Engine, `efos/engines/data/README.md`, "Limitações").
- **Engine/Aggregate/DTO/Domain** — nenhuma dependência de `efos/engines/*` (além do tipo `RawFinancialDocument`), `efos/domain`, ou criação de DTO/Aggregate novo.
- **HTTP/API** — esta camada não sabe que existe uma rota ou requisição HTTP.
