import type { SyntheticEvidenceTarget } from "./SyntheticEvidenceTarget";

/**
 * Mission 156 — Synthetic Company Validation Foundation.
 *
 * **REGRA CENTRAL (Etapa 5)**: `SyntheticGroundTruth` NUNCA é Financial
 * Truth — é conhecido apenas pelo harness de validação (testes),
 * NUNCA enviado à Executive AI, a nenhum prompt, ao diagnóstico, a
 * Knowledge, a Recommendations ou a Decision. `SyntheticFinancialDataset`
 * é o que o EFOS recebe; `SyntheticGroundTruth` é o que o teste já sabe
 * de antemão sobre o cenário, para verificar se o EFOS chegou à
 * conclusão certa — nunca o contrário.
 *
 * Quatro categorias fechadas, deliberadamente distintas em força de
 * afirmação (nunca confundir teste de arquitetura com teste de texto
 * gerado por IA):
 *
 * - `EXPECTED_FACT` — computável e verificável DIRETAMENTE a partir dos
 *   `Indicator`s reais que o Indicators Engine produzir (ex.: "margem
 *   bruta do período 6 é menor que a do período 1") — pode e deve ser
 *   testado com uma asserção direta.
 * - `EXPECTED_SIGNAL` — algo que o Evidence/Context Engine
 *   provavelmente sinalizaria (ex.: "pressão de capital de giro") —
 *   documentado para missões futuras que exercitem essas Engines,
 *   nunca testado nesta missão (fora do escopo, Etapa 12).
 * - `EXPECTED_INTERPRETATION` — algo que a Executive AI PODERIA
 *   escrever — nunca uma obrigação; a arquitetura pode produzir uma
 *   interpretação legítima diferente sem que isso seja uma falha.
 * - `EXPECTED_OUTCOME` — o tema que uma Decision humana futura
 *   plausivelmente tocaria — nunca fabrica a Decision em si (Etapa 10:
 *   a decisão continua sempre humana).
 */
export const GROUND_TRUTH_CATEGORIES = [
  "EXPECTED_FACT",
  "EXPECTED_SIGNAL",
  "EXPECTED_INTERPRETATION",
  "EXPECTED_OUTCOME",
] as const;
export type GroundTruthCategory = (typeof GROUND_TRUTH_CATEGORIES)[number];

export interface GroundTruthAssertion {
  readonly category: GroundTruthCategory;
  readonly statement: string;
  readonly rationale: string;
}

/**
 * Etapa 10 — especificação de um cenário de decisão. Nunca cria uma
 * `Decision` automaticamente; apenas documenta o tema esperado para
 * quando um humano real (ou uma missão futura simulando um humano via
 * fluxo oficial) a produzir.
 */
export interface SyntheticDecisionScenarioSpecification {
  readonly problem: string;
  readonly expectedRecommendationThemes: readonly string[];
  readonly expectedDecisionNature: string;
}

export interface SyntheticGroundTruth {
  readonly scenarioId: string;
  readonly assertions: readonly GroundTruthAssertion[];
  readonly decisionScenario: SyntheticDecisionScenarioSpecification;
  /**
   * Mission 158 — opcional: presente apenas em cenários deliberadamente
   * desenhados para cruzar limiares reais do `EvidenceEngine` (ver
   * `SyntheticEvidenceTarget.ts`). AUREA (Mission 156) nunca teve este
   * campo — foi desenhada para permanecer "administrável", nunca cruzar
   * um limiar absoluto (achado da Mission 157). Metadata de validação —
   * nunca Financial Truth, nunca enviado a nenhuma Engine.
   */
  readonly evidenceTargets?: readonly SyntheticEvidenceTarget[];
}
