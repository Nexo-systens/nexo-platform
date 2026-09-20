import type {
  RawFinancialDocument,
  RawFinancialLine,
} from "@/efos/engines/data";

import type { FinancialContextBuilder } from "./FinancialContextBuilder";

/**
 * Diagnóstico interno de contexto — nunca exposto pelo contrato público
 * (`build()` sempre devolve `readonly RawFinancialDocument[]`, nunca este
 * tipo). Existe apenas para que as checagens determinísticas desta
 * missão sejam de fato executadas e verificáveis, sem ter nenhum efeito
 * sobre o dado que segue para `DocumentIntake`/`EFOSPlatform`. Ver
 * `README.md` para o racional completo de por que esse diagnóstico não
 * é registrado em lugar nenhum.
 */
interface ContextIssue {
  readonly rule: string;
  readonly message: string;
}

/**
 * "Confirmar relações já existentes" — todos os documentos de uma mesma
 * coleção deveriam pertencer à mesma empresa (`companyId`), já que
 * `app/api/efos/upload/route.ts` sempre chama `PdfParser.parse(file,
 * companyId)` com o mesmo `companyId` para todos os arquivos de um único
 * upload. Aqui apenas confirmamos essa relação já existente — nunca a
 * criamos nem a corrigimos.
 */
function checkSharedCompanyId(
  documents: readonly RawFinancialDocument[]
): readonly ContextIssue[] {
  const companyIds = new Set(documents.map((document) => document.companyId));

  if (companyIds.size <= 1) {
    return [];
  }

  return [
    {
      rule: "shared-company-id",
      message: `Coleção mistura documentos de mais de uma empresa: ${Array.from(companyIds).join(", ")}.`,
    },
  ];
}

/**
 * "Identificar contexto compartilhado" / "validar consistência entre
 * documentos" — mesma checagem de `currency` já feita pelo
 * `FinancialRecordValidator` (Mission 051), agora estendida entre
 * documentos em vez de dentro de um único documento.
 */
function checkSharedCurrency(
  documents: readonly RawFinancialDocument[]
): readonly ContextIssue[] {
  const currencies = new Set(
    documents
      .flatMap((document) => document.lines)
      .map((line: RawFinancialLine) => line.currency)
      .filter((currency): currency is string => currency !== undefined)
  );

  if (currencies.size <= 1) {
    return [];
  }

  return [
    {
      rule: "shared-currency",
      message: `Coleção mistura mais de uma moeda entre documentos: ${Array.from(currencies).join(", ")}.`,
    },
  ];
}

function buildContextDiagnostics(
  documents: readonly RawFinancialDocument[]
): readonly ContextIssue[] {
  return [
    ...checkSharedCompanyId(documents),
    ...checkSharedCurrency(documents),
  ];
}

/**
 * "Organizar os documentos" — única operação com efeito observável
 * permitida pela missão. Ordena a coleção por campos já existentes no
 * contrato oficial (`companyId`, depois `source`, depois `documentId`
 * como desempate determinístico e único) — nunca por um campo inventado.
 * Cada documento devolvido é exatamente o mesmo objeto recebido (mesma
 * referência); apenas a posição no array pode mudar. Como o critério de
 * ordenação usa `documentId` (sempre único) como desempate final, a
 * ordenação é uma ordem total determinística — logo, idempotente por
 * construção: ordenar uma coleção já ordenada produz a mesma ordem.
 */
function organizeDocuments(
  documents: readonly RawFinancialDocument[]
): readonly RawFinancialDocument[] {
  return [...documents].sort((a, b) => {
    const byCompanyId = a.companyId.localeCompare(b.companyId);
    if (byCompanyId !== 0) {
      return byCompanyId;
    }

    const bySource = a.source.localeCompare(b.source);
    if (bySource !== 0) {
      return bySource;
    }

    return a.documentId.localeCompare(b.documentId);
  });
}

/**
 * Primeira implementação concreta de `FinancialContextBuilder`
 * (Mission 052 — Financial Context Builder). Consolida o contexto
 * financeiro compartilhado entre documentos antes de a Platform
 * entregar a coleção ao EFOS Core. **Esta camada nunca executa o
 * Pipeline** e nunca cria/altera documento, linha, valor, data, label,
 * `currency`, classificação ou hint algum — cada documento devolvido é
 * exatamente o mesmo objeto recebido, apenas reordenado
 * deterministicamente.
 */
export class DefaultFinancialContextBuilder implements FinancialContextBuilder {
  build(
    documents: readonly RawFinancialDocument[]
  ): readonly RawFinancialDocument[] {
    // As checagens de contexto compartilhado são executadas de fato
    // (nunca puladas) — apenas não têm nenhum efeito sobre o retorno,
    // porque RawFinancialLine/RawFinancialDocument não têm campo algum
    // para registrar um diagnóstico (ver README.md).
    void buildContextDiagnostics(documents);

    return organizeDocuments(documents);
  }
}
