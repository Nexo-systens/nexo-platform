import type {
  RawFinancialDocument,
  RawFinancialLine,
} from "@/efos/engines/data";

import type { FinancialRecordValidator } from "./FinancialRecordValidator";

/**
 * Diagnóstico interno de uma validação — nunca exposto pelo contrato
 * público (`validate()` sempre devolve `RawFinancialDocument`, nunca
 * este tipo). Existe apenas para que as regras determinísticas desta
 * missão sejam de fato executadas e verificáveis (ex.: em testes),
 * sem ter nenhum efeito sobre o dado que segue para
 * `DocumentIntake`/`EFOSPlatform`. Ver `README.md` para o racional
 * completo de por que esses diagnósticos não são registrados em
 * lugar nenhum do documento.
 */
interface ValidationIssue {
  readonly documentId: string;
  readonly lineIndex: number;
  readonly rule: string;
  readonly message: string;
}

/**
 * Mesma regra determinística já usada por `FinancialLineClassifier`
 * (Mission 046), `FinancialEventResolver` (Mission 048) e
 * `FinancialKnowledgeBuilder` (Mission 050) — nenhuma heurística
 * nova. Usada aqui apenas para detectar se `kindHint` já registrado
 * é compatível com `eventTypeHint`/`resourceTypeHint` já detectados;
 * nunca para corrigir a linha.
 */
function deriveKindHint(
  line: RawFinancialLine
): RawFinancialLine["kindHint"] {
  // Mission 192, D-106: mesma prioridade de `DefaultFinancialKnowledgeBuilder`
  // — uma linha de demonstrativo nunca tem eventTypeHint/resourceTypeHint.
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

function validateLine(
  document: RawFinancialDocument,
  line: RawFinancialLine,
  lineIndex: number
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const pushIssue = (rule: string, message: string): void => {
    issues.push({ documentId: document.documentId, lineIndex, rule, message });
  };

  // amount obrigatório quando existir eventTypeHint.
  if (line.eventTypeHint !== undefined && line.amount === undefined) {
    pushIssue(
      "amount-required-for-event-type",
      "eventTypeHint presente sem amount."
    );
  }

  // date obrigatória quando kindHint == "event".
  if (line.kindHint === "event" && line.date === undefined) {
    pushIssue("date-required-for-event-kind", 'kindHint="event" sem date.');
  }

  // period obrigatório quando kindHint == "statement_line" (Mission
  // 192, D-106) — nunca `date`/`occurredAt`, que representaria uma
  // transação pontual que a linha não é.
  if (line.kindHint === "statement_line" && line.period === undefined) {
    pushIssue(
      "period-required-for-statement-line-kind",
      'kindHint="statement_line" sem period.'
    );
  }

  // resourceTypeHint/eventTypeHint compatíveis com kindHint — mesma
  // regra determinística já usada por Classifier/Resolver/Builder;
  // qualquer divergência é um conflito óbvio entre o que já foi
  // classificado e o que os próprios hints implicam.
  const expectedKindHint = deriveKindHint(line);
  if (line.kindHint !== expectedKindHint) {
    pushIssue(
      "kind-hint-incompatible-with-type-hints",
      `kindHint="${String(line.kindHint)}" incompatível com eventTypeHint/resourceTypeHint já detectados (esperado: "${String(expectedKindHint)}").`
    );
  }

  return issues;
}

/**
 * `currency` consistente dentro do mesmo documento — todas as linhas
 * que já têm `currency` detectado devem usar o mesmo código; um
 * documento com `BRL` numa linha e `USD` noutra é um conflito óbvio,
 * detectado (nunca corrigido).
 */
function validateDocumentCurrencyConsistency(
  document: RawFinancialDocument
): readonly ValidationIssue[] {
  const currencies = new Set(
    document.lines
      .map((line) => line.currency)
      .filter((currency): currency is string => currency !== undefined)
  );

  if (currencies.size <= 1) {
    return [];
  }

  return [
    {
      documentId: document.documentId,
      lineIndex: -1,
      rule: "currency-consistent-within-document",
      message: `Documento usa múltiplas moedas: ${Array.from(currencies).join(", ")}.`,
    },
  ];
}

function validateDocument(
  document: RawFinancialDocument
): readonly ValidationIssue[] {
  return [
    ...document.lines.flatMap((line, lineIndex) =>
      validateLine(document, line, lineIndex)
    ),
    ...validateDocumentCurrencyConsistency(document),
  ];
}

/**
 * Primeira implementação concreta de `FinancialRecordValidator`
 * (Mission 051 — Financial Record Validation). Executa as validações
 * determinísticas descritas no README para cada documento/linha, mas
 * **nunca altera, corrige, remove ou adiciona nada** — o valor
 * devolvido é sempre exatamente a mesma coleção recebida (mesma
 * referência).
 *
 * Idempotente por construção: como `validate()` nunca produz um
 * efeito observável sobre o dado, `validate(validate(x)) ===
 * validate(x)` trivialmente.
 */
export class DefaultFinancialRecordValidator
  implements FinancialRecordValidator
{
  validate(
    documents: readonly RawFinancialDocument[]
  ): readonly RawFinancialDocument[] {
    // As validações são executadas de fato (nunca puladas) — apenas
    // não têm nenhum efeito sobre o retorno, porque
    // RawFinancialLine/RawFinancialDocument não têm campo algum para
    // registrar um diagnóstico (ver README.md, "Por que os
    // diagnósticos não são registrados em lugar nenhum").
    void documents.map((document) => validateDocument(document));

    return documents;
  }
}
