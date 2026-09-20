import type {
  RawFinancialDocument,
  RawFinancialLine,
} from "@/efos/engines/data";

import type { FinancialEventResolver } from "./FinancialEventResolver";

/**
 * Uma linha é resolvível como evento financeiro somente quando os
 * três sinais explicitamente exigidos pela missão já estão presentes,
 * sem nenhuma ambiguidade: `amount`, `eventTypeHint` e `date`. Esses
 * três, juntos, já satisfazem os únicos campos que o Data Engine
 * exige para um registro `kind="event"` (`eventType`/`occurredAt`,
 * `efos/engines/financial-model/financial-model.constants.ts`) — nada
 * é inventado, apenas confirmado.
 */
function isResolvableAsEvent(line: RawFinancialLine): boolean {
  return (
    line.amount !== undefined &&
    line.eventTypeHint !== undefined &&
    line.date !== undefined
  );
}

function resolveLine(line: RawFinancialLine): RawFinancialLine {
  if (!isResolvableAsEvent(line)) {
    // Campo obrigatório (amount/eventTypeHint/date) não presente —
    // não preencher, não assumir, não inferir. Linha devolvida
    // exatamente como recebida.
    return line;
  }

  // Consolidação: `amount`+`eventTypeHint`+`date` já certos tornam
  // este evento inequivocamente `kind="event"` — garante isso
  // explicitamente (mesmo padrão que `FinancialLineClassifier` já
  // aplica, Mission 046; esta é a camada final que certifica a
  // consistência antes do documento seguir para o Data Engine).
  // `resourceTypeHint`/`currency`/`amount` já detectados permanecem
  // exatamente como estão — nunca removidos, nunca alterados.
  return {
    ...line,
    kindHint: "event",
  };
}

/**
 * Primeira implementação concreta de `FinancialEventResolver`
 * (Mission 048 — Financial Event Resolution). Resolução puramente
 * consolidativa — nunca classifica, nunca formata, nunca usa
 * IA/LLM. `resolve()` nunca modifica `documentId`/`companyId`/
 * `source`, nem `label`/`currency`/`amount`/`date`/`resourceTypeHint`/
 * `eventTypeHint` de nenhuma linha — o único campo que pode mudar é
 * `kindHint`, e apenas para confirmar `"event"` quando os três sinais
 * exigidos (`amount`+`eventTypeHint`+`date`) já estão presentes.
 * Linhas sem essa combinação completa são devolvidas inalteradas —
 * nenhum campo obrigatório é preenchido por suposição.
 */
export class DefaultFinancialEventResolver implements FinancialEventResolver {
  resolve(document: RawFinancialDocument): RawFinancialDocument {
    return {
      ...document,
      lines: document.lines.map((line) => resolveLine(line)),
    };
  }
}
