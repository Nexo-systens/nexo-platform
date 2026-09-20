/**
 * Valor monetario. Representa quantia e moeda — nao realiza nenhum
 * calculo ou conversao.
 */
export interface Money {
  readonly amount: number;
  readonly currency: string; // ISO 4217, ex.: "BRL"
}
