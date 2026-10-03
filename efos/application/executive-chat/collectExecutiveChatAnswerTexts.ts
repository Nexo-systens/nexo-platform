import type { ExecutiveOutputText } from "@/efos/application/executive-output-policy";

import type { ExecutiveChatAnswer } from "./ExecutiveChatAnswer.types";

/**
 * Mission 206 (D-132) — todo texto de um `ExecutiveChatAnswer` exibido ao
 * executivo, inclusive o motivo das ações propostas, para a governança de
 * saída. Enums, ids, `basis` e parâmetros numéricos estruturados ficam
 * de fora.
 */
export function collectExecutiveChatAnswerTexts(answer: ExecutiveChatAnswer): readonly ExecutiveOutputText[] {
  const texts: ExecutiveOutputText[] = [{ path: "answer", text: answer.answer }];
  answer.factualClaims.forEach((item, index) => texts.push({ path: `factualClaims[${index}].statement`, text: item.statement }));
  answer.analysis.forEach((item, index) => texts.push({ path: `analysis[${index}].statement`, text: item.statement }));
  answer.hypotheses.forEach((item, index) => {
    texts.push({ path: `hypotheses[${index}].statement`, text: item.statement });
    texts.push({ path: `hypotheses[${index}].validationNeeded`, text: item.validationNeeded });
  });
  answer.limitations.forEach((item, index) => {
    texts.push({ path: `limitations[${index}].statement`, text: item.statement });
    texts.push({ path: `limitations[${index}].reason`, text: item.reason });
  });
  (answer.proposedActions ?? []).forEach((action, index) => texts.push({ path: `proposedActions[${index}].reason`, text: action.reason }));
  return texts;
}
