import type { Period, ScenarioType } from "@/efos/domain";
import type { ScenarioAssumption, ScenarioMetricComparison } from "@/efos/application/scenario-simulation";

/**
 * Mission 184 — Scenario-to-Decision Governance Bridge.
 *
 * Contrato mínimo e tipado do contexto hipotético que uma `Decision`
 * humana pode carregar quando se origina de uma análise de Scenario
 * Lab (Mission 180-183) — nunca uma cópia integral de
 * `ScenarioProjection`/`ExecutiveScenarioComparison` (Seção 8/9 da
 * missão: "define the minimum typed context needed... do not store
 * entire mutable UI payloads"). Deliberadamente NÃO carrega
 * `baseline.inputs`/`baseline.indicators`/`projected.inputs`/
 * `projected.indicators` (os 20 campos de `FinancialStatementInputs` +
 * 20 `CalculatedIndicator` cada) — apenas `comparison`, a visão de
 * DELTA já suficiente para responder "qual era o impacto esperado no
 * momento da decisão" (Seção 23), sem duplicar a verdade financeira
 * bruta (Seção 10 — nunca lido de volta como Evidence/Indicator
 * history).
 *
 * **Onde isto vive fisicamente**: nunca um novo campo em
 * `efos/domain/entities/Decision.ts`. `ScenarioAssumption`/
 * `ScenarioMetricComparison` são tipos da APPLICATION LAYER
 * (`efos/application/scenario-simulation/`) — o Domain nunca pode
 * importar deles (REGRA 2, `docs/PROJECT_RULES.md`: "o domínio não
 * depende de infraestrutura [ou de camadas acima de si]"). Em vez
 * disso, este contexto é serializado dentro de
 * `Decision.supportingData` (`Readonly<Record<string, unknown>>`, já
 * existente desde D-011) sob a chave `scenarioContext` — exatamente o
 * mesmo mecanismo que `Evidence`/`Context`/`Reasoning`/`Recommendation`/
 * `LearningRecord` já usam para carregar dados estruturados
 * específicos de quem os produziu sem forçar o Domain a conhecer sua
 * forma (ex.: `evidence.supportingData.indicatorName`,
 * `evidence.supportingData.periods` — precedente real de valor
 * aninhado em `supportingData`, `evidence.temporal.builder.ts`).
 * `humanActorId !== undefined` já é o sinal estrutural de "Decision
 * humana" (D-063); `scenarioContext !== undefined` é, pelo mesmo
 * princípio, o sinal estrutural de "Decision originada de Scenario
 * Lab" — nenhum enum de `origin` novo foi necessário (Seção 33).
 *
 * `nature: "hypothetical"` é reafirmado aqui (mesmo valor fixo de
 * `ScenarioProjection.nature`) para que qualquer leitor futuro deste
 * campo, mesmo sem ter em mãos o `ScenarioProjection` original, nunca
 * confunda este conteúdo com verdade financeira observada (Seção 10).
 *
 * **Mission 184 Closure — Exact Scenario Baseline Identity & Decision
 * Consent**: `baselineFingerprint` (novo, aditivo) registra a
 * impressão digital exata do `FinancialModel` (`fingerprintFinancialModel()`,
 * `modules/scenarios/lib/scenarioBaselineIdentity.ts`) que fundamentou
 * a simulação EXPLICITAMENTE confirmada por este executivo — nunca
 * apenas `period` (D-088/Mission 170C: mesmo `Period` nunca implica
 * mesma verdade financeira). Permanente e auditável: uma futura
 * reconciliação "esperado vs. observado" pode confirmar que o
 * `FinancialModel` realmente usado nunca foi silenciosamente trocado
 * por um reprocessamento posterior do mesmo período.
 */
export interface ScenarioDecisionAlternative {
  readonly scenarioType: ScenarioType;
  readonly assumption: ScenarioAssumption;
  readonly comparison: readonly ScenarioMetricComparison[];
}

export interface ScenarioDecisionContext {
  readonly nature: "hypothetical";
  readonly scenarioType: ScenarioType;
  readonly assumption: ScenarioAssumption;
  readonly period: Period;
  readonly comparison: readonly ScenarioMetricComparison[];
  /** Mission 184 Closure — ver comentário do módulo acima. Impressão digital do `FinancialModel` exato que fundamentou esta simulação confirmada. */
  readonly baselineFingerprint: string;
  /**
   * Presente apenas quando esta Decision se origina de uma comparação
   * (Seção 12/29/36) — a alternativa NÃO escolhida, retida como
   * contexto de trade-off visível, nunca convertida em uma segunda
   * Decision, nunca um "vencedor"/"perdedor".
   */
  readonly alternative?: ScenarioDecisionAlternative;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Checagem estrutural mínima (Seção 20 — "smallest typed state
 * needed") — nunca uma validação de schema completa (nenhuma
 * biblioteca nova, REGRA 15). Suficiente para distinguir com segurança
 * um `scenarioContext` real de um `undefined`/formato inesperado ao
 * ler de volta um `Decision.supportingData` já persistido.
 */
export function isScenarioDecisionContext(value: unknown): value is ScenarioDecisionContext {
  if (!isPlainObject(value)) return false;
  return (
    value.nature === "hypothetical" &&
    typeof value.scenarioType === "string" &&
    isPlainObject(value.assumption) &&
    isPlainObject(value.period) &&
    Array.isArray(value.comparison) &&
    typeof value.baselineFingerprint === "string"
  );
}

/**
 * Único ponto de leitura autorizado de um `ScenarioDecisionContext` a
 * partir de `Decision.supportingData` — nunca um cast direto espalhado
 * pela UI (mesmo princípio de `sourceDetails.ts` para
 * `evidence.supportingData.indicatorName`, apenas com uma checagem
 * estrutural adicional aqui por se tratar de um objeto aninhado, não
 * um primitivo).
 */
export function readScenarioDecisionContext(
  supportingData: Readonly<Record<string, unknown>>
): ScenarioDecisionContext | undefined {
  const candidate = supportingData.scenarioContext;
  return isScenarioDecisionContext(candidate) ? candidate : undefined;
}
