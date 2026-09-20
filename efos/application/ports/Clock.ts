/**
 * Port de tempo — abstrai `new Date()`/`Date.now()` para que Use
 * Cases/Services permaneçam determinísticos e testáveis. Contrato
 * puro — implementação real (relógio do sistema) pertence a
 * Infrastructure. Nenhuma lógica de negócio.
 */
export interface Clock {
  now(): Date;
}
