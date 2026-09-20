import type { DocumentGovernanceOutcome } from "@/app/api/efos/_shared/documentGovernance";
import type { DocumentGovernanceSnapshot } from "@/modules/documents/services/document.service";
import type { Json } from "@/types/database";

/**
 * Mesma forma de `DocumentGovernanceSnapshot` (`document.service.ts`),
 * mas com `outcome` estreitado para `DocumentGovernanceOutcome` — o
 * serviço de persistência deliberadamente usa `string` genérico
 * (`modules/documents` nunca importa de `app/api/efos/_shared/`, a
 * direção correta de dependência dentro da Experience layer), mas todo
 * LEITOR desta função já sabe que o valor gravado só pode ter vindo do
 * vocabulário fechado de `buildDocumentGovernanceResults()` — nunca uma
 * segunda validação de runtime, apenas um tipo mais preciso para quem
 * consome.
 */
export type DocumentGovernanceSnapshotView = Omit<DocumentGovernanceSnapshot, "outcome"> & {
  readonly outcome: DocumentGovernanceOutcome;
};

/**
 * Mission 193 — Production Intake Governance & Permanent Regression
 * Gate, Seção 9/16. Lê o desfecho de governança MAIS RECENTE gravado
 * em `documents.metadata` (`{governance: DocumentGovernanceSnapshot}`,
 * ver `document.service.ts`) — nunca uma reclassificação, apenas leitura
 * defensiva do JSON já persistido (`metadata` é `jsonb`, sem esquema
 * garantido pelo Postgres; um documento anterior a esta missão tem
 * `metadata = {}`, sem `governance` — tratado como "nunca avaliado",
 * nunca um erro).
 */
export function readDocumentGovernance(
  metadata: Json
): DocumentGovernanceSnapshotView | undefined {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return undefined;
  }

  const governance = (metadata as Record<string, unknown>).governance;
  if (typeof governance !== "object" || governance === null) {
    return undefined;
  }

  const candidate = governance as Record<string, unknown>;
  if (
    typeof candidate.executionId !== "string" ||
    typeof candidate.outcome !== "string" ||
    typeof candidate.reason !== "string" ||
    typeof candidate.evaluatedAt !== "string"
  ) {
    return undefined;
  }

  return {
    executionId: candidate.executionId,
    outcome: candidate.outcome as DocumentGovernanceOutcome,
    reason: candidate.reason,
    evaluatedAt: candidate.evaluatedAt,
  };
}
