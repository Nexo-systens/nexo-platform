/**
 * Metadados comuns de uma operacao da Application Layer — identifica a
 * requisicao e quando ela ocorreu. Mesmo papel de `EfosEngineContext`
 * (efos/interfaces/engine.ts) para os Engines, agora no nivel da
 * Application Layer — nao carrega `companyId`/dado de dominio algum
 * (isso pertence a cada DTO especifico, efos/application/dto/*).
 * Puramente estrutural — nenhuma logica de negocio.
 */
export interface ApplicationMetadata {
  readonly requestId: string;
  readonly timestamp: string;
}
