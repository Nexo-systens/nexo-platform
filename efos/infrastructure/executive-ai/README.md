# Infrastructure — Executive AI

Status: **primeiro provider real de IA implementado (Mission 118 — Executive AI Provider Implementation, D-062).**

## Responsabilidade

Implementar `ExecutiveAIProvider` (`efos/application/executive-ai/ExecutiveAIProvider.ts`, Mission 116) contra um modelo de IA real — nunca definir contrato novo, nunca alterar `financialTruth`, nunca criar `Decision`/`Outcome`, nunca acessar Supabase/banco/UI/Document Storage.

## Conteúdo

### `AnthropicExecutiveAIProvider` (Mission 118)

Implementa `ExecutiveAIProvider` sobre a Anthropic Messages API (`@anthropic-ai/sdk`). Recebe uma `ExecutiveAIInstruction` (D-061) já validada por `executeExecutiveAnalysis()`, serializa (`serializeExecutiveAIInstruction`, cópia estrutural fiel, nunca reescrita campo a campo), monta o prompt de sistema a partir dos próprios campos da instrução (`buildExecutiveAISystemPrompt`, nunca texto duplicado divergente do contrato), força saída estruturada via tool use (`executiveDiagnosisToolSchema.ts`) e devolve `ExecutiveAIResponse` — `output: unknown`, **sempre untrusted**, mesmo tendo sido montado por este adapter.

**Campos que o modelo nunca produz**: `id`, `basedOn.generatedAt`, `boundaries` — são preocupação de infraestrutura/contrato fixo (D-059), nunca solicitados ao modelo; o adapter os injeta ele mesmo depois da chamada.

**Erros**: toda exceção do SDK é traduzida por `mapAnthropicErrorToExecutiveAIError()` para o vocabulário fechado `ExecutiveAIErrorCode` (D-060/D-061) antes de sair do adapter — nenhuma exceção crua do SDK, nenhum stack trace, nenhuma API key aparece em `ExecutiveAIError.message`.

**Configuração**: `ANTHROPIC_API_KEY` (`process.env`, nunca `NEXT_PUBLIC_`, nunca chega ao client) — se ausente, `analyze()` retorna um erro `PROVIDER_UNAVAILABLE` controlado, nunca lança a construção do provider nem expõe a ausência de outra forma.

## Dependências permitidas

- `efos/application/executive-ai` (`ExecutiveAIProvider`, `ExecutiveAIRequest`, `ExecutiveAIResponse`, `ExecutiveAIError`).
- `efos/application/executive-diagnosis` (`DIAGNOSIS_BOUNDARIES`, o único valor fixo reaproveitado do contrato de saída).
- `@anthropic-ai/sdk` (única dependência de IA de todo o projeto — confirmado por grep, nenhuma outra referência a SDK de IA em `efos/`).
- `node:crypto` (`randomUUID`, para `ExecutiveDiagnosis.id`).

## Dependências proibidas

- **Engines** (`efos/engines/*`) — nunca conhecidos aqui.
- **Domain diretamente** — só via os contratos de Application já citados.
- **Supabase/banco/UI/Document Storage** — nenhum importado, nenhum consumido.
- **Definição de contrato novo** — `ExecutiveAIInstruction`/`ExecutiveDiagnosis`/`ExecutiveAIProvider` já existem na Application Layer (D-061/D-059/D-060); este módulo só implementa.

## Substituibilidade

`AnthropicExecutiveAIProvider` é uma implementação entre outras possíveis de `ExecutiveAIProvider` — uma futura `OpenAIExecutiveAIProvider`/`LocalExecutiveAIProvider`/`MockExecutiveAIProvider` implementaria a mesma interface, sem alterar `ExecutiveFinancialContext`/`ExecutiveAIInstruction`/`ExecutiveDiagnosis`/`executeExecutiveAnalysis()` — nenhum desses contratos conhece "Anthropic"/"Claude" em nenhum campo/tipo.

## Fora de escopo (Mission 118)

Nenhuma rota HTTP/Server Action instancia este provider ainda — não integrado à UI, não persiste diagnóstico, não cria `Decision`/`Outcome`. Ver `docs/ENGINEERING_LOG.md`, Mission 118, para a auditoria completa.
