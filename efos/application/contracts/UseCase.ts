import type { ApplicationResult } from "./ApplicationResult";

/**
 * Contrato comum a todo Use Case da Application Layer. Cada Use Case
 * tem responsabilidade unica, depende apenas de Services
 * (efos/application/services/*) — nunca conhece Engines
 * (efos/engines/*) nem infraestrutura diretamente — e sempre retorna
 * um `ApplicationResult`. Puramente estrutural — nenhuma logica de
 * negocio, sem dependencia de HTTP.
 */
export interface UseCase<TRequest = unknown, TResponse = unknown> {
  execute(request: TRequest): Promise<ApplicationResult<TResponse>>;
}
