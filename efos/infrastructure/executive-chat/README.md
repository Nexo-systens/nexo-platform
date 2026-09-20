# Infrastructure — Executive Chat (Mission 188/189)

Primeira implementação real de `ExecutiveChatProvider`
(`efos/application/executive-chat/`) — adaptador de infraestrutura para a
Anthropic Messages API (`@anthropic-ai/sdk`), mesmo precedente estrutural de
`AnthropicExecutiveAIProvider` (Mission 118/136, D-062/D-068).

## Reaproveitado sem cópia de `efos/infrastructure/executive-ai/`

- `AnthropicMessagesClient` — superfície mínima do SDK, injeção de client para
  teste.
- `mapAnthropicErrorToExecutiveAIError()` — tradução de exceção do SDK para
  `ExecutiveAIError`, inteiramente genérica (nunca soube nada sobre Diagnosis).
- `decodeBasisReferences()` — decodificador do formato de transporte compacto
  de `basis` (Mission 135, D-068); `decodeChatAnswerBasisFields.ts` apenas
  aplica esse decodificador aos nomes de campo de Chat (`factualClaims`/
  `analysis`/`hypotheses`), nunca duplica a lógica de decodificação em si.

## Diferença deliberada: uma única chamada `strict`, nunca 2 stages

O schema de `ExecutiveChatAnswer` (4 arrays de itens simples) é
significativamente menor que o de `ExecutiveDiagnosis` (que exigiu divisão em 2
chamadas na Mission 136 por exceder o limite de "compiled grammar" da
Anthropic) — uma única chamada `strict` é suficiente e mais simples (REGRA 15).

## `DEFAULT_MAX_TOKENS = 8000`

Menor que o de Diagnosis (32000) — uma resposta de chat é conversacional, nunca
um diagnóstico executivo completo sobre 9 categorias. Valor inicial honesto
(Seção 29 da Mission 188), não uma medição de produção.

## Resolução de `proposedActions` (Mission 189, D-104)

`AnthropicExecutiveChatProvider` resolve o array BRUTO/untrusted de propostas de
ação (`RawExecutiveChatActionProposal[]`, formato plano do tool schema) para a
forma confiável (`ExecutiveChatResolvedAction[]`) via
`resolveExecutiveChatActionProposals()` (`efos/application/executive-chat/`) — no
MESMO ponto e pela MESMA razão que `decodeModelChatAnswerBasisFields()` já
decodifica `basis`, nunca um segundo lugar de decodificação. Propostas
estruturalmente inválidas nunca chegam a `ExecutiveAIResponse.output` — descartadas
silenciosamente antes mesmo de `executeExecutiveChatAnalysis()`/
`validateExecutiveChatAnswer()` (Application Layer) verem qualquer coisa.

## O que este módulo NÃO faz

- Não cria um segundo client/SDK de IA — reaproveita `@anthropic-ai/sdk`
  exatamente como `executive-ai/` já faz.
- Não expõe API key ao browser — `ANTHROPIC_API_KEY` só é lida server-side
  (`process.env`), nunca repassada ao client.
- Não implementa streaming — mesma escolha de simplicidade de
  `AnthropicExecutiveAIProvider` (não-streaming, tool forçada).
