import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { ExecutiveReportSectionType } from "@/efos/application/report";
import { FINANCIAL_EVENT_TYPES, RESOURCE_TYPES } from "@/efos/domain";
import { QueryError, queryFailure } from "@/lib/supabase/query-error";
import {
  ANALYSIS_DOCUMENT_INPUT_MESSAGE,
  ANALYSIS_UNEXPECTED_MESSAGE,
  EXECUTIVE_AI_UNAVAILABLE_MESSAGE,
  EXECUTIVE_CHAT_UNAVAILABLE_MESSAGE,
  EXECUTIVE_CHAT_UNEXPECTED_MESSAGE,
  presentAnalysisError,
  presentExecutiveAiError,
  presentExecutiveChatProviderError,
} from "@/modules/analysis/lib/analysis-error-message";
import {
  INSIGHT_KIND_META,
  INSIGHT_LAYER_LABELS,
  confidenceTag,
  priorityTag,
  sectionKind,
  sectionLayer,
  severityTag,
} from "@/modules/analysis/lib/insight-semantics";
import { FINANCIAL_EVENT_TYPE_LABELS, RESOURCE_TYPE_LABELS } from "@/modules/analysis/lib/recordTypeLabels";
import {
  buildExecutiveOverview,
  type CompanyOverviewInput,
  type PortfolioInput,
} from "@/modules/dashboard/lib/executive-overview";
import {
  describeRouteContext,
  isNavItemActive,
  navItemsByGroup,
  workspaceNavGroups,
  workspaceNavigation,
} from "@/modules/workspace/config/navigation";

/**
 * Mission 203 — Premium Product Experience & Design System.
 *
 * A missão muda apresentação, não semântica. Estes testes fixam as
 * regras de honestidade da nova camada de UI: nenhuma rota perdida,
 * nenhuma ausência de dado apresentada como zero, nenhum enum interno
 * vazando cru, a hierarquia "o que sabemos" → "o que o EFOS infere"
 * coerente com a ordem real do relatório, mensagens técnicas recolhidas
 * (nunca descartadas) e as confirmações destrutivas das Missions
 * 202/202B intactas.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("Mission 203 — navegação executiva", () => {
  test("as rotas da navegação são as mesmas de antes e cada uma existe no App Router", () => {
    assert.deepEqual(
      workspaceNavigation.map((item) => item.href).sort(),
      ["/companies", "/dashboard", "/diagnostics", "/documents", "/reports", "/settings"]
    );
    for (const item of workspaceNavigation) {
      assert.ok(existsSync(join(ROOT, "app", "(app)", item.href, "page.tsx")), `rota ausente: ${item.href}`);
    }
  });

  test("todo item pertence a um grupo declarado e os grupos cobrem a navegação inteira", () => {
    const groupIds = workspaceNavGroups.map((group) => group.id);
    for (const item of workspaceNavigation) assert.ok(groupIds.includes(item.group), item.href);
    const grouped = workspaceNavGroups.flatMap((group) => navItemsByGroup(group.id));
    assert.equal(grouped.length, workspaceNavigation.length);
  });

  test("somente capacidades ainda indisponíveis são marcadas como 'em breve'", () => {
    assert.deepEqual(
      workspaceNavigation.filter((item) => item.status === "soon").map((item) => item.href).sort(),
      ["/reports", "/settings"]
    );
  });

  test("item ativo na própria rota e em sub-rotas, sem falso positivo por prefixo", () => {
    assert.ok(isNavItemActive("/companies", "/companies"));
    assert.ok(isNavItemActive("/companies/abc", "/companies"));
    assert.ok(!isNavItemActive("/companiesx", "/companies"));
    assert.ok(!isNavItemActive("/dashboard", "/companies"));
  });

  test("contexto do cabeçalho para rotas dentro e fora da navegação", () => {
    assert.deepEqual(describeRouteContext("/dashboard"), { section: "Visão executiva" });
    assert.deepEqual(describeRouteContext("/companies"), { section: "Empresas" });
    assert.deepEqual(describeRouteContext("/companies/abc"), { section: "Empresas", page: "Empresa" });
    assert.deepEqual(describeRouteContext("/companies/closed"), { section: "Empresas", page: "Empresas encerradas" });
    assert.deepEqual(describeRouteContext("/operator/offboarding"), { section: "Operação NEXO", page: "Offboarding" });
    assert.deepEqual(describeRouteContext("/diagnostics"), { section: "Central de Decisões" });
    assert.deepEqual(describeRouteContext("/rota-desconhecida"), { section: "NEXO" });
  });
});

describe("Mission 203 — hierarquia epistêmica do relatório", () => {
  // Ordem REAL de construção das seções em DefaultReportService (Mission 065).
  const sourceOrder = [
    ...read("efos/application/services/DefaultReportService.ts").matchAll(/^\s+type: "(\w+)",$/gm),
  ].map((match) => match[1] as ExecutiveReportSectionType);

  test("toda seção produzida pelo serviço tem natureza e camada definidas", () => {
    assert.equal(new Set(sourceOrder).size, 12, `seções encontradas: ${sourceOrder.join(", ")}`);
    for (const type of sourceOrder) {
      assert.ok(INSIGHT_KIND_META[sectionKind(type)], type);
    }
  });

  test("na ordem real do relatório, tudo o que é conhecido vem antes de tudo o que é inferido", () => {
    const layers = sourceOrder.map(sectionLayer);
    const firstInferred = layers.indexOf("inferred");
    assert.ok(firstInferred > 0);
    assert.ok(layers.slice(firstInferred).every((layer) => layer === "inferred"), layers.join(" → "));
  });

  test("evidência é conhecimento; interpretação, hipótese, recomendação e proposta são inferência", () => {
    assert.equal(sectionLayer("evidence"), "known");
    assert.equal(sectionLayer("indicators"), "known");
    assert.equal(sectionLayer("balanceSheet"), "known");
    for (const type of ["context", "reasoning", "recommendation", "decision"] as const) {
      assert.equal(sectionLayer(type), "inferred", type);
    }
    assert.equal(INSIGHT_LAYER_LABELS.known.title, "O que sabemos");
    assert.equal(INSIGHT_LAYER_LABELS.inferred.title, "O que o EFOS infere");
  });

  test("rótulos de severidade, confiança e prioridade em português, sem enum cru", () => {
    assert.deepEqual(severityTag("critical"), { label: "Severidade crítica", tone: "negative" });
    assert.deepEqual(severityTag("high"), { label: "Severidade alta", tone: "warning" });
    assert.deepEqual(confidenceTag("verified"), { label: "Confiança verificada", tone: "neutral" });
    assert.deepEqual(priorityTag("medium"), { label: "Prioridade média", tone: "info" });
    for (const value of ["low", "medium", "high", "critical", "very_high", "weak", "moderate", "verified"]) {
      for (const tag of [severityTag(value), confidenceTag(value), priorityTag(value)]) {
        assert.doesNotMatch(tag.label, /_|\b(low|medium|high|critical|weak|moderate|verified)\b/, tag.label);
      }
    }
    // Valor desconhecido: nunca com sublinhado, tom neutro.
    assert.deepEqual(severityTag("novo_valor"), { label: "Severidade novo valor", tone: "neutral" });
  });
});

describe("Mission 203 — rótulos de registros financeiros", () => {
  test("todo ResourceType e FinancialEventType do domínio tem rótulo executivo", () => {
    for (const type of RESOURCE_TYPES) {
      const label = RESOURCE_TYPE_LABELS[type];
      assert.ok(label && label !== type && !label.includes("_"), `ResourceType sem rótulo: ${type}`);
    }
    for (const type of FINANCIAL_EVENT_TYPES) {
      const label = FINANCIAL_EVENT_TYPE_LABELS[type];
      assert.ok(label && label !== type && !label.includes("_"), `FinancialEventType sem rótulo: ${type}`);
    }
  });
});

describe("Mission 203 — visão executiva: nada fabricado, ausência nunca é zero", () => {
  const portfolio: PortfolioInput = { activeCount: 5, archivedCount: 1, closedCount: 2 };
  const base = {
    documentsCount: 0,
    analyzableDocumentsCount: 0,
    executionsCount: 0,
    diagnosesCount: 0,
    decisionsCount: 0,
    latestAnalysis: null,
  } satisfies Omit<CompanyOverviewInput, "id" | "name">;
  const summary = {
    indicatorsCount: 9,
    evidenceCount: 4,
    contextCount: 2,
    reasoningCount: 1,
    recommendationCount: 3,
    decisionCount: 2,
  };

  const inputs: CompanyOverviewInput[] = [
    { ...base, id: "c-empty", name: "Sem documentos" },
    { ...base, id: "c-ready", name: "Pronta", documentsCount: 2, analyzableDocumentsCount: 2 },
    { ...base, id: "c-legacy", name: "Execução antiga", documentsCount: 2, analyzableDocumentsCount: 2, executionsCount: 1, latestAnalysis: { generatedAt: "2026-07-31T12:00:00.000Z", summary: null } },
    { ...base, id: "c-diag", name: "Com diagnóstico", documentsCount: 3, analyzableDocumentsCount: 3, executionsCount: 2, diagnosesCount: 1, decisionsCount: 1, latestAnalysis: { generatedAt: "2026-08-01T12:00:00.000Z", summary } },
  ];
  const overview = buildExecutiveOverview(portfolio, inputs);
  const byId = (id: string) => overview.companies.find((company) => company.id === id)!;

  test("sem análise: nenhuma data e sinais 'none' — nunca contagens zeradas", () => {
    assert.equal(byId("c-empty").lastAnalysisAt, null);
    assert.deepEqual(byId("c-empty").signals, { status: "none" });
    assert.deepEqual(byId("c-ready").signals, { status: "none" });
  });

  test("análise persistida sem summary: sinais INDISPONÍVEIS, não zero", () => {
    const legacy = byId("c-legacy");
    assert.deepEqual(legacy.signals, { status: "unavailable" });
    assert.equal(legacy.lastAnalysisAt, "2026-07-31T12:00:00.000Z");
  });

  test("summary real: contagens repassadas; interpretações = contexto + raciocínio", () => {
    assert.deepEqual(byId("c-diag").signals, {
      status: "available",
      evidence: 4,
      interpretations: 3,
      recommendations: 3,
      proposals: 2,
    });
  });

  test("summary com zeros reais continua 'available' — zero medido é diferente de indisponível", () => {
    const zeros = { ...summary, evidenceCount: 0, contextCount: 0, reasoningCount: 0, recommendationCount: 0, decisionCount: 0 };
    const [company] = buildExecutiveOverview(portfolio, [
      { ...inputs[3], latestAnalysis: { generatedAt: "2026-08-02T12:00:00.000Z", summary: zeros } },
    ]).companies;
    assert.deepEqual(company.signals, { status: "available", evidence: 0, interpretations: 0, recommendations: 0, proposals: 0 });
  });

  test("estágio e próximo passo derivados do resolvedor canônico de ativação", () => {
    assert.equal(byId("c-empty").stageLabel, "Aguardando documentos");
    assert.deepEqual(byId("c-empty").nextStep, { label: "Enviar documentos", href: "/documents?companyId=c-empty" });
    assert.deepEqual(byId("c-ready").nextStep, { label: "Executar análise", href: "/companies/c-ready#analise" });
    assert.deepEqual(byId("c-legacy").nextStep, { label: "Gerar diagnóstico", href: "/companies/c-legacy#diagnostico-executivo" });
    assert.equal(byId("c-diag").stageLabel, "Diagnóstico disponível");
  });

  test("atenção: o que bloqueia primeiro; empresa com diagnóstico não gera alerta", () => {
    assert.deepEqual(
      overview.attention.map((item) => item.companyId),
      ["c-ready", "c-legacy", "c-empty"]
    );
  });

  test("empresas ativas além das exibidas são contadas, nunca escondidas em silêncio", () => {
    assert.equal(overview.hiddenActiveCount, 1);
    assert.deepEqual(overview.portfolio, portfolio);
  });
});

describe("Mission 203 — mensagens executivas com detalhe técnico preservado", () => {
  test("validação interna de Engine vira orientação executiva; o texto original fica como detalhe", () => {
    const raw = 'Entrada invalida para o Financial Model Engine. records[5]: occurredAt e obrigatorio quando kind="event"';
    assert.deepEqual(presentAnalysisError(raw), { message: ANALYSIS_DOCUMENT_INPUT_MESSAGE, technicalDetail: raw });
  });

  test("falha de rede e ausência de mensagem têm texto próprio", () => {
    assert.equal(presentAnalysisError("TypeError: Failed to fetch").technicalDetail, "TypeError: Failed to fetch");
    assert.match(presentAnalysisError("TypeError: Failed to fetch").message, /Sem conexão/);
    assert.deepEqual(presentAnalysisError(undefined), { message: ANALYSIS_UNEXPECTED_MESSAGE });
    assert.deepEqual(presentAnalysisError("   "), { message: ANALYSIS_UNEXPECTED_MESSAGE });
  });

  test("mensagem já executiva passa sem alteração", () => {
    assert.deepEqual(presentAnalysisError("Nenhum documento analisável."), { message: "Nenhum documento analisável." });
  });

  test("falha do provedor de IA não expõe provedor nem variável de ambiente", () => {
    const raw = "Provider anthropic indisponível: ANTHROPIC_API_KEY inválida";
    const presented = presentExecutiveAiError(raw);
    assert.equal(presented.message, EXECUTIVE_AI_UNAVAILABLE_MESSAGE);
    assert.equal(presented.technicalDetail, raw);
    assert.doesNotMatch(presented.message, /anthropic|api[_ ]key/i);
    assert.deepEqual(presentExecutiveAiError(undefined), { message: EXECUTIVE_AI_UNAVAILABLE_MESSAGE, technicalDetail: undefined });
    const failed = 'Provider "anthropic" falhou ao processar a solicitação.';
    assert.deepEqual(presentExecutiveAiError(failed), { message: EXECUTIVE_AI_UNAVAILABLE_MESSAGE, technicalDetail: failed });
  });

  test("diagnóstico: causa que não é indisponibilidade do provedor continua visível (Mission 128)", () => {
    assert.deepEqual(presentExecutiveAiError("Sessão expirada. Faça login novamente."), {
      message: "Sessão expirada. Faça login novamente.",
    });
  });

  test("Executive Chat, estágio do provedor: texto interno vira detalhe recolhido, nunca descartado", () => {
    const keyMissing = "ANTHROPIC_API_KEY não configurada — o provider Anthropic não pode ser chamado sem uma chave de API válida.";
    assert.deepEqual(presentExecutiveChatProviderError(keyMissing), {
      message: EXECUTIVE_CHAT_UNAVAILABLE_MESSAGE,
      technicalDetail: keyMissing,
    });
    const shape = "A resposta do modelo não tem a forma mínima esperada. Campos ausentes/inválidos: answer.";
    assert.deepEqual(presentExecutiveChatProviderError(shape), {
      message: EXECUTIVE_CHAT_UNEXPECTED_MESSAGE,
      technicalDetail: shape,
    });
    const panel = read("modules/executive-chat/components/ExecutiveChatPanel.tsx");
    assert.match(panel, /result\.stage === "provider"/);
    assert.match(panel, /<TechnicalDetail detail=\{errorDetail\} \/>/);
  });
});

describe("Mission 203 — erro de consulta observável (erro pós-login do /dashboard)", () => {
  test("HEAD com corpo vazio vira erro com contexto, status HTTP e código — não '{\"message\":\"\"}'", () => {
    const error = queryFailure("getCompanyCounts.total", { error: { message: "" }, status: 401 });
    assert.ok(error instanceof QueryError);
    assert.equal(error.message, "getCompanyCounts.total: consulta falhou (HTTP 401)");
    assert.equal(error.status, 401);
    assert.equal(error.code, null);
  });

  test("código do PostgREST é preservado; o texto do erro original (que pode conter dados) nunca é copiado", () => {
    const error = queryFailure("ctx", {
      error: { message: "valor 11111111-2222-4333-8444-555555555555 rejeitado", code: "PGRST303", details: "x" },
      status: 401,
    });
    assert.equal(error.message, "ctx: consulta falhou (HTTP 401, PGRST303)");
    assert.doesNotMatch(error.message, /1111|rejeitado/);
  });

  test("status ausente é explícito", () => {
    assert.equal(queryFailure("ctx", { error: null }).message, "ctx: consulta falhou (HTTP ?)");
  });
});

describe("Mission 203 — cor vem dos tokens semânticos", () => {
  const LOOSE_COLOR =
    /\b(?:text|bg|border|ring|fill|stroke)-(?:amber|emerald|green|red|yellow|blue|sky|slate|gray|zinc|orange|rose|violet|indigo|lime|teal|cyan|purple|pink|fuchsia)-\d{2,3}\b/;

  function sourceFiles(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  test("nenhum componente usa cor solta da paleta do Tailwind (docs/DESIGN_SYSTEM.md)", () => {
    const offenders = ["app", "components", "modules"]
      .flatMap(sourceFiles)
      .filter((path) => LOOSE_COLOR.test(read(path)));
    assert.deepEqual(offenders, []);
  });
});

describe("Mission 203 — acessibilidade do shell e confirmações destrutivas intactas", () => {
  test("skip link aponta para o conteúdo principal; navegação e contexto rotulados", () => {
    const layout = read("app/(app)/layout.tsx");
    assert.match(layout, /href="#conteudo"/);
    assert.match(layout, /<main id="conteudo"/);
    assert.match(read("modules/workspace/components/AppSidebar.tsx"), /aria-label="Navegação principal"/);
    assert.match(read("modules/workspace/components/AppSidebar.tsx"), /aria-current=\{isActive \? "page" : undefined\}/);
    assert.match(read("modules/workspace/components/AppSidebar.tsx"), /<span className="sr-only">Abrir menu<\/span>/);
    assert.match(read("modules/workspace/components/AppHeader.tsx"), /aria-label="Contexto"/);
  });

  test("encerrar empresa continua exigindo o AlertDialog com cancelamento (Mission 202)", () => {
    const source = read("modules/companies/components/DeleteCompanyButton.tsx");
    for (const marker of ["<AlertDialog>", "<AlertDialogCancel>Cancelar</AlertDialogCancel>", "o encerramento não pode ser desfeito"]) {
      assert.ok(source.includes(marker), marker);
    }
  });

  test("exclusão definitiva continua bloqueada até a frase de confirmação exata (Missions 202/202B)", () => {
    assert.ok(
      read("modules/companies/components/ClosedCompanyPurgePanel.tsx").includes(
        "disabled={isPending || typed !== preview.confirmation}"
      )
    );
    const operator = read("modules/companies/components/OperatorOffboardingPanel.tsx");
    assert.ok(operator.includes("closurePhrase !== preview.closureConfirmation"));
    assert.ok(operator.includes("disabled={isPending || !preview.closed || purgePhrase !== preview.confirmation}"));
  });
});
