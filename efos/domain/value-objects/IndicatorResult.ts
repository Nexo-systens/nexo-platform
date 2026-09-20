/**
 * Resultado de um indicador: exatamente 2 estados (Mission 098, D-052).
 * `0` e um valor legitimo quando `status === "available"` — nao existe
 * estado `zero_confirmed` nem `invalid` (nenhum consumidor real do
 * dominio precisa distinguir "zero calculado" de "zero confirmado", e
 * nao ha nenhum gatilho hoje para um estado de invalidade separado de
 * indisponibilidade).
 *
 * `unavailable` representa exclusivamente "nao ha dado suficiente para
 * calcular este indicador" (ex.: divisor da formula igual a 0) — nunca
 * "o valor calculado e zero".
 */
export type IndicatorResult =
  | { readonly status: "available"; readonly value: number }
  | { readonly status: "unavailable" };
