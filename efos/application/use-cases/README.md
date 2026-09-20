# Application Layer — Use Cases

Status: **esqueleto, sem implementação.** Cada Use Case tem responsabilidade única, depende apenas de Services (`efos/application/services`) — nunca conhece Engines (`efos/engines/*`) nem infraestrutura diretamente.

## Conteúdo

| Use Case | Responsabilidade | Depende de | DTO |
|---|---|---|---|
| `AnalyzeCompanyUseCase.ts` | Analisar uma empresa. | `AnalysisService` | `AnalyzeCompanyRequest`/`Response` |
| `GenerateExecutiveReportUseCase.ts` | Gerar relatório executivo de uma empresa. | `ReportService` | `GenerateReportRequest`/`Response` |
| `RunFinancialDiagnosisUseCase.ts` | Executar diagnóstico financeiro de uma empresa. | `AnalysisService` | Nenhum DTO nomeado ainda (`unknown`) — ver comentário no arquivo |

Todos são `UseCase<TRequest, TResponse>` (`efos/application/contracts/UseCase.ts`) especializados como `type`, não `interface extends {}` vazia — evita interfaces sem membros próprios.

## Dependências permitidas

- `efos/application/contracts` (contrato base `UseCase`).
- `efos/application/dto` (Request/Response).
- `efos/application/services` (quando implementados de verdade — nesta missão, apenas o tipo é referenciado nos comentários, nenhuma dependência de runtime existe ainda).

## Dependências proibidas

- **Engines** (`efos/engines/*`) — nenhum Use Case chama `Engine.execute()`.
- **Infraestrutura** (Supabase, banco, Next.js, HTTP) — um Use Case nunca depende de nada além de Services.
