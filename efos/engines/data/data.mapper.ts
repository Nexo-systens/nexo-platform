import type { CandidateFinancialRecord, RawFinancialDocument } from "./data.types";

/**
 * Mapper do Data Engine. Responsavel apenas pela transformacao entre
 * formatos — reshape de documento+linha para um registro candidato.
 * Nenhuma limpeza de valor, nenhuma padronizacao (isso e
 * responsabilidade exclusiva do Normalizer, data.normalizer.ts) e
 * nenhuma validacao (isso ja aconteceu em data.validator.ts).
 *
 * Uma linha sem `kindHint` (nenhum `resourceTypeHint`/`eventTypeHint`
 * detectado por nenhuma etapa da cadeia de preparacao — Classifier,
 * Resolver, KnowledgeBuilder, todos ja se recusam deliberadamente a
 * adivinhar) nunca vira um `CandidateFinancialRecord` — ela e
 * ignorada aqui (Mission 093, D-049). Ate a Mission 093, o fallback
 * `line.kindHint ?? "resource"` produzia `kind: "resource"` sem
 * `resourceType` para toda linha nao classificavel (cabecalhos,
 * rodapes, titulos de tabela — nunca recursos/eventos de verdade),
 * violando de forma consistente a validacao do Financial Model Engine
 * (`resourceType e obrigatorio quando kind="resource"`) e inventando
 * uma classificacao sem nenhuma evidencia real do documento. Nao
 * existe hoje um valor de `kind` para "nao classificado" no Domain —
 * criar um exigiria uma decisao arquitetural propria (Mission 093,
 * Etapa 5, Caso B); ate que isso seja decidido, a linha simplesmente
 * nao produz registro algum, em vez de inventar um.
 */
export function mapDocumentsToCandidateRecords(
  documents: readonly RawFinancialDocument[]
): CandidateFinancialRecord[] {
  return documents.flatMap((document) =>
    document.lines
      .map((line, lineIndex) => ({ line, lineIndex }))
      .filter(({ line }) => line.kindHint !== undefined)
      .map(
        ({ line, lineIndex }): CandidateFinancialRecord => ({
          recordId: `${document.documentId}-${lineIndex}`,
          kind: line.kindHint as "resource" | "event" | "statement_line",
          resourceType: line.resourceTypeHint,
          eventType: line.eventTypeHint,
          label: line.label,
          amount: line.amount,
          currency: line.currency,
          occurredAt: line.date,
          source: document.source,
          // Mission 192, D-106: presentes apenas quando
          // `line.kindHint === "statement_line"` — `undefined` para
          // qualquer linha de evento/recurso, exatamente como
          // `resourceTypeHint`/`eventTypeHint` já são `undefined` para
          // o kind que não os usa.
          statementCategory: line.statementCategory,
          period: line.period,
          isTotalLine: line.isTotalLine,
          // Mission 192 Closure, D-111: presente apenas em linhas de
          // recurso vindas de um Balancete/Balanco com data-base
          // reconhecida.
          asOfDate: line.asOfDate,
        })
      )
  );
}
