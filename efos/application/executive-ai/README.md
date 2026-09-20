# Executive AI Provider Boundary (Mission 116)

## Objetivo

Fronteira arquitetural canônica entre o EFOS e qualquer futuro provedor de
IA — **nenhum provedor real é integrado por esta missão**.

```
ExecutiveFinancialContext (D-058)
        ↓
executeExecutiveAnalysis()
        ↓
ExecutiveAIProvider.analyze()
        ↓
ExecutiveAIResponse (UNTRUSTED, output: unknown)
        ↓
validateExecutiveDiagnosis() (D-059)
        ↓
ExecutiveDiagnosis (TRUSTED)
```

## Regra central

```
EFOS CORE depends on abstraction, NOT provider.
```

Nenhum arquivo em `efos/` (Domain/Engines/Application) importa Claude,
OpenAI, ou qualquer SDK de IA. Tudo depende exclusivamente de
`ExecutiveAIProvider` (interface). Uma implementação real
(`AnthropicExecutiveAIProvider`, `OpenAIExecutiveAIProvider` etc.) pertence
à Infrastructure Layer (`efos/infrastructure/`) — nenhuma foi criada por
esta missão.

## Trust Boundary

`ExecutiveAIResponse.output` é `unknown` por construção — **nunca** pode
ser lido como `ExecutiveDiagnosis` sem passar por `executeExecutiveAnalysis()`,
que sempre chama `validateExecutiveDiagnosis()` (D-059) antes de devolver um
diagnóstico confiável. `return aiResponse.output as ExecutiveDiagnosis` em
qualquer outro lugar do código é considerado um bug de arquitetura.

## O que este módulo NÃO faz

- Não integra nenhum SDK de IA (Anthropic, OpenAI, ou qualquer outro).
- Não faz nenhuma chamada de rede.
- Não cria API key, `.env`, streaming, chat, ou endpoint de IA.
- Não implementa nenhum provider de produção — apenas a interface. Fakes de
  teste (`FakeExecutiveAIProvider`, usados só em
  `test-mission116-executive-ai-provider-boundary.ts`) nunca são
  exportados por este módulo.
- Não dá ao provider acesso a Supabase, banco de dados, estado de UI/React,
  ou aos Engines do EFOS — `ExecutiveAIRequest` carrega exclusivamente um
  `ExecutiveFinancialContext` (já independente de todos esses concerns,
  D-058).

Ver `docs/DECISIONS.md`, D-060, e `docs/ENGINEERING_LOG.md`, Mission 116,
para a auditoria completa e os 15 cenários testados.
