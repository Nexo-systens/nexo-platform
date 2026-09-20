import type { FinancialModelAggregate, StatementConflict } from "@/efos/domain";
import type { NormalizedFinancialRecord } from "@/efos/engines/data";

/**
 * `NormalizedFinancialRecord` e definido no Data Engine
 * (efos/engines/data/data.types.ts) — o produtor do contrato. Reexportado
 * aqui para compatibilidade arquitetural: qualquer codigo que ja
 * importava este tipo de `financial-model.types.ts` (Mission 004)
 * continua funcionando sem alteracao (docs/DECISIONS.md, D-002).
 */
export type { NormalizedFinancialRecord } from "@/efos/engines/data";

/**
 * `conflicts` (Mission 192 Closure B — Deterministic Statement
 * Conflict Governance, D-113): campo ADITIVO e opcional, transportado
 * ate aqui pelo MESMO mecanismo ja usado por `priorPeriods`
 * (`PipelineContext.metadata`, D-016) — nunca um segundo canal de
 * dado. Detectado por `app/api/efos/_shared/prepareFinancialDocuments.ts`
 * (Application layer) ANTES deste Engine sequer rodar; o Engine apenas
 * repassa por referencia para `FinancialModelAggregate.statementConflicts`
 * (`financial-model.mapper.ts`) — nenhuma logica de conflito acontece
 * aqui, mesmo principio de transformacao pura ja aplicado a todo o
 * resto deste Engine.
 */
export interface FinancialModelEngineInput {
  readonly companyId: string;
  readonly records: readonly NormalizedFinancialRecord[];
  readonly conflicts?: readonly StatementConflict[];
}

/**
 * Saida do Financial Model Engine: o agregado do dominio (raiz +
 * recursos + eventos). `indicators` sempre retorna vazio — calcular
 * indicadores e responsabilidade do Indicators Engine, fora do escopo
 * desta missao.
 */
export type FinancialModelEngineOutput = FinancialModelAggregate;
