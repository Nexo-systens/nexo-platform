import type {
  RawFinancialDocument,
  RawFinancialLine,
} from "@/efos/engines/data";

import type { FinancialKnowledgeBuilder } from "./FinancialKnowledgeBuilder";

/**
 * Mesma regra determinística já usada por `FinancialLineClassifier`
 * (Mission 046) e `FinancialEventResolver` (Mission 048) — nenhuma
 * heurística nova: uma linha com `eventTypeHint` já detectado é um
 * evento; uma linha só com `resourceTypeHint` já detectado é um
 * recurso; uma linha sem nenhum dos dois não tem `kindHint`
 * determinável. Reaplicada aqui para consolidar/certificar o campo já
 * classificado, nunca para descobrir uma classificação nova.
 */
function deriveKindHint(
  line: RawFinancialLine
): RawFinancialLine["kindHint"] {
  // Mission 192, D-106: uma linha de demonstrativo (`statementCategory`
  // já detectado por `DefaultFinancialStatementClassifier`) nunca tem
  // `eventTypeHint`/`resourceTypeHint` — checada primeiro para que o
  // recálculo abaixo nunca a interprete como "sem kindHint
  // determinável" e apague sua classificação já certa.
  if (line.statementCategory !== undefined) {
    return "statement_line";
  }

  if (line.eventTypeHint !== undefined) {
    return "event";
  }

  if (line.resourceTypeHint !== undefined) {
    return "resource";
  }

  return undefined;
}

function consolidateLine(line: RawFinancialLine): RawFinancialLine {
  const consolidatedKindHint = deriveKindHint(line);

  if (consolidatedKindHint === line.kindHint) {
    // Já consistente — nenhuma alteração. Este é o caminho esperado
    // para todo documento que já passou por
    // `FinancialLineClassifier`/`FinancialEventResolver`; o
    // recálculo acima existe apenas como certificação final, nunca
    // como fonte de uma classificação nova.
    return line;
  }

  // `kindHint` estava inconsistente com `eventTypeHint`/
  // `resourceTypeHint` já detectados (ex.: um documento que chegou
  // até aqui sem passar pelo Resolver) — reconciliado usando
  // exclusivamente informação já existente na própria linha, nunca
  // um valor novo.
  return {
    ...line,
    ...(consolidatedKindHint ? { kindHint: consolidatedKindHint } : {}),
  };
}

/**
 * Primeira implementação concreta de `FinancialKnowledgeBuilder`
 * (Mission 050 — Financial Knowledge Builder). Consolidação/validação
 * puramente estrutural sobre informação já existente — nunca executa
 * o Pipeline, nunca cria dado, nunca usa IA/LLM/heurística nova.
 *
 * `build()`:
 * 1. Para cada linha de cada documento, consolida `kindHint` a partir
 *    de `eventTypeHint`/`resourceTypeHint` já detectados — mesma
 *    regra já usada por `FinancialLineClassifier`/
 *    `FinancialEventResolver`, reaplicada aqui apenas como
 *    certificação final ("consolidar campos já classificados"/
 *    "remover ambiguidades já resolvidas"). Para qualquer documento
 *    que já passou pelo pipeline oficial de preparação (Missions
 *    046–049), isso é sempre um no-op — `kindHint` já está correto.
 * 2. Nenhuma outra transformação é aplicada — `label`/`amount`/
 *    `currency`/`date`/`resourceTypeHint`/`eventTypeHint` de cada
 *    linha, e `documentId`/`companyId`/`source` de cada documento,
 *    permanecem exatamente como recebidos. Nenhum documento é
 *    removido, criado ou fundido — a coleção devolvida tem
 *    exatamente os mesmos documentos, na mesma ordem.
 *
 * Ver `README.md` deste diretório para o racional completo de por
 * que as demais operações permitidas pela missão ("validar
 * consistência entre linhas", "padronizar relações entre eventos")
 * não têm uma realização segura dentro das restrições desta missão
 * (nenhum campo novo em `RawFinancialLine`, nenhuma heurística nova,
 * nenhuma alteração de dado já classificado).
 */
export class DefaultFinancialKnowledgeBuilder
  implements FinancialKnowledgeBuilder
{
  build(
    documents: readonly RawFinancialDocument[]
  ): readonly RawFinancialDocument[] {
    return documents.map((document) => ({
      ...document,
      lines: document.lines.map((line) => consolidateLine(line)),
    }));
  }
}
