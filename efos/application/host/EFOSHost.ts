import type { EFOSFacade } from "../facade";

/**
 * Porta de entrada oficial da Application Layer (Mission 025 —
 * Application Host). Responsabilidade única: fornecer acesso à
 * `EFOSFacade` (`efos/application/facade/EFOSFacade.ts`, Mission
 * 023). Nunca executa Engines, nunca executa o Runtime, nunca
 * conhece o Domain (`efos/domain`) nem qualquer Infrastructure —
 * apenas expõe a Facade já montada pelo `EFOSContainer` (Mission
 * 024).
 *
 * Não é HTTP, não é API, não é Next.js — é a fronteira que um
 * consumidor externo (uma futura rota, Server Action, script, ou
 * qualquer outro ponto de entrada da Plataforma) usa para alcançar o
 * EFOS, sem conhecer `EFOSContainer` nem nenhuma implementação
 * concreta abaixo dele.
 *
 * Primeira implementação concreta: `DefaultEFOSHost`
 * (`DefaultEFOSHost.ts`).
 */
export interface EFOSHost {
  getFacade(): EFOSFacade;
}
