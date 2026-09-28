import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { HistoricalExecution } from "@/efos/application/history";
import type { ExecutiveReport } from "@/efos/application/report";
import { isLocalSyntheticAiEnabled, LOCAL_SYNTHETIC_AI_PROVIDER_NAME } from "@/lib/ai/executive-ai-providers";
import { formatEngineText } from "@/modules/analysis/lib/engine-text";
import { buildExecutiveSituation } from "@/modules/analysis/lib/executive-situation";
import { describeMetricChange, metricDesirability } from "@/modules/analysis/lib/metric-change";
import { formatPeriodLabel } from "@/modules/analysis/lib/period-label";
import { availableWorkspaceViews, companyWorkspaceHref, resolveWorkspaceView } from "@/modules/companies/lib/workspace-views";
import { isValidCnpj } from "@/modules/companies/utils/cnpj";
import { buildPortfolioCommand } from "@/modules/dashboard/lib/portfolio-command";
import type { CompanyOverview } from "@/modules/dashboard/lib/executive-overview";
import { buildReferenceLabels, resolveReference } from "@/modules/decisions/lib/diagnosis-references";
import { syntheticCnpj, VISUAL_FIXTURES } from "@/scripts/visual-fixtures/seed-local";

/**
 * Mission 204 — Premium Experience & Visual Excellence.
 *
 * Fixa as regras de apresentação introduzidas: workspace em visões,
 * sistema de números (direção sempre em texto; "melhora/piora" só onde o
 * EFOS classifica), situação executiva sem dado fabricado, proveniência
 * legível do diagnóstico (nenhum id técnico como UX), texto dos Engines
 * em pt-BR sem mudar a redação, comando do portfólio, IA sintética
 * estritamente local e a correção do aviso de hidratação.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(`${dir}/${entry.name}`) : /\.tsx?$/.test(entry.name) ? [`${dir}/${entry.name}`] : []
  );
}

// ---------- fixtures mínimas (formato real do ExecutiveReport) ----------
const PERIOD = { startDate: "2026-08-01T00:00:00.000Z", endDate: "2026-08-31T23:59:59.000Z" };
const PREVIOUS = { startDate: "2026-07-01T00:00:00.000Z", endDate: "2026-07-31T23:59:59.000Z" };

function indicator(name: string, unit: string, value: number | null, period = PERIOD) {
  return {
    id: `indicator-${name}`,
    companyId: "c",
    financialModelId: "m",
    name,
    category: "profitability",
    unit,
    period,
    formula: "",
    result: value === null ? { status: "unavailable", reason: "insufficient_data" } : { status: "available", value },
  };
}

function execution(id: string, indicators: unknown[], extra: unknown[] = []): HistoricalExecution {
  const report = {
    metadata: { companyId: "c", executionId: id, generatedAt: "2026-09-01T00:00:00.000Z" },
    summary: {},
    sections: [{ type: "indicators", title: "Indicadores", indicators: { indicators } }, ...extra],
  } as unknown as ExecutiveReport;
  return { executionId: id, companyId: "c", executedAt: "2026-09-01T00:00:00.000Z", report, snapshot: {} } as unknown as HistoricalExecution;
}

const evidenceSection = {
  type: "evidence",
  title: "Evidências",
  evidence: {
    evidences: [
      { id: "e1", type: "negative", severity: "medium", confidence: "verified", title: "Margem Líquida negativa", description: "A Margem Líquida (-4.26%) está negativa.", sources: [] },
      { id: "e2", type: "negative", severity: "high", confidence: "verified", title: "Declínio sustentado", description: "De 2026-05-01T00:00:00.000Z a 2026-08-31T23:59:59.000Z.", sources: [] },
      { id: "e3", type: "positive", severity: "low", confidence: "high", title: "Caixa confortável", description: "ok", sources: [] },
    ],
  },
};

describe("Mission 204 — workspace da empresa em visões", () => {
  test("antes da primeira análise: só documentos, análise, decisões e cadastro; padrão = documentos", () => {
    assert.deepEqual(availableWorkspaceViews(false).map((view) => view.id), ["documentos", "analise", "decisoes", "cadastro"]);
    assert.equal(resolveWorkspaceView(undefined, false), "documentos");
    assert.equal(resolveWorkspaceView("cenarios", false), "documentos", "visão indisponível cai no padrão");
  });

  test("depois da primeira análise: visão geral é o padrão; visão inválida nunca quebra", () => {
    assert.equal(resolveWorkspaceView(undefined, true), "visao-geral");
    assert.equal(resolveWorkspaceView("decisoes", true), "decisoes");
    assert.equal(resolveWorkspaceView("<script>", true), "visao-geral");
    assert.equal(companyWorkspaceHref("abc", "conhecimento"), "/companies/abc?secao=conhecimento");
  });

  test("nenhum link interno aponta mais para as âncoras antigas da página única", () => {
    const offenders = ["app", "modules"]
      .flatMap(sourceFiles)
      .filter((path) => /href=\{?[`"'][^`"']*#(analise|diagnostico-executivo|scenario-lab|executive-chat|decision-center)/.test(read(path)));
    assert.deepEqual(offenders, []);
  });
});

describe("Mission 204 — sistema de números", () => {
  test("melhora/piora só para métricas que o EFOS classifica (D-087); o resto é neutro", () => {
    assert.equal(metricDesirability("Margem Líquida", "decreased"), "unfavorable");
    assert.equal(metricDesirability("Margem Líquida", "increased"), "favorable");
    assert.equal(metricDesirability("Prazo Médio de Recebimento", "increased"), "unfavorable");
    assert.equal(metricDesirability("Endividamento Geral", "increased"), "neutral", "a UI não inventa juízo");
    assert.equal(metricDesirability("Margem Bruta", "unchanged"), "neutral");
  });

  test("direção sempre em texto e símbolo; ausência nunca vira zero", () => {
    const worse = describeMetricChange({ metricName: "Margem Bruta", previousValue: 31.2, currentValue: 27.35, absoluteChange: -3.85, direction: "decreased", unit: "percentage" });
    assert.equal(worse.symbol, "↓");
    assert.equal(worse.deltaText, "-3,85 p.p.");
    assert.equal(worse.desirabilityLabel, "Piora");
    assert.match(worse.accessibleText, /Margem Bruta: 27,35%, antes 31,20%, caiu -3,85 p\.p\., piora/);

    const appeared = describeMetricChange({ metricName: "Cobertura de Juros", currentValue: 0.81, direction: "became-available", unit: "ratio" });
    assert.equal(appeared.previousText, "—");
    assert.equal(appeared.deltaText, undefined);
    assert.equal(appeared.symbol, "", "sem direção, sem símbolo solto — o texto diz o que houve");
    assert.equal(appeared.directionLabel, "passou a estar disponível");
  });

  test("variação menor que 1 dia mantém uma casa — nunca \"+0 dias\" para mudança real", () => {
    const change = describeMetricChange({ metricName: "Prazo Médio de Estoque", previousValue: 12.7, currentValue: 13.0, absoluteChange: 0.3, direction: "increased", unit: "days" });
    assert.equal(change.deltaText, "+0,3 dia");
  });

  test("período rotulado pelo mês analisado", () => {
    assert.deepEqual(formatPeriodLabel(PERIOD), { long: "agosto de 2026", short: "ago/2026" });
    assert.deepEqual(
      formatPeriodLabel({ startDate: "2026-08-01T00:00:00.000Z", endDate: "2026-08-15T23:59:59.000Z" }).short,
      "01/08–15/08/2026"
    );
  });

  test("texto dos Engines: só a forma de datas ISO e decimais muda, nunca a redação", () => {
    assert.equal(
      formatEngineText("Queda de 2026-05-01T00:00:00.000Z a 2026-08-31T23:59:59.000Z; saídas (505000.00) e margem (-4.26%)."),
      "Queda de 01/05/2026 a 31/08/2026; saídas (505.000,00) e margem (-4,26%)."
    );
    assert.equal(formatEngineText("Versão 0.1.0 e 3 períodos."), "Versão 0.1.0 e 3 períodos.");
  });
});

describe("Mission 204 — situação executiva: só o que o EFOS produziu", () => {
  const previous = execution("p", [indicator("Margem Líquida", "percentage", 1.43, PREVIOUS), indicator("Liquidez Corrente", "ratio", 1.99, PREVIOUS)]);
  const current = execution(
    "c",
    [indicator("Margem Líquida", "percentage", -4.26), indicator("Liquidez Corrente", "ratio", 1.85), indicator("Endividamento Geral", "percentage", null)],
    [evidenceSection]
  );

  test("sem análise: nenhuma situação (nunca métricas zeradas)", () => {
    assert.equal(buildExecutiveSituation([]), undefined);
  });

  test("uma análise: valores, sem variação e sem movimento", () => {
    const situation = buildExecutiveSituation([current])!;
    assert.equal(situation.previousPeriod, undefined);
    assert.equal(situation.movement, undefined);
    assert.equal(situation.headline.find((metric) => metric.name === "Margem Líquida")?.change, undefined);
  });

  test("duas análises: período, variação canônica e contagem de piora; indisponível continua indisponível", () => {
    const situation = buildExecutiveSituation([previous, current])!;
    assert.equal(situation.period?.long, "agosto de 2026");
    assert.equal(situation.previousPeriod?.long, "julho de 2026");
    assert.deepEqual(situation.movement, { improved: 0, worsened: 2 });
    const debt = situation.headline.find((metric) => metric.name === "Endividamento Geral");
    assert.ok(debt && debt.valueText === undefined, "indisponível nunca vira zero");
  });

  test("sinais: adversos primeiro, mais graves primeiro; texto do Engine formatado", () => {
    const situation = buildExecutiveSituation([previous, current])!;
    assert.deepEqual(situation.signals.map((signal) => signal.id), ["e2", "e1", "e3"]);
    assert.equal(situation.signals[1].description, "A Margem Líquida (-4,26%) está negativa.");
  });
});

describe("Mission 204 — comando do portfólio", () => {
  const company = (id: string, lastAnalysisAt: string | null) =>
    ({ id, name: id.toUpperCase(), href: `/companies/${id}`, stage: "analysis_available", stageLabel: "x", stageTone: "info", lastAnalysisAt, signals: { status: "none" }, documentsCount: 1, decisionsCount: 0, nextStep: { label: "x", href: "#" } }) as CompanyOverview;

  test("frase de situação só de contagens; empresa sem análise é dita como tal", () => {
    const previous = execution("p", [indicator("Margem Líquida", "percentage", 1.43, PREVIOUS)]);
    const current = execution("c", [indicator("Margem Líquida", "percentage", -4.26)], [evidenceSection]);
    const command = buildPortfolioCommand(
      [
        { company: company("gama", "2026-09-01"), situation: buildExecutiveSituation([previous, current]), decisions: { pending: 6, decided: 1, concluded: 1, pendingItems: [], knowledgeCount: 1 } },
        { company: company("omega", null) },
      ],
      2
    );
    assert.equal(command.headline, "Das 2 empresas ativas, 1 piorou desde a análise anterior. 1 ainda não tem análise. 6 itens aguardam sua decisão.");
    assert.equal(command.rows[1].trend, "unknown");
    assert.equal(command.rows[1].netMargin, undefined);
    assert.deepEqual(command.priorities.map((priority) => priority.signal.id), ["e2", "e1"], "sinal favorável não é prioridade");
    assert.equal(command.priorities[0].href, "/companies/gama?secao=analise");
  });
});

describe("Mission 204 — proveniência legível do diagnóstico", () => {
  test("ids viram os nomes da análise de origem; id desconhecido é sinalizado, nunca renomeado", () => {
    const report = execution("c", [indicator("Liquidez Corrente", "ratio", 1.85)], [evidenceSection]).report;
    const labels = buildReferenceLabels(report, [{ id: "k1", statement: "Padrão histórico" }]);
    assert.deepEqual(resolveReference(labels, "indicator", "indicator-Liquidez Corrente"), { kind: "indicator", label: "Liquidez Corrente", resolved: true });
    assert.equal(resolveReference(labels, "evidence", "e1").label, "Margem Líquida negativa");
    assert.equal(resolveReference(labels, "knowledge", "k1").label, "Padrão histórico");
    const missing = resolveReference(labels, "context", "context-x");
    assert.equal(missing.resolved, false);
    assert.doesNotMatch(missing.label, /context-x/);
  });

  test("a visão do diagnóstico não renderiza ids crus como texto principal", () => {
    const view = read("modules/decisions/components/ExecutiveDiagnosisView.tsx");
    assert.doesNotMatch(view, /\{item\.kind\}: \{item\.id\}/);
    assert.match(view, /resolveReference\(/);
  });
});

describe("Mission 204 — IA sintética somente local", () => {
  const local = { NODE_ENV: "development", NEXO_LOCAL_SYNTHETIC_AI: "1", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };

  test("liga só com as três condições; nunca em produção nem contra host remoto", () => {
    assert.equal(isLocalSyntheticAiEnabled(local), true);
    assert.equal(isLocalSyntheticAiEnabled({ ...local, NODE_ENV: "production" }), false);
    assert.equal(isLocalSyntheticAiEnabled({ ...local, NEXO_LOCAL_SYNTHETIC_AI: undefined }), false);
    assert.equal(isLocalSyntheticAiEnabled({ ...local, NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" }), false);
    assert.equal(isLocalSyntheticAiEnabled({ ...local, NEXT_PUBLIC_SUPABASE_URL: "não é url" }), false);
    assert.equal(LOCAL_SYNTHETIC_AI_PROVIDER_NAME, "nexo-local-synthetic-ai");
  });

  test("as actions de diagnóstico e chat passam pela fábrica — nenhum provider instanciado direto", () => {
    for (const path of ["modules/decisions/actions/executive-diagnosis.actions.ts", "modules/executive-chat/actions/executive-chat.actions.ts"]) {
      const source = read(path);
      assert.doesNotMatch(source, /new Anthropic/, path);
      assert.match(source, /create(Executive(AI|Chat))Provider\(\)/, path);
    }
  });

  test("seed visual: CNPJs sintéticos válidos e recusa fora de localhost", () => {
    for (const fixture of VISUAL_FIXTURES) assert.ok(isValidCnpj(syntheticCnpj(fixture.cnpjBase)), fixture.company.razao_social);
    const seed = read("scripts/visual-fixtures/seed-local.ts");
    assert.match(seed, /host !== "127\.0\.0\.1" && host !== "localhost"/);
    assert.doesNotMatch(seed, /AUREA|ORION|NEXUS/);
  });
});

describe("Mission 204 — acessibilidade dos formulários", () => {
  test("todo SelectTrigger tem nome acessível (id ligado a um label ou aria-label)", () => {
    const offenders = ["app", "modules"]
      .flatMap(sourceFiles)
      .filter((path) => path.endsWith(".tsx"))
      .flatMap((path) =>
        read(path)
          .split("\n")
          .map((line, index) => ({ line, at: `${path}:${index + 1}` }))
          .filter(({ line }) => line.includes("<SelectTrigger") && !/\b(id|aria-label)=/.test(line))
          .map(({ at }) => at)
      );
    assert.deepEqual(offenders, []);
  });
});

describe("Mission 204 — hidratação do gatilho de Sheet", () => {
  test("Button é client component: o elemento passado a `render` chega com as props originais no SSR e no cliente", () => {
    assert.match(read("components/ui/button.tsx"), /^"use client"/);
  });
});

describe("Mission 204 — acabamento da revisão visual", () => {
  test("nenhum plural por parênteses (\"avaliação(ões)\") nas superfícies redesenhadas", () => {
    const offenders = ["modules/analysis/components", "modules/decisions/components", "modules/companies/components", "modules/dashboard"]
      .flatMap(sourceFiles)
      .filter((path) => /\p{L}\((s|es|ões)\)/u.test(read(path)));
    assert.deepEqual(offenders, []);
  });

  test("com resultado já registrado, a ação de registrar outro continua disponível (recolhida)", () => {
    const card = read("modules/decisions/components/DecisionExecutionCard.tsx");
    assert.match(card, /outcomes\.length > 0 \? \(\s*<details/);
    assert.match(card, /Registrar outro resultado/);
    assert.match(card, /onClick=\{submitOutcome\}/);
  });

  test("trajetória: intervalo do episódio e contagem de períodos têm rótulos distintos", () => {
    const panel = read("modules/analysis/components/ExecutiveTrajectoryPanel.tsx");
    assert.match(panel, /Observado em \$\{range\}/);
    assert.match(panel, /períodos analisados/);
  });
});
