import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { before, describe, test } from "node:test";

import { buildHistoryResponse } from "@/app/api/efos/_shared/HistoryResponse";
import { DefaultEFOSContainer } from "@/efos/application/composition";
import {
  executionPeriodOf,
  resolvePeriodVersion,
  resolvePreviousPeriodComparison,
  selectLatestPeriodExecution,
  type HistoricalExecution,
} from "@/efos/application/history";
import type { ExecutionRepository, ExecutionSnapshot } from "@/efos/application/persistence";
import { buildExecutiveSituation } from "@/modules/analysis/lib/executive-situation";
import { describeMetricChange } from "@/modules/analysis/lib/metric-change";
import { comparisonUnavailableText } from "@/modules/analysis/lib/temporal-comparison-language";
import type { CompanyOverview } from "@/modules/dashboard/lib/executive-overview";
import { buildPortfolioCommand } from "@/modules/dashboard/lib/portfolio-command";
import { buildReportIndex } from "@/modules/reports/lib/report-index";
import { buildReportReading } from "@/modules/reports/lib/report-reading";

import { monthly, pointInTime } from "./fixtures/temporal-fixtures";

/**
 * Mission 209 — Canonical Temporal Comparison Alignment (D-134).
 *
 * Uma regra só: comparar o período atual com o período imediatamente
 * anterior DISPONÍVEL (Missions 171/174/175R, D-133), nunca com a execução
 * imediatamente anterior. Reanálise do mesmo período = versão. Histórico
 * anterior ambíguo = comparação ambígua, sem delta fabricado. Fixtures pelo
 * pipeline real (`fixtures/temporal-fixtures.ts`); sem rede, sem banco.
 */

const ROOT = process.cwd();

function idOf(resolution: ReturnType<typeof resolvePreviousPeriodComparison>): string | undefined {
  return resolution.outcome === "resolved" ? resolution.baseline.executionId : undefined;
}

function netMarginChange(history: readonly HistoricalExecution[]) {
  return buildExecutiveSituation(history)?.headline.find((metric) => metric.name === "Margem Líquida")?.change;
}

const EMPTY_LINEAGE = {
  diagnoses: [],
  reviewsByDiagnosis: {},
  decisions: [],
  executionEvents: [],
  outcomes: [],
  financialObservations: [],
  learningRecords: [],
  knowledge: [],
  stateAsOf: "2026-10-03T12:00:00.000Z",
};

class InMemoryExecutionRepository implements ExecutionRepository {
  constructor(private readonly snapshots: readonly ExecutionSnapshot[]) {}
  async save(): Promise<void> {
    throw new Error("somente leitura neste teste");
  }
  async findByExecutionId(executionId: string) {
    return this.snapshots.find((snapshot) => snapshot.execution.pipelineContext.executionId === executionId);
  }
  async findByCompany(companyId: string) {
    return this.snapshots.filter((snapshot) => snapshot.execution.pipelineContext.companyId === companyId);
  }
}

interface Matrix {
  readonly a: readonly HistoricalExecution[];
  readonly b: readonly HistoricalExecution[];
  readonly c: readonly HistoricalExecution[];
  readonly d: readonly HistoricalExecution[];
  readonly e: readonly HistoricalExecution[];
  readonly f: readonly HistoricalExecution[];
  readonly g: readonly HistoricalExecution[];
  readonly hX: readonly HistoricalExecution[];
  readonly hY: readonly HistoricalExecution[];
  readonly late: readonly HistoricalExecution[];
}

let m: Matrix;

before(async () => {
  // A. jan → fev
  const a = [await monthly("m209-a", "01", 0.45), await monthly("m209-a", "02", 0.55)];
  // B. jan → fev v1 → fev v2 (mesmos documentos, executada depois)
  const b = [await monthly("m209-b", "01", 0.45), await monthly("m209-b", "02", 0.55, "v1"), await monthly("m209-b", "02", 0.55, "v2")];
  // C. jan → mar, sem fevereiro
  const c = [await monthly("m209-c", "01", 0.45), await monthly("m209-c", "03", 0.5)];
  // D. fev com três versões equivalentes, depois mar
  const d = [
    await monthly("m209-d", "02", 0.5, "v1"),
    await monthly("m209-d", "02", 0.5, "v2"),
    await monthly("m209-d", "02", 0.5, "v3"),
    await monthly("m209-d", "03", 0.6),
  ];
  // E. jan com duas versões divergentes (documentos corrigidos), depois fev
  const e = [await monthly("m209-e", "01", 0.45, "v1"), await monthly("m209-e", "01", 0.6, "v2"), await monthly("m209-e", "02", 0.5)];
  // F. posições de um dia (só Balanço) em 31/01 e 28/02
  const f = [await pointInTime("m209-f", "01", 300_000), await pointInTime("m209-f", "02", 360_000)];
  // G. jan só com Balanço (resultado indisponível) → fev completo
  const g = [await pointInTime("m209-g", "01", 300_000), await monthly("m209-g", "02", 0.5)];
  // H. duas empresas com os mesmos períodos; X não tem janeiro
  const hY = [await monthly("m209-hy", "01", 0.45)];
  const hX = [await monthly("m209-hx", "02", 0.55)];
  // Reanálise de janeiro executada DEPOIS de fevereiro
  const late = [await monthly("m209-late", "01", 0.45, "v1"), await monthly("m209-late", "02", 0.55), await monthly("m209-late", "01", 0.45, "v2")];
  m = { a, b, c, d, e, f, g, hX, hY, late };
});

describe("Mission 209 — matriz temporal (resolver canônico)", () => {
  test("A. jan → fev: o período anterior de fevereiro é janeiro", () => {
    assert.equal(idOf(resolvePreviousPeriodComparison(m.a, m.a[1])), m.a[0].executionId);
    assert.equal(resolvePreviousPeriodComparison(m.a, m.a[0]).outcome, "first-period");
  });

  test("B. jan → fev v1 → fev v2: v2 compara com JANEIRO, nunca com fev v1; v1 e v2 são versões do mesmo período", () => {
    const [jan, febV1, febV2] = m.b;
    assert.equal(idOf(resolvePreviousPeriodComparison(m.b, febV2)), jan.executionId);
    assert.equal(idOf(resolvePreviousPeriodComparison(m.b, febV1)), jan.executionId);
    assert.deepEqual(resolvePeriodVersion(m.b, febV2), { state: "latest", versions: 2 });
    const earlier = resolvePeriodVersion(m.b, febV1);
    assert.equal(earlier.state, "earlier");
    if (earlier.state === "earlier") assert.equal(earlier.latestExecutionId, febV2.executionId);
    assert.equal(selectLatestPeriodExecution(m.b)?.executionId, febV2.executionId);

    // A variação mostrada é a de janeiro → fevereiro, não "estável" entre duas versões.
    const change = netMarginChange(m.b);
    assert.ok(change && change.directionLabel === "caiu" && change.deltaText === "-8,00 p.p.");
  });

  test("C. jan → mar sem fevereiro: o anterior é o imediatamente anterior DISPONÍVEL (janeiro)", () => {
    const resolution = resolvePreviousPeriodComparison(m.c, m.c[1]);
    assert.equal(idOf(resolution), m.c[0].executionId);
    assert.equal(buildExecutiveSituation(m.c)?.previousPeriod?.long, "janeiro de 2026");
  });

  test("D. três versões equivalentes do mesmo período colapsam; a mais recente é a versão atual", () => {
    const [v1, v2, v3, mar] = m.d;
    assert.equal(resolvePreviousPeriodComparison(m.d, mar).outcome, "resolved");
    assert.ok([v1, v2, v3].map((version) => version.executionId).includes(idOf(resolvePreviousPeriodComparison(m.d, mar))!));
    assert.deepEqual([v1, v2, v3].map((version) => resolvePeriodVersion(m.d, version).state), ["earlier", "earlier", "latest"]);
    assert.equal(selectLatestPeriodExecution(m.d.slice(0, 3))?.executionId, v3.executionId);
  });

  test("E. período anterior ambíguo: nenhuma versão é escolhida e nenhum delta é fabricado", () => {
    const feb = m.e[2];
    assert.equal(resolvePreviousPeriodComparison(m.e, feb).outcome, "ambiguous");
    const situation = buildExecutiveSituation(m.e)!;
    assert.equal(situation.comparisonState, "ambiguous");
    assert.equal(situation.previousPeriod, undefined);
    assert.equal(situation.movement, undefined);
    assert.ok(situation.headline.every((metric) => metric.change === undefined), "sem comparação, sem variação — nunca 0 ou 'estável'");
    assert.equal(comparisonUnavailableText(situation.comparisonState), "Comparação indisponível — histórico anterior ambíguo");
  });

  test("F. ponto-in-time: posição de 28/02 compara com a de 31/01, rotuladas pela data", () => {
    const [jan, feb] = m.f;
    assert.equal(idOf(resolvePreviousPeriodComparison(m.f, feb)), jan.executionId);
    const situation = buildExecutiveSituation(m.f)!;
    assert.equal(situation.period?.long, "28/02/2026");
    assert.equal(situation.previousPeriod?.long, "31/01/2026");
  });

  test("G. indicador indisponível no anterior: 'passou a estar disponível', nunca 0 p.p. nem 'estável'", () => {
    const change = netMarginChange(m.g);
    assert.ok(change);
    assert.equal(change.deltaText, undefined);
    assert.equal(change.directionLabel, "passou a estar disponível");
    assert.equal(change.desirability, "neutral");
  });

  test("H. outra empresa com os mesmos períodos nunca vira período anterior", () => {
    const mixed = [m.hY[0], m.hX[0]];
    assert.equal(resolvePreviousPeriodComparison(mixed, m.hX[0]).outcome, "first-period");
    assert.equal(resolvePeriodVersion(mixed, m.hX[0]).state, "latest");
  });

  test("reanálise de janeiro executada depois de fevereiro: a situação atual continua sendo fevereiro", () => {
    const [janV1, feb] = m.late;
    assert.equal(selectLatestPeriodExecution(m.late)?.executionId, feb.executionId);
    const situation = buildExecutiveSituation(m.late)!;
    assert.equal(situation.period?.long, "fevereiro de 2026");
    assert.equal(situation.previousPeriod?.long, "janeiro de 2026");
    assert.ok([janV1.executionId, m.late[2].executionId].includes(idOf(resolvePreviousPeriodComparison(m.late, feb))!));
  });
});

describe("Mission 209 — mesma resolução em todas as superfícies", () => {
  test("Visão geral, Dashboard, relatório, histórico da Análise e contexto da IA resolvem o mesmo período anterior", async () => {
    const [jan, , febV2] = m.b;

    // Visão geral
    const situation = buildExecutiveSituation(m.b)!;
    assert.equal(situation.period?.long, "fevereiro de 2026");
    assert.equal(situation.previousPeriod?.long, "janeiro de 2026");

    // Dashboard (mesma situação → tendência real, não "estável" entre versões)
    const company = { id: "m209-b", name: "B", href: "/companies/m209-b", lastAnalysisAt: febV2.executedAt } as unknown as CompanyOverview;
    const command = buildPortfolioCommand([{ company, situation }], 1);
    assert.equal(command.rows[0].trend, "worsening");
    assert.equal(command.rows[0].comparisonState, "resolved");

    // Relatório executivo da versão atual
    const reading = buildReportReading({ ...EMPTY_LINEAGE, history: m.b, current: febV2 })!;
    assert.equal(reading.comparisonLabel?.long, "janeiro de 2026");
    assert.equal(idOf(reading.comparison), jan.executionId);

    // Histórico da Análise (padrão, sem seleção)
    const history = buildHistoryResponse("m209-b", m.b);
    assert.equal(history.currentExecution?.executionId, febV2.executionId);
    assert.equal(history.previousExecution?.executionId, jan.executionId);
    assert.equal(history.comparisonBasis, "previous-period");
    assert.equal(history.comparison?.previousExecutionId, jan.executionId);

    // Contexto entregue à Executive AI (fachada real, repositório em memória)
    const facade = new DefaultEFOSContainer(new InMemoryExecutionRepository(m.b.map((execution) => execution.snapshot))).getFacade();
    const latest = await facade.getLatestExecutiveAnalysis("m209-b");
    assert.ok(latest.success && latest.value?.executiveContext);
    if (latest.success && latest.value?.executiveContext) {
      assert.equal(latest.value.executiveContext.historicalIntelligence?.comparison.previousExecutionId, jan.executionId);
    }
  });

  test("índice de relatórios: mesmas versões e mesmo período mais recente que a autoridade", () => {
    const entries = m.b.map((execution) => ({
      executionId: execution.executionId,
      companyId: execution.companyId,
      executedAt: execution.executedAt,
      generatedAt: execution.report?.metadata.generatedAt,
      period: executionPeriodOf(execution),
      summary: execution.report?.summary,
      hasReport: true,
    }));
    const [group] = buildReportIndex({ companies: [{ id: "m209-b", name: "B", status: "active" }], entries, diagnosisLinks: [] });
    for (const execution of m.b) {
      const row = group.rows.find((candidate) => candidate.executionId === execution.executionId)!;
      assert.equal(row.version, resolvePeriodVersion(m.b, execution).state);
    }
    assert.equal(group.rows.find((row) => row.isMostRecentPeriod && row.version === "latest")?.executionId, selectLatestPeriodExecution(m.b)?.executionId);
  });

  test("histórico: escolher outra versão do mesmo mês é 'diferença entre versões', sem melhora/piora", () => {
    const [, febV1, febV2] = m.b;
    const selected = buildHistoryResponse("m209-b", m.b, febV1.executionId);
    assert.equal(selected.comparisonBasis, "selected");
    assert.equal(selected.samePeriod, true);
    assert.equal(selected.currentExecution?.executionId, febV2.executionId);
    assert.ok((selected.comparison?.metrics.length ?? 0) > 0);
    for (const metric of selected.comparison?.metrics ?? []) {
      const change = describeMetricChange(metric, { temporal: false });
      assert.equal(change.desirabilityLabel, undefined);
      assert.ok(!["subiu", "caiu", "estável"].includes(change.directionLabel), "entre versões, nenhuma palavra de tempo");
    }
    assert.equal(selected.availableExecutions.find((summary) => summary.executionId === febV1.executionId)?.earlierVersion, true);
  });

  test("histórico sem período anterior comparável ou ambíguo: sem comparação padrão, com o motivo", () => {
    const first = buildHistoryResponse("m209-a", [m.a[0]]);
    assert.equal(first.comparison, undefined);
    assert.equal(first.previousPeriodState, "first-period");
    const ambiguous = buildHistoryResponse("m209-e", m.e);
    assert.equal(ambiguous.comparison, undefined);
    assert.equal(ambiguous.previousExecution, undefined);
    assert.equal(ambiguous.previousPeriodState, "ambiguous");
  });

  test("Dashboard não diz 'sem mudança' quando nenhuma empresa tem comparação", () => {
    const company = { id: "m209-hx", name: "X", href: "/companies/m209-hx", lastAnalysisAt: m.hX[0].executedAt } as unknown as CompanyOverview;
    const command = buildPortfolioCommand([{ company, situation: buildExecutiveSituation(m.hX) }], 1);
    assert.equal(command.rows[0].trend, "unknown");
    assert.equal(command.rows[0].comparisonState, "first-period");
    assert.match(command.headline, /nenhuma ainda com período anterior comparável/);
    assert.doesNotMatch(command.headline, /sem mudança/);
  });

  test("o período de cada execução é sempre o dos indicadores (nunca executedAt)", () => {
    for (const execution of [...m.b, ...m.f]) {
      assert.deepEqual(executionPeriodOf(execution), execution.snapshot.execution.indicators?.indicators[0]?.period);
    }
  });
});

describe("Mission 209 — uma única fonte de verdade temporal", () => {
  const files = ["app", "modules", "efos/application", "lib", "components"].flatMap((dir) => listFiles(join(ROOT, dir))).filter((file) => /\.(ts|tsx)$/.test(file));

  test("ninguém escolhe 'a execução imediatamente anterior' para comparar", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /history\.at\(-2\)|history\[history\.length - 2\]|priorExecutions\[priorExecutions\.length - 1\]/, file);
    }
  });

  test("compareExecutions só é chamado pela autoridade, pela escolha explícita do histórico e pela janela da decisão (Outcome)", () => {
    const callers = files
      .filter((file) => /compareExecutions\(/.test(withoutComments(readFileSync(file, "utf8"))))
      .map((file) => file.slice(ROOT.length + 1).replace(/\\/g, "/"))
      .filter((file) => file !== "efos/application/history/compareExecutions.ts")
      .sort();
    assert.deepEqual(callers, [
      "app/api/efos/_shared/HistoryResponse.ts",
      "efos/application/financial-observation/buildFinancialOutcomeObservation.ts",
      "efos/application/history/resolveTemporalComparison.ts",
    ]);
  });

  test("a regra não mora mais no módulo visual de relatórios", () => {
    const reportsCode = listFiles(join(ROOT, "modules", "reports")).filter((file) => /\.(ts|tsx)$/.test(file));
    assert.ok(!reportsCode.some((file) => file.endsWith("report-period.ts")));
    for (const file of reportsCode) {
      assert.doesNotMatch(withoutComments(readFileSync(file, "utf8")), /buildCanonicalPriorPeriods|compareExecutions\(/, file);
    }
  });
});

/** Código sem comentários — menções a uma função em documentação não são chamadas. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
