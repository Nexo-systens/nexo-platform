# Application Layer — DTOs

Status: **esqueleto, sem implementação.** Objetos de transferência de dados que atravessam a fronteira da Application Layer — nunca reutilizam entidades do domínio (`efos/domain`) diretamente, e são sempre imutáveis (`readonly`).

## Conteúdo

- **`AnalyzeCompany.dto.ts`** — `AnalyzeCompanyRequest`/`AnalyzeCompanyResponse`, contrato de entrada/saída do `AnalyzeCompanyUseCase`.
- **`GenerateReport.dto.ts`** — `GenerateReportRequest`/`GenerateReportResponse`, contrato de entrada/saída do `GenerateExecutiveReportUseCase`.

Agrupados por caso de uso (Request+Response no mesmo arquivo), mesmo padrão de `<engine>.types.ts` nos Engines do EFOS Core (`EngineInput`+`EngineOutput` juntos).

## Por que nunca reutilizar entidades do domínio

Um DTO representa a forma de dado na fronteira da Application Layer — pode e deve divergir de como o domínio (`efos/domain`) modela a mesma informação internamente. Acoplar um DTO a uma entidade de domínio quebraria essa fronteira: qualquer mudança futura em `efos/domain` vazaria diretamente para quem consome a Application Layer (ex.: uma futura API HTTP), o oposto do que Clean Architecture exige.

## Por que os `Response` são placeholders mínimos

`AnalyzeCompanyResponse`/`GenerateReportResponse` hoje têm apenas `companyId` — mesmo princípio dos esqueletos originais de Engine (Mission 002, `{ companyId: string }`). O formato real de cada resposta (o que uma análise ou um relatório de fato contém) será definido quando `AnalysisService`/`ReportService` forem implementados de verdade — inventar esse formato agora seria regra de negócio implícita, fora do escopo desta missão.

**`AnalyzeCompanyResponse` permanece o mesmo placeholder mesmo após `DefaultAnalysisService` (Mission 021 — Analysis Service).** A Mission 021 implementou `AnalysisService` de verdade — primeiro consumidor real do `EFOSPipelineOrchestrator` — mas instruiu explicitamente reutilizar apenas os DTOs já oficiais desta missão, sem criar nem alterar nenhum. `PipelineResult` (Mission 020B) já carrega o estado completo de uma execução (`PipelineExecution`, com os 10 Aggregates produzidos); decidir o que desse estado deveria aparecer em `AnalyzeCompanyResponse` é uma decisão de forma de resposta, deliberadamente adiada — não decidida silenciosamente pela Mission 021.

## Dependências

Nenhuma dependência de `efos/domain`, `efos/engines`, `efos/interfaces` ou infraestrutura.
