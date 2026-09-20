import type { ChangeDirection } from "@/efos/application/history";

/**
 * Rótulo/símbolo executivo de cada `ChangeDirection` (Mission 085/086,
 * D-045/D-046; estados de disponibilidade adicionados na Mission 098,
 * D-052) — puramente apresentacional, os estados usados exatamente
 * como o EFOS já os produz, nenhuma taxonomia nova criada na UI
 * (Mission 087, "Não criar outra taxonomia na UI").
 */
export const DIRECTION_LABEL: Record<ChangeDirection, string> = {
  increased: "Aumentou",
  decreased: "Diminuiu",
  unchanged: "Sem mudança",
  added: "Novo indicador",
  removed: "Indicador removido",
  "not-comparable": "Não comparável",
  "became-available": "Passou a estar disponível",
  "became-unavailable": "Deixou de estar disponível",
  unavailable: "Não disponível",
};

export const DIRECTION_SYMBOL: Record<ChangeDirection, string> = {
  increased: "↑",
  decreased: "↓",
  unchanged: "=",
  added: "+",
  removed: "−",
  "not-comparable": "≠",
  "became-available": "＋",
  "became-unavailable": "－",
  unavailable: "…",
};
