import type { EFOSContainer } from "../composition";
import type { EFOSFacade } from "../facade";

import type { EFOSHost } from "./EFOSHost";

/**
 * Primeira implementação concreta de `EFOSHost` (Mission 025 —
 * Application Host). Recebe `EFOSContainer`
 * (`efos/application/composition/EFOSContainer.ts`, Mission 024) via
 * construtor — inversão de dependência, nunca instanciado
 * internamente (nunca `new DefaultEFOSContainer()` dentro desta
 * classe) — e apenas repassa `getFacade()` para o Container.
 *
 * Nenhuma lógica além dessa delegação: o Host não sabe como a Facade
 * foi montada (isso é responsabilidade exclusiva do Container, D-021)
 * — apenas expõe o resultado já pronto para quem o consumir.
 */
export class DefaultEFOSHost implements EFOSHost {
  constructor(private readonly container: EFOSContainer) {}

  getFacade(): EFOSFacade {
    return this.container.getFacade();
  }
}
