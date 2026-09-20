# Executive Diagnosis Contract (Mission 115)

## Objetivo

Contrato canônico de **saída** de uma futura Executive AI — consome um
`ExecutiveFinancialContext` (`efos/application/executive-context/`, D-058) e
produz exclusivamente interpretação estruturada, nunca fato financeiro,
nunca decisão, nunca execução.

```
ExecutiveFinancialContext (FACT/DERIVED FACT)
        ↓
ExecutiveDiagnosis (INTERPRETATION/HYPOTHESIS/RISK/PRIORITY/
                     POSSIBLE ACTION/QUESTION/UNCERTAINTY/
                     CONFLICT INTERPRETATION)
        ↓
Human Judgment → Decision → Execution → Outcome → Learning
```

## Por que um tipo novo, não reaproveitar `Recommendation`/`Decision`?

Auditado explicitamente (Mission 115, Etapa 4): `Recommendation`/`Decision`
(Domain) são sempre **determinísticos** (D-010/D-011 — 3 templates fixos,
prioridade derivada de regra, nunca confiança probabilística). Reutilizá-los
para saída de IA confundiria propostas fact-based com interpretação
generativa — exatamente a mistura que a missão proíbe. `Outcome` exige uma
Decision já existente (`decisionId` obrigatório) — estruturalmente
impossível de produzir antes do julgamento humano. `LearningRecord` observa
o que já foi decidido, nunca gera interpretação nova. Nenhum tipo existente
cumpre essa responsabilidade — `ExecutiveDiagnosis` é o primeiro do seu tipo.

## O que este módulo NÃO faz

- Não integra nenhuma IA/LLM (nenhuma chamada a OpenAI/Claude, nenhum prompt
  de produção, nenhum endpoint, nenhum chat).
- Não constrói um diagnóstico a partir de um `ExecutiveFinancialContext`
  real — isso exigiria simular a própria interpretação da IA, fora do
  escopo desta missão. Este módulo define apenas o **contrato** que uma
  futura implementação (real, com IA) deverá obedecer, e o **validator**
  que garante que qualquer diagnóstico (de qualquer origem) respeita as
  fronteiras arquiteturais.
- Não altera nenhum Engine (`efos/engines/*`), nenhuma fórmula, nenhum
  Indicator/Evidence/Context/Reasoning/Recommendation/Decision existente.

## `ExecutiveDiagnosis.validator.ts`

`validateExecutiveDiagnosis()` rejeita, no mínimo: interpretação sem
`basis`; hipótese sem `validationNeeded`; prioridade sem `reason`; ação
possível fora do vocabulário fechado (`POSSIBLE_ACTION`/`OPTION`/
`INVESTIGATE`/`CONSIDER`/`VALIDATE`); qualquer campo de autoridade proibida
(`decision`/`outcome`/`execution`/`financialTruth` etc.) presente no objeto.

Ver `docs/DECISIONS.md`, D-059, e `docs/ENGINEERING_LOG.md`, Mission 115,
para a auditoria completa e os 12 cenários testados.
