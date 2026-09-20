/**
 * Tipos comuns do EFOS Core. Puramente estrutural — nenhuma logica de
 * negocio. Ver docs/01_ARCHITECTURE/06_EFOS CORE.md e
 * docs/ARCHITECTURE_AUDIT.md.
 */

export type EngineId =
  | "data"
  | "financial-model"
  | "financial-knowledge-graph"
  | "indicators"
  | "evidence"
  | "context"
  | "reasoning"
  | "simulation"
  | "recommendation"
  | "decision"
  | "learning";

export type EngineStatus = "idle" | "running" | "completed" | "failed";

export interface EngineMetadata {
  id: EngineId;
  name: string;
  description: string;
}
