import type { PipelineExecution } from "./PipelineExecution";
import type { PipelineMetadata } from "./PipelineMetadata";

/**
 * Visão de leitura imutável de uma execução do pipeline (Mission 020B
 * — Pipeline Execution State). Value object que combina
 * `PipelineMetadata` (status, estágios concluídos, duração) e
 * `PipelineExecution` (saída de cada estágio) num único objeto,
 * pensado para consumo externo futuro — uma API de consulta de
 * execução, um Dashboard executivo — nunca para uso interno do
 * Runtime, que já mantém as duas peças separadas durante `execute()`.
 * Reaproveita os dois tipos por completo, nenhum campo redeclarado
 * (mesmo princípio de D-015/D-016/D-017: nunca duplicar um contrato
 * já oficial).
 *
 * Ainda não é produzido nem consumido por nenhum componente desta
 * missão — apenas o contrato existe, preparado para uma futura API ou
 * camada de leitura (Infrastructure/Experience) construir a partir
 * dele. Nenhuma lógica de conversão (`PipelineMetadata`/
 * `PipelineExecution` → `PipelineExecutionSnapshot`) foi criada nesta
 * missão.
 */
export interface PipelineExecutionSnapshot {
  readonly metadata: PipelineMetadata;
  readonly execution: PipelineExecution;
}
