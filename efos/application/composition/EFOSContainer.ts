import type { EFOSFacade } from "../facade";

/**
 * Contrato do Composition Root oficial da Application Layer
 * (Mission 024 — Composition Root). Único método público:
 * `getFacade()`, devolvendo a instância já montada de `EFOSFacade`
 * (`efos/application/facade/EFOSFacade.ts`, Mission 023) — o único
 * ponto de entrada que a Plataforma NEXO (ou qualquer consumidor
 * futuro) deve conhecer. Nenhum Controller, API ou UI deve conhecer
 * `EFOSPipelineRuntime`, `DefaultAnalysisService`,
 * `DefaultReportService` ou `DefaultEFOSFacade` diretamente — apenas
 * `EFOSContainer.getFacade()`.
 *
 * Primeira implementação concreta: `DefaultEFOSContainer`
 * (`DefaultEFOSContainer.ts`) — a única classe do sistema autorizada
 * a instanciar (`new`) Services, Runtime, Orchestrator ou Facade.
 */
export interface EFOSContainer {
  getFacade(): EFOSFacade;
}
