import type { ExecutiveDiagnosis } from "@/efos/application/executive-diagnosis";
import type { ExecutiveOutputText } from "@/efos/application/executive-output-policy";

/**
 * Mission 206 (D-132) — todo texto de um `ExecutiveDiagnosis` que chega ao
 * usuário, com o caminho do campo, para a governança de saída. Enums,
 * ids e `basis` ficam de fora (não são texto destinado ao usuário).
 */
export function collectExecutiveDiagnosisTexts(diagnosis: ExecutiveDiagnosis): readonly ExecutiveOutputText[] {
  const texts: ExecutiveOutputText[] = [{ path: "executiveSummary.statement", text: diagnosis.executiveSummary.statement }];
  diagnosis.interpretations.forEach((item, index) => texts.push({ path: `interpretations[${index}].statement`, text: item.statement }));
  diagnosis.hypotheses.forEach((item, index) => {
    texts.push({ path: `hypotheses[${index}].statement`, text: item.statement });
    texts.push({ path: `hypotheses[${index}].validationNeeded`, text: item.validationNeeded });
  });
  diagnosis.risks.forEach((item, index) => texts.push({ path: `risks[${index}].statement`, text: item.statement }));
  diagnosis.priorities.forEach((item, index) => {
    texts.push({ path: `priorities[${index}].statement`, text: item.statement });
    texts.push({ path: `priorities[${index}].reason`, text: item.reason });
  });
  diagnosis.possibleActions.forEach((item, index) => texts.push({ path: `possibleActions[${index}].statement`, text: item.statement }));
  diagnosis.questions.forEach((item, index) => texts.push({ path: `questions[${index}].question`, text: item.question }));
  diagnosis.uncertainties.forEach((item, index) => {
    texts.push({ path: `uncertainties[${index}].statement`, text: item.statement });
    texts.push({ path: `uncertainties[${index}].reason`, text: item.reason });
  });
  diagnosis.conflictInterpretations.forEach((item, index) =>
    texts.push({ path: `conflictInterpretations[${index}].statement`, text: item.statement })
  );
  return texts;
}
