# Application Layer — Ports

Status: **esqueleto, sem implementação.** Interfaces (padrão *ports & adapters*) que a Application Layer define e a Infrastructure implementa. Todo Port é um contrato puro — nenhum método tem corpo, nenhuma lógica de negócio.

## Conteúdo

| Port | Responsabilidade |
|---|---|
| `CompanyRepository.ts` | Leitura de `Company` (`efos/domain`) por id. |
| `AnalysisRepository.ts` | Persistência/leitura de uma análise (payload `unknown` — forma ainda não definida). |
| `DocumentRepository.ts` | Leitura de documentos financeiros brutos por id/empresa (payload `unknown` — forma ainda não definida). |
| `ReportRepository.ts` | Persistência/leitura de um relatório executivo (payload `unknown` — forma ainda não definida). |
| `StorageProvider.ts` | Upload/download de arquivo bruto. |
| `Clock.ts` | Abstração de tempo (`now()`), para Use Cases/Services determinísticos e testáveis. |
| `Logger.ts` | Log estruturado (`info`/`warn`/`error`). |
| `UuidGenerator.ts` | Geração de identificador único para a Application Layer — não substitui os IDs determinísticos dos Engines (D-001). |

## Por que `unknown` em vez de um tipo concreto

`AnalysisRepository`, `DocumentRepository` e `ReportRepository` usam `unknown` para os payloads porque a forma real de "análise", "documento" e "relatório" na Application Layer ainda não foi decidida por nenhuma missão — inventar um formato agora seria regra de negócio implícita, proibida nesta missão (REGRA 16, `docs/PROJECT_RULES.md`: nenhum componente deve ser desenvolvido "para o futuro" além do necessário). Uma missão futura que definir esses formatos deve especializar o tipo aqui, não inventá-lo em outro lugar.

## Dependências

`CompanyRepository` importa `Company` de `@/efos/domain` (única exceção — é uma entidade já modelada e estável). Os demais Ports não dependem de `efos/domain`, `efos/engines` nem de infraestrutura alguma — são contratos que a Infrastructure (fora do EFOS Core) implementará no futuro.
