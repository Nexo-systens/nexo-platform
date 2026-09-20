import type { ApplicationService } from "../contracts";

/**
 * Coordena a obtenção de decisões priorizadas de uma empresa. Nesta
 * missão é apenas um contrato — nenhum método tem implementação,
 * nenhuma chamada a `Engine.execute()` existe ainda. Depende apenas de
 * Ports (`efos/application/ports`) e DTOs — nunca conhece Engines nem
 * infraestrutura diretamente.
 */
export interface DecisionService extends ApplicationService {
  getDecisions(companyId: string): Promise<unknown>;
}
