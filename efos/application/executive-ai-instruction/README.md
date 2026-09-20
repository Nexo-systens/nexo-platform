# Executive AI Prompt Contract (Mission 117)

## Objetivo

Transforma um `ExecutiveFinancialContext` (D-058) numa instrução
estruturada e canônica (`ExecutiveAIInstruction`) para um
`ExecutiveAIProvider` (D-060) — nunca uma mega string de prompt textual,
nunca uma nova fonte de verdade.

```
Financial Truth
        ↓
ExecutiveFinancialContext
        ↓
ExecutiveAIInstruction   (este módulo)
        ↓
ExecutiveAIProvider
        ↓
Untrusted AI Output
        ↓
ExecutiveDiagnosis Validation
        ↓
ExecutiveDiagnosis
```

## Princípio central

```
Financial Truth ≠ Prompt ≠ AI Interpretation
```

O prompt (`ExecutiveAIInstruction`) é uma **representação controlada** do
contexto — nunca o transforma. `buildExecutiveAIInstruction()` nunca lê
`context.financialTruth`/`unknowns`/`conflicts` individualmente; atribui o
`context` inteiro por referência direta, sem arredondar, recalcular, ou
remover nada.

## Por que não uma string de prompt gigante?

Proibido explicitamente pela missão: misturar contrato, instrução,
serialização e texto humano de fornecedor específico num único template
literal (`` `You are a CFO... ${JSON.stringify(context)}` ``) acopla o EFOS
Core à forma que um provider específico exige. `ExecutiveAIInstruction` é
uma estrutura tipada; uma futura camada de provider (Infrastructure Layer,
fora do escopo desta missão) é responsável por serializá-la para o que seu
SDK precisar.

## Autoridade estrutural, não apenas documental

`ExecutiveAIAuthority` (`may*`/`mustNot*`, todos literais `true`) e
`ExecutiveAIOutputContract` (`expectedShape: "ExecutiveDiagnosis"`) tornam
os limites da IA parte do próprio dado — `validateExecutiveAIInstruction()`
rejeita qualquer instrução que não afirme exatamente esses limites, ou que
omita algum dos 8 `constraints` obrigatórios.

## Integração com Mission 116 (D-060)

`ExecutiveAIRequest` (`efos/application/executive-ai/`) passou a carregar
`instruction: ExecutiveAIInstruction` em vez de `context` diretamente — a
instrução é a unidade canônica entregue ao provider, nunca duas fontes
paralelas (`context` + `instruction`) simultaneamente.
`executeExecutiveAnalysis()` agora constrói e valida a instrução antes de
chamar o provider.

## O que este módulo NÃO faz

- Não chama nenhuma IA/provider (isso é `executeExecutiveAnalysis()`,
  `efos/application/executive-ai/`).
- Não faz nenhuma chamada de rede/banco/Supabase/UI.
- Não gera `instructionId` internamente — recebido como parâmetro, para
  manter o builder puro e determinístico.

Ver `docs/DECISIONS.md`, D-061, e `docs/ENGINEERING_LOG.md`, Mission 117,
para a auditoria completa e os 18 cenários testados.
