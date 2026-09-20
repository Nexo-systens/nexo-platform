/**
 * Contrato comum a todo Service da Application Layer. Um Service
 * coordena Use Cases e Ports para prover uma capacidade da aplicacao
 * (ex.: obter uma analise, gerar um relatorio) — nunca contem regra de
 * dominio (isso pertence aos Builders dos Engines, efos/engines/*) e
 * nunca chama `Engine.execute()` diretamente nesta fase (Mission 017
 * estabelece apenas a fundacao estrutural, sem orquestracao real).
 * Puramente estrutural — nenhuma logica de negocio, sem dependencia de
 * HTTP.
 */
export interface ApplicationService {
  readonly name: string;
}
