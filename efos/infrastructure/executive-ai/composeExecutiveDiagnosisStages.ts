/**
 * Mission 136 — Etapa 3: compõe as saídas (já decodificadas para a
 * forma de domínio, D-059) dos 2 stages de geração num único objeto
 * bruto de 9 campos, exatamente o mesmo shape que a Mission
 * 118-135 sempre produziram numa única resposta. Função pura,
 * estrutural, **nunca valida conteúdo** — nunca decide se o
 * resultado é um `ExecutiveDiagnosis` aceitável; essa decisão
 * continua exclusiva de `looksLikeExecutiveDiagnosis()` +
 * `validateExecutiveDiagnosis()` (D-059/D-060, chamadas por
 * `executeExecutiveAnalysis()`, nunca duplicadas aqui).
 *
 * Se um stage devolveu um campo ausente/malformado, essa ausência
 * simplesmente se propaga para o objeto composto — o mesmo mecanismo
 * de checagem estrutural que já existia para uma única resposta
 * continua sendo a única linha de defesa contra isso, sem nenhuma
 * lógica nova duplicada aqui (Etapa 4 — composição inválida nunca vira
 * diagnóstico, porque o composto malformado é rejeitado do mesmo jeito
 * que uma resposta única malformada sempre foi).
 */
export function composeExecutiveDiagnosisStages(
  coreOutput: Record<string, unknown>,
  interpretationOutput: Record<string, unknown>
): Record<string, unknown> {
  return {
    executiveSummary: coreOutput.executiveSummary,
    interpretations: coreOutput.interpretations,
    risks: coreOutput.risks,
    priorities: coreOutput.priorities,
    possibleActions: coreOutput.possibleActions,
    hypotheses: interpretationOutput.hypotheses,
    questions: interpretationOutput.questions,
    uncertainties: interpretationOutput.uncertainties,
    conflictInterpretations: interpretationOutput.conflictInterpretations,
  };
}
