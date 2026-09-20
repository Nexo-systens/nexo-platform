import type { Period } from "@/efos/domain";

/**
 * Mission 184 — Scenario-to-Decision Governance Bridge (Seção 19/20 —
 * "Baseline Drift"). Comparação estrutural de identidade de `Period`
 * por DATA, nunca por `executedAt`/ordem/conteúdo numérico — mesmo
 * princípio já usado inline por `buildExecutiveScenarioComparison.ts`
 * (Mission 183) para provar o invariante de mesmo baseline entre dois
 * cenários comparados. Extraído aqui como função pura e nomeada porque
 * a Mission 184 precisa do MESMO teste de identidade para uma pergunta
 * diferente — "o baseline usado para formalizar esta decisão ainda é o
 * mesmo que foi avaliado quando o cenário foi simulado?" — sem
 * duplicar a lógica de comparação uma terceira vez.
 */
export function periodsEqual(a: Period, b: Period): boolean {
  return a.startDate === b.startDate && a.endDate === b.endDate;
}
