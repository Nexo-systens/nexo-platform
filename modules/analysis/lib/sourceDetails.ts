import type { Evidence, Indicator } from "@/efos/domain";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";

/**
 * Origem de um único registro financeiro (Mission 109 — Source
 * Traceability Experience, Etapa 3 — contrato conceitual da missão,
 * implementado exatamente como especificado). `documentId` é sempre o
 * id canônico real (`public.documents.id`, Mission 108/D-055) — nunca
 * um nome de arquivo, nunca um valor inventado. `recordId`/`label`/
 * `value`/`date` são opcionais apenas porque `NormalizedFinancialRecord`
 * já os declara opcionais (nenhum documento real garante todos).
 */
export interface SourceItem {
  readonly documentId: string;
  readonly recordId?: string;
  readonly label?: string;
  readonly value?: number;
  readonly date?: string;
}

/**
 * `available`/`sources[]` só existe quando o Evidence Engine preservou
 * uma referência estruturada e resolvível até um `FinancialEvent`/
 * `Resource` real (`EvidenceSource`, D-007) — nunca reconstruído
 * matematicamente a partir de categoria/tipo de evento (Mission 109,
 * Regra fundamental: "nunca inferir, adivinhar, casar por nome, usar
 * heurística"). `unavailable`/`reason` é o estado padrão para tudo que
 * não atinge esse critério — inclui o caso em que a cadeia existe mas
 * para no `Indicator` (`EvidenceSource` só `{type:"indicator", id}`,
 * 4 das 5 regras do Evidence Engine hoje) e o caso em que não há
 * nenhuma Evidence associada a um Indicator consultado diretamente.
 */
export type SourceDetails =
  | { readonly status: "available"; readonly sources: readonly SourceItem[] }
  | { readonly status: "unavailable"; readonly reason: string };

const GENERIC_UNAVAILABLE_REASON =
  "O cálculo está disponível, mas os registros financeiros específicos utilizados nesta execução não foram preservados como referências individuais.";

const NO_EVIDENCE_REASON =
  "Nenhuma evidência ou registro rastreável foi associado a este indicador nesta execução.";

/**
 * `NormalizedFinancialRecord.recordId` é construído como
 * `"${documentId}-${lineIndex}"` (`data.mapper.ts`) — `documentId` é
 * sempre um UUID canônico (Mission 108/D-055), `lineIndex` é sempre um
 * inteiro sem hífen; o último `"-"` da string separa os dois de forma
 * inequívoca, mesmo com os hífens internos do UUID.
 */
function extractDocumentId(recordId: string): string {
  const lastDash = recordId.lastIndexOf("-");
  return lastDash === -1 ? recordId : recordId.slice(0, lastDash);
}

function toSourceItem(record: NormalizedFinancialRecord): SourceItem {
  return {
    documentId: extractDocumentId(record.recordId),
    recordId: record.recordId,
    label: record.label,
    value: record.amount,
    date: record.occurredAt,
  };
}

function findRecordById(
  records: readonly NormalizedFinancialRecord[],
  id: string
): NormalizedFinancialRecord | undefined {
  return records.find((record) => record.recordId === id);
}

function indicatorNameOf(evidence: Evidence): string | undefined {
  const value = evidence.supportingData.indicatorName;
  return typeof value === "string" ? value : undefined;
}

/**
 * Origem de uma Evidence (Mission 109, Etapa 4/8/14). Percorre
 * `evidence.sources` (`EvidenceSource[]`, D-007) e resolve apenas as
 * fontes `"financial_event"`/`"resource"` contra os registros já
 * expostos ao Executive Report — `"indicator"`/`"graph_node"`/
 * `"graph_edge"` nunca produzem um `SourceItem` (não têm `documentId`
 * real a oferecer; inventar um seria a exata heurística proibida pela
 * missão). Quando nenhuma fonte resolve, a cadeia parou no Indicator —
 * `reason` menciona o nome do indicador quando disponível
 * (`supportingData.indicatorName`, campo já existente, não inferido).
 */
export function buildEvidenceSourceDetails(
  evidence: Evidence,
  records: readonly NormalizedFinancialRecord[]
): SourceDetails {
  const sources: SourceItem[] = [];

  for (const source of evidence.sources) {
    if (source.type === "financial_event" || source.type === "resource") {
      const record = findRecordById(records, source.id);
      if (record) {
        sources.push(toSourceItem(record));
      }
    }
  }

  if (sources.length > 0) {
    return { status: "available", sources };
  }

  const indicatorName = indicatorNameOf(evidence);
  return {
    status: "unavailable",
    reason: indicatorName
      ? `Este fato foi identificado a partir do indicador "${indicatorName}". ${GENERIC_UNAVAILABLE_REASON}`
      : GENERIC_UNAVAILABLE_REASON,
  };
}

/**
 * Origem de um Indicator (Mission 109, Etapa 5/9; Mission 110 —
 * Indicator Source Traceability, Etapa 10). Até a Mission 110,
 * `Indicator` (Domain) não carregava nenhuma referência estruturada
 * aos `FinancialEvent`/`Resource` que alimentaram seu cálculo — a
 * Mission 110 fechou esse GAP (D-056): `Indicator.sourceRecordIds`,
 * construído pelo próprio Indicators Engine durante o cálculo (nunca
 * reconstruído depois). Prioridade explícita (Mission 110, Etapa 10):
 * **(1)** `indicator.sourceRecordIds` resolvidos diretamente — mais
 * preciso, cobre indicadores sem nenhuma Evidence associada (ex.:
 * EBIT); **(2)** Evidence existente cujo `supportingData.indicatorName`
 * bate com este indicador — mesma resolução usada para Evidence
 * (`buildEvidenceSourceDetails`); **(3)** `unavailable` — nunca uma
 * reconstrução por categoria/tipo de evento (heurística proibida).
 * Execuções persistidas antes da Mission 110 simplesmente não têm
 * `sourceRecordIds` — caem direto para o passo (2)/(3), nunca um erro.
 */
export function buildIndicatorSourceDetails(
  indicator: Indicator,
  evidences: readonly Evidence[],
  records: readonly NormalizedFinancialRecord[]
): SourceDetails {
  if (indicator.sourceRecordIds && indicator.sourceRecordIds.length > 0) {
    const sources = indicator.sourceRecordIds
      .map((id) => findRecordById(records, id))
      .filter((record): record is NormalizedFinancialRecord => record !== undefined)
      .map(toSourceItem);

    if (sources.length > 0) {
      return { status: "available", sources };
    }
  }

  const relatedEvidence = evidences.find(
    (evidence) => indicatorNameOf(evidence) === indicator.name
  );

  if (relatedEvidence) {
    return buildEvidenceSourceDetails(relatedEvidence, records);
  }

  return { status: "unavailable", reason: NO_EVIDENCE_REASON };
}
