import type { ConfidenceLevel } from "../enums";

/**
 * Nivel de confianca de uma conclusao (0-100), conforme as faixas
 * definidas em docs/00_FUNDACION/03_EFOS REASONING MODEL.md
 * ("Niveis de Confianca"). `level` e um rotulo paralelo ao valor
 * numerico, nao uma classificacao calculada por este dominio.
 */
export interface ConfidenceScore {
  readonly value: number; // 0-100
  readonly level: ConfidenceLevel;
}
