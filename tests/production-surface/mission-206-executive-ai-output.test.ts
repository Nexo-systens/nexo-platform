import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";
import {
  executeExecutiveAnalysis,
  type ExecutiveAIProvider,
  type ExecutiveAIRequest,
  type ExecutiveAIResponse,
} from "@/efos/application/executive-ai";
import {
  buildExecutiveAIInstruction,
  EXECUTIVE_AI_CONSTRAINTS,
  validateExecutiveAIInstruction,
} from "@/efos/application/executive-ai-instruction";
import {
  buildExecutiveChatInstruction,
  EXECUTIVE_CHAT_BOUNDARIES,
  EXECUTIVE_CHAT_CONSTRAINTS,
  executeExecutiveChatAnalysis,
  validateExecutiveChatInstruction,
  type ExecutiveChatProvider,
  type ExecutiveChatRequest,
} from "@/efos/application/executive-chat";
import { DIAGNOSIS_BOUNDARIES } from "@/efos/application/executive-diagnosis";
import {
  assessExecutiveFigureFidelity,
  assessExecutiveOutputLanguage,
  describeExecutiveOutputLanguage,
  EXECUTIVE_OUTPUT_LANGUAGE,
  EXECUTIVE_OUTPUT_POLICY_CODES,
  EXECUTIVE_OUTPUT_TOOL_LANGUAGE_NOTE,
  extractCitedFigures,
} from "@/efos/application/executive-output-policy";
import { CapturingExecutiveAIProvider, CapturingExecutiveChatProvider } from "@/efos/application/synthetic-validation";
import { AnthropicExecutiveAIProvider, type AnthropicMessagesClient } from "@/efos/infrastructure/executive-ai/AnthropicExecutiveAIProvider";
import { buildExecutiveAIStageSystemPrompt } from "@/efos/infrastructure/executive-ai/buildExecutiveAISystemPrompt";
import {
  EXECUTIVE_DIAGNOSIS_CORE_TOOL,
  EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL,
} from "@/efos/infrastructure/executive-ai/executiveDiagnosisToolSchema";
import { serializeExecutiveAIInstruction } from "@/efos/infrastructure/executive-ai/serializeExecutiveAIInstruction";
import { buildExecutiveChatSystemPrompt } from "@/efos/infrastructure/executive-chat/buildExecutiveChatSystemPrompt";
import { logExecutiveOutputRejection } from "@/lib/ai/log-executive-output-rejection";
import { EXECUTIVE_CHAT_ANSWER_TOOL } from "@/efos/infrastructure/executive-chat/executiveChatToolSchema";
import {
  EXECUTIVE_AI_UNAVAILABLE_MESSAGE,
  EXECUTIVE_AI_UNEXPECTED_MESSAGE,
  presentExecutiveAiError,
  presentExecutiveDiagnosisProviderError,
} from "@/modules/analysis/lib/analysis-error-message";

import {
  CASH_PRESSURED,
  CURRENT_LIQUIDITY,
  DEBT,
  FIXTURES,
  GROSS_MARGIN,
  HEALTHY,
  INSUFFICIENT_DATA,
  MARGIN_DETERIORATING,
  MISSING_INDICATOR,
  NET_MARGIN,
  RECEIPT_PERIOD,
  REVENUE_UP_RECEIVABLES_WORSE,
} from "./fixtures/executive-ai-contexts";

/**
 * Mission 206 — Executive AI Output Governance & pt-BR (D-132).
 *
 * Nenhum teste chama a Anthropic: providers são stubs que implementam as
 * portas reais (`ExecutiveAIProvider`/`ExecutiveChatProvider`) ou um
 * cliente falso injetado no adapter real. Toda resposta passa pelas
 * composições reais (`executeExecutiveAnalysis`/`executeExecutiveChatAnalysis`),
 * nunca por um mock da função sob teste.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

// ---------------------------------------------------------------- helpers

type Ctx = ExecutiveFinancialContext;

function formatValue(value: number, unit: string): string {
  const fixed = (digits: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (unit === "percentage") return `${fixed(2)}%`;
  if (unit === "currency") return `R$ ${value.toLocaleString("pt-BR")}`;
  if (unit === "days") return `${value} dias`;
  return fixed(2);
}

function availableIndicators(context: Ctx) {
  return context.financialTruth.indicators.flatMap((item) =>
    item.result.status === "available" ? [{ id: item.id, name: item.name, value: item.result.value, unit: item.unit }] : []
  );
}

/** Diagnóstico pt-BR coerente com o contexto (números canônicos, indisponível como indisponível). */
function portugueseDiagnosis(context: Ctx) {
  const [first, second] = availableIndicators(context);
  const unavailable = context.unknowns[0];
  const basis = { indicatorIds: [first.id] };
  const lead = `A ${first.name} está em ${formatValue(first.value, first.unit)} neste período`;
  return {
    id: "diagnostico-sintetico",
    basedOn: { generatedAt: "2026-09-01T00:00:00.000Z" },
    executiveSummary: {
      statement: second
        ? `${lead}, e a ${second.name} está em ${formatValue(second.value, second.unit)}. A leitura abaixo separa os fatos do que ainda precisa de confirmação.`
        : `${lead}. A maior parte dos indicadores não está disponível nesta análise, o que limita a leitura.`,
      basis,
    },
    interpretations: [
      {
        id: "int-1",
        statement: `Os indicadores disponíveis, em conjunto, sugerem um período que pede acompanhamento da ${first.name}.`,
        basis,
        confidence: "medium",
      },
    ],
    hypotheses: [
      {
        id: "hip-1",
        statement: "Se as condições operacionais se mantiverem, o padrão observado pode continuar no próximo período.",
        basis,
        confidence: "low",
        validationNeeded: "Confirmar com os números do próximo fechamento.",
      },
    ],
    risks: [],
    priorities: [
      { id: "pri-1", rank: 1, statement: `Avaliar a evolução da ${first.name} no próximo fechamento.`, reason: "É o indicador com base mais completa nesta análise.", basis },
    ],
    possibleActions: [{ id: "acao-1", kind: "INVESTIGATE", statement: `Investigar o que sustenta o valor atual da ${first.name}.`, basis }],
    questions: unavailable
      ? [{ id: "q-1", question: `Que dado permitiria calcular ${unavailable.subject}, hoje indisponível?`, raisedFrom: "unknown" }]
      : [],
    uncertainties: unavailable
      ? [{ id: "u-1", statement: `${unavailable.subject} está indisponível nesta análise.`, reason: unavailable.impact }]
      : [],
    conflictInterpretations: [],
    boundaries: DIAGNOSIS_BOUNDARIES,
  };
}

class StubDiagnosisProvider implements ExecutiveAIProvider {
  readonly providerName = "stub-diagnosis";
  calls = 0;
  lastRequest: ExecutiveAIRequest | undefined;
  constructor(private readonly output: unknown | ((request: ExecutiveAIRequest) => unknown)) {}
  async analyze(request: ExecutiveAIRequest): Promise<ExecutiveAIResponse> {
    this.calls += 1;
    this.lastRequest = request;
    const output = typeof this.output === "function" ? (this.output as (r: ExecutiveAIRequest) => unknown)(request) : this.output;
    return { providerName: this.providerName, model: "stub", output: structuredClone(output), receivedAt: "2026-09-01T00:00:00.000Z" };
  }
}

class ThrowingDiagnosisProvider implements ExecutiveAIProvider {
  readonly providerName = "stub-failing";
  constructor(private readonly thrown: unknown) {}
  async analyze(): Promise<ExecutiveAIResponse> {
    throw this.thrown;
  }
}

function chatAnswer(context: Ctx, answer: string, overrides: Record<string, unknown> = {}) {
  const basis = { indicatorIds: [availableIndicators(context)[0].id] };
  return {
    id: "resposta-sintetica",
    answer,
    factualClaims: [{ id: "fato-1", statement: `${availableIndicators(context)[0].name} consta no contexto atual.`, basis }],
    analysis: [{ id: "analise-1", statement: "A leitura combina os indicadores disponíveis neste período.", basis, confidence: "medium" }],
    hypotheses: [],
    limitations: [],
    groundingStatus: "GROUNDED",
    requiresScenarioSimulation: false,
    basedOn: { companyId: context.identity.companyId, generatedAt: "2026-09-01T00:00:00.000Z" },
    boundaries: EXECUTIVE_CHAT_BOUNDARIES,
    ...overrides,
  };
}

class StubChatProvider implements ExecutiveChatProvider {
  readonly providerName = "stub-chat";
  lastRequest: ExecutiveChatRequest | undefined;
  constructor(private readonly output: unknown) {}
  async converse(request: ExecutiveChatRequest): Promise<ExecutiveAIResponse> {
    this.lastRequest = request;
    return { providerName: this.providerName, model: "stub", output: structuredClone(this.output), receivedAt: "2026-09-01T00:00:00.000Z" };
  }
}

const text = (value: string) => [{ path: "campo", text: value }];

// ---------------------------------------------------------------- política

describe("Mission 206 — política canônica de saída", () => {
  test("Diagnosis e Chat exigem pt-BR estrutural e herdam todos os códigos comuns", () => {
    const diagnosis = buildExecutiveAIInstruction(MARGIN_DETERIORATING, "instr-1");
    const chat = buildExecutiveChatInstruction(MARGIN_DETERIORATING, "instr-2", { text: "Como está minha empresa?" });
    for (const instruction of [diagnosis, chat]) {
      assert.equal(instruction.outputLanguage, "pt-BR");
      const codes = instruction.constraints.map((constraint) => constraint.code as string);
      for (const code of EXECUTIVE_OUTPUT_POLICY_CODES) assert.ok(codes.includes(code), code);
    }
    assert.equal(validateExecutiveAIInstruction(diagnosis).valid, true);
    assert.equal(validateExecutiveChatInstruction(chat).valid, true);
  });

  test("idioma diferente de pt-BR é instrução inválida — nunca opcional", () => {
    const diagnosis = { ...buildExecutiveAIInstruction(HEALTHY, "instr-1"), outputLanguage: "en" } as never;
    const chat = { ...buildExecutiveChatInstruction(HEALTHY, "instr-2", { text: "Como está?" }), outputLanguage: "en" } as never;
    assert.match(validateExecutiveAIInstruction(diagnosis).errors.join(" "), /outputLanguage/);
    assert.match(validateExecutiveChatInstruction(chat).errors.join(" "), /outputLanguage/);
  });

  test("uma única fonte de texto: as descrições comuns são idênticas nas duas capabilities", () => {
    for (const code of EXECUTIVE_OUTPUT_POLICY_CODES) {
      const fromDiagnosis = EXECUTIVE_AI_CONSTRAINTS.find((constraint) => constraint.code === code)?.description;
      const fromChat = EXECUTIVE_CHAT_CONSTRAINTS.find((constraint) => constraint.code === code)?.description;
      assert.ok(fromDiagnosis && fromDiagnosis === fromChat, code);
    }
  });

  test("os prompts dos dois adapters renderizam o mesmo parágrafo de idioma e todas as invariantes", () => {
    const language = describeExecutiveOutputLanguage(EXECUTIVE_OUTPUT_LANGUAGE);
    const diagnosis = buildExecutiveAIInstruction(CASH_PRESSURED, "instr-1");
    const prompts = [
      buildExecutiveAIStageSystemPrompt(diagnosis, "core"),
      buildExecutiveAIStageSystemPrompt(diagnosis, "interpretation"),
      buildExecutiveChatSystemPrompt(buildExecutiveChatInstruction(CASH_PRESSURED, "instr-2", { text: "Quais são os riscos?" })),
    ];
    for (const prompt of prompts) {
      assert.ok(prompt.includes(language), "parágrafo de idioma");
      for (const code of EXECUTIVE_OUTPUT_POLICY_CODES) assert.ok(prompt.includes(code), code);
    }
  });

  test("tools ganham a nota de idioma na descrição; o schema estrito não muda", () => {
    for (const tool of [EXECUTIVE_DIAGNOSIS_CORE_TOOL, EXECUTIVE_DIAGNOSIS_INTERPRETATION_TOOL, EXECUTIVE_CHAT_ANSWER_TOOL]) {
      assert.ok(tool.description.includes(EXECUTIVE_OUTPUT_TOOL_LANGUAGE_NOTE), tool.name);
      assert.equal(tool.strict, true);
    }
    assert.deepEqual(Object.keys(EXECUTIVE_DIAGNOSIS_CORE_TOOL.input_schema.properties ?? {}), [
      "executiveSummary",
      "interpretations",
      "risks",
      "priorities",
      "possibleActions",
    ]);
  });

  test("a regra vive acima do provider: nenhum adapter escreve a política com as próprias palavras", () => {
    const policyDir = join(process.cwd(), "efos/application/executive-output-policy");
    for (const file of readdirSync(policyDir)) {
      assert.doesNotMatch(readFileSync(join(policyDir, file), "utf8"), /from ["'][^"']*(anthropic|infrastructure)[^"']*["']/i, `${file} não depende de provider`);
    }
    for (const file of [
      "efos/infrastructure/executive-ai/buildExecutiveAISystemPrompt.ts",
      "efos/infrastructure/executive-chat/buildExecutiveChatSystemPrompt.ts",
    ]) {
      const source = read(file);
      assert.match(source, /describeExecutiveOutputLanguage\(instruction\.outputLanguage\)/, file);
      assert.doesNotMatch(source, /Portuguese|português|pt-BR/i, `${file} não redefine o idioma`);
    }
  });
});

// ---------------------------------------------------------------- serialização

describe("Mission 206 — números canônicos chegam intactos ao provider", () => {
  test("negativo, moeda, comparação temporal e período preservados; indisponível segue sem valor", () => {
    const payload = serializeExecutiveAIInstruction(buildExecutiveAIInstruction(MARGIN_DETERIORATING, "instr-1")) as unknown as {
      outputLanguage: string;
      context: Ctx;
    };
    assert.equal(payload.outputLanguage, "pt-BR");
    const byName = new Map(payload.context.financialTruth.indicators.map((item) => [item.name, item.result]));
    assert.deepEqual(byName.get("Margem Líquida"), { status: "available", value: -4.26 });
    assert.deepEqual(byName.get("EBITDA"), { status: "available", value: 33100 });
    assert.equal(payload.context.historicalIntelligence?.comparison.metrics[0].absoluteChange, -5.69);
    assert.equal(payload.context.period.endDate, "2026-08-31T23:59:59.000Z");

    const missing = serializeExecutiveAIInstruction(buildExecutiveAIInstruction(MISSING_INDICATOR, "instr-2")) as unknown as { context: Ctx };
    const debt = missing.context.financialTruth.indicators.find((item) => item.name === "Endividamento Geral");
    assert.deepEqual(debt?.result, { status: "unavailable" }, "indisponível nunca ganha valor");
  });
});

// ---------------------------------------------------------------- idioma

describe("Mission 206 — idioma da saída", () => {
  test("pt-BR executivo é aceito, inclusive com termos canônicos em inglês e siglas", () => {
    assert.equal(
      assessExecutiveOutputLanguage(
        text("O EBITDA de R$ 33.100 e a margem da DRE pedem atenção; avaliar a revisão de CPV no Scenario Lab antes de registrar no Decision Center.")
      ).valid,
      true
    );
    assert.equal(assessExecutiveOutputLanguage(text("A Margem Líquida está em -4,26% neste período.")).valid, true);
  });

  test("resposta em inglês é rejeitada", () => {
    const result = assessExecutiveOutputLanguage(
      text("The available indicators and evidence, taken together, suggest a period requiring executive attention.")
    );
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /português do Brasil/);
  });

  test("misto: um campo inteiro em inglês dentro de uma resposta em português é rejeitado", () => {
    const result = assessExecutiveOutputLanguage([
      { path: "executiveSummary.statement", text: "A Margem Líquida está negativa e caiu em relação ao período anterior, o que pede atenção." },
      { path: "hypotheses[0].statement", text: "The pattern observed may continue in subsequent periods if the same operational conditions persist." },
    ]);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /hypotheses\[0\]\.statement/);
  });

  test("não é um detector frágil: termos isolados e campos curtos não reprovam", () => {
    for (const ok of ["Scenario Lab", "EBITDA e EBIT", "Executive Chat · Decision Center", "Revisar o break-even da operação.", "OK"]) {
      assert.equal(assessExecutiveOutputLanguage(text(ok)).valid, true, ok);
    }
  });
});

// ---------------------------------------------------------------- números

describe("Mission 206 — fidelidade numérica", () => {
  const figures = (value: string, context: Ctx = MARGIN_DETERIORATING, extra: readonly unknown[] = []) =>
    assessExecutiveFigureFidelity(text(value), context, extra);

  test("valor canônico citado (com sinal, arredondado ou truncado, em moeda ou percentual) é aceito", () => {
    for (const ok of [
      "A Margem Líquida está em -4,26%.",
      "A Margem Bruta ficou em 27,4%, ou 27%.",
      "O EBITDA foi de R$ 33.100.",
      "As saídas operacionais somaram R$ 505 mil.",
      "A Liquidez Corrente é 1,85.",
    ]) {
      assert.equal(figures(ok, ok.includes("505") ? CASH_PRESSURED : MARGIN_DETERIORATING).valid, true, ok);
    }
  });

  test("variação já presente na comparação temporal é aceita; variação calculada pelo modelo é rejeitada", () => {
    assert.equal(figures("A Margem Líquida caiu 5,69 p.p. desde o período anterior.").valid, true);
    assert.equal(figures("O prazo subiu 17 dias.", REVENUE_UP_RECEIVABLES_WORSE).valid, true);
    const computed = figures("As saídas superaram as entradas em R$ 115.000.", CASH_PRESSURED);
    assert.equal(computed.valid, false, "diferença calculada pelo modelo, não presente no contexto");
    assert.match(computed.errors[0], /R\$ 115\.000/);
  });

  test("número inventado e projeção são rejeitados", () => {
    assert.equal(figures("A Margem Líquida deve chegar a 2,5% no próximo trimestre.").valid, false);
    assert.equal(figures("O EBITDA projetado é de R$ 250.000.").valid, false);
  });

  test("sinal trocado é rejeitado; negativo descrito em palavras é aceito", () => {
    const flipped = figures("A Margem Líquida está em 4,26%.");
    assert.equal(flipped.valid, false);
    assert.match(flipped.errors[0], /sinal trocado/);
    assert.equal(figures("A Margem Líquida está negativa em 4,26%.").valid, true);
  });

  test("indisponível nunca vira número — nem zero", () => {
    for (const bad of ["O ROI foi de 0%.", "ROI: 12,5%", "A Cobertura de Juros é 0,00."]) {
      assert.equal(figures(bad, INSUFFICIENT_DATA).valid, false, bad);
    }
    assert.equal(figures("O ROI está indisponível nesta análise.", INSUFFICIENT_DATA).valid, true);
    assert.equal(figures("O Endividamento Geral não está disponível nesta análise.", MISSING_INDICATOR).valid, true);
    assert.equal(figures("O Endividamento Geral está em 76,25%.", MISSING_INDICATOR).valid, false);
  });

  test("datas, contagens e anos não são figuras financeiras", () => {
    assert.deepEqual(extractCitedFigures("Queda em 4 períodos, de 01/05/2026 a 31/08/2026, às 19:39; 3 sinais em 2026."), []);
  });

  test("o Chat pode repetir o número que o executivo digitou", () => {
    assert.equal(figures("Para simular um corte de R$ 60.000, use o Scenario Lab.", MARGIN_DETERIORATING, ["E se eu cortar R$ 60.000?"]).valid, true);
    assert.equal(figures("Para simular um corte de R$ 60.000, use o Scenario Lab.").valid, false);
  });
});

// ---------------------------------------------------------------- Diagnosis

describe("Mission 206 — Executive Diagnosis (6 fixtures sintéticas)", () => {
  for (const [name, context] of Object.entries(FIXTURES)) {
    test(`${name}: diagnóstico pt-BR com números canônicos é aceito`, async () => {
      const provider = new StubDiagnosisProvider(portugueseDiagnosis(context));
      const result = await executeExecutiveAnalysis(provider, context, "instr");
      assert.equal(result.success, true, result.success ? "" : result.error.message);
      assert.equal(provider.lastRequest?.instruction.outputLanguage, "pt-BR");
    });
  }

  test("diagnóstico em inglês é rejeitado antes de qualquer persistência", async () => {
    const english = portugueseDiagnosis(MARGIN_DETERIORATING);
    english.executiveSummary.statement = "The current financial context for this company shows two deterministic evidence items already produced by the engines.";
    english.interpretations[0].statement = "The available indicators and evidence, taken together, suggest a period requiring executive attention.";
    english.hypotheses[0].statement = "The pattern observed may continue in subsequent periods if the same operational conditions persist.";
    const result = await executeExecutiveAnalysis(new StubDiagnosisProvider(english), MARGIN_DETERIORATING, "instr");
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.code, "VALIDATION_FAILED");
      assert.match(result.error.message, /Política de saída da Executive AI: .*português do Brasil/);
    }
  });

  test("número divergente, sinal trocado e indisponível como zero são rejeitados", async () => {
    const cases: Array<[Ctx, string]> = [
      [MARGIN_DETERIORATING, "A Margem Líquida deve recuar para -6,10% no próximo mês."],
      [MARGIN_DETERIORATING, "A Margem Líquida está em 4,26%, o que mostra rentabilidade."],
      [MISSING_INDICATOR, "O Endividamento Geral está em 0% neste período."],
    ];
    for (const [context, statement] of cases) {
      const diagnosis = portugueseDiagnosis(context);
      diagnosis.interpretations[0].statement = statement;
      const result = await executeExecutiveAnalysis(new StubDiagnosisProvider(diagnosis), context, "instr");
      assert.equal(result.success, false, statement);
      if (!result.success) assert.equal(result.error.code, "VALIDATION_FAILED");
    }
  });

  test("hipótese continua separada de fato: sem validação necessária, é rejeitada", async () => {
    const diagnosis = portugueseDiagnosis(MARGIN_DETERIORATING);
    (diagnosis.hypotheses[0] as { validationNeeded: string }).validationNeeded = "";
    const result = await executeExecutiveAnalysis(new StubDiagnosisProvider(diagnosis), MARGIN_DETERIORATING, "instr");
    assert.equal(result.success, false);
  });

  test("resposta vazia, malformada e enum inválido nunca viram diagnóstico", async () => {
    const empty = portugueseDiagnosis(HEALTHY);
    empty.executiveSummary.statement = "   ";
    const badConfidence = portugueseDiagnosis(HEALTHY) as Record<string, unknown>;
    (badConfidence.interpretations as Array<Record<string, unknown>>)[0].confidence = "87%";
    const badOrigin = portugueseDiagnosis(INSUFFICIENT_DATA) as Record<string, unknown>;
    (badOrigin.questions as Array<Record<string, unknown>>)[0].raisedFrom = "instinct";
    const badKind = portugueseDiagnosis(HEALTHY) as Record<string, unknown>;
    (badKind.possibleActions as Array<Record<string, unknown>>)[0].kind = "EXECUTE";

    for (const [label, output, context, code] of [
      ["vazia", empty, HEALTHY, "VALIDATION_FAILED"],
      ["confiança com falsa precisão", badConfidence, HEALTHY, "VALIDATION_FAILED"],
      ["origem inválida", badOrigin, INSUFFICIENT_DATA, "VALIDATION_FAILED"],
      ["ação como ordem", badKind, HEALTHY, "VALIDATION_FAILED"],
      ["malformada", { executiveSummary: "texto solto" }, HEALTHY, "INVALID_PROVIDER_RESPONSE"],
    ] as const) {
      const result = await executeExecutiveAnalysis(new StubDiagnosisProvider(output), context, "instr");
      assert.equal(result.success, false, label);
      if (!result.success) assert.equal(result.error.code, code, label);
    }
  });

  test("falha do provider vira erro tipado, sem segredo nem stack; código específico é preservado", async () => {
    const generic = await executeExecutiveAnalysis(new ThrowingDiagnosisProvider(new Error("boom sk-ant-falso-SEGREDO stack")), HEALTHY, "instr");
    assert.equal(generic.success, false);
    if (!generic.success) {
      assert.equal(generic.error.code, "PROVIDER_UNAVAILABLE");
      assert.doesNotMatch(generic.error.message, /sk-ant|SEGREDO|stack|boom/);
    }
    const timeout = await executeExecutiveAnalysis(
      new ThrowingDiagnosisProvider({ code: "PROVIDER_TIMEOUT", message: "O provider demorou demais." }),
      HEALTHY,
      "instr"
    );
    assert.equal(!timeout.success && timeout.error.code, "PROVIDER_TIMEOUT");
  });

  test("retry atual preservado: nenhuma nova chamada automática; a próxima tentativa do usuário é independente", async () => {
    const english = portugueseDiagnosis(HEALTHY);
    english.executiveSummary.statement = "The company shows healthy margins and comfortable liquidity for the current period, with no adverse evidence.";
    english.interpretations[0].statement = "The available indicators suggest a stable period with no signal requiring executive attention.";
    const failing = new StubDiagnosisProvider(english);
    assert.equal((await executeExecutiveAnalysis(failing, HEALTHY, "instr")).success, false);
    assert.equal(failing.calls, 1, "uma resposta rejeitada não dispara nova chamada");
    assert.equal((await executeExecutiveAnalysis(new StubDiagnosisProvider(portugueseDiagnosis(HEALTHY)), HEALTHY, "instr")).success, true);
  });
});

// ---------------------------------------------------------------- adapter real

describe("Mission 206 — adapter Anthropic (cliente falso injetado, sem rede)", () => {
  function fakeClient(stages: { core: unknown; interpretation: unknown }) {
    const sent: Array<{ system: string; toolDescription: string }> = [];
    const client: AnthropicMessagesClient = {
      messages: {
        async create(params) {
          const tool = params.tools?.[0] as { name: string; description: string };
          sent.push({ system: String(params.system), toolDescription: tool.description });
          const input = tool.name.endsWith("_core") ? stages.core : stages.interpretation;
          return {
            id: "msg",
            type: "message",
            role: "assistant",
            model: "fake",
            content: [{ type: "tool_use", id: "tool", name: tool.name, input }],
            stop_reason: "tool_use",
          } as never;
        },
      },
    };
    return { client, sent };
  }

  const basis = [`indicator:${NET_MARGIN}`];
  const core = (summary: string) => ({
    executiveSummary: { statement: summary, basis },
    interpretations: [{ id: "i1", statement: "A Margem Líquida negativa, em conjunto com a queda da Margem Bruta, sugere pressão sobre a rentabilidade.", basis, confidence: "medium" }],
    risks: [{ id: "r1", statement: "O declínio sustentado da Margem Líquida indica risco já presente no período.", type: "CONFIRMED_SIGNAL", basis }],
    priorities: [{ id: "p1", rank: 1, statement: "Avaliar a estrutura de custos que pressiona a margem.", reason: "A queda se sustenta há 4 períodos.", basis }],
    possibleActions: [{ id: "a1", kind: "INVESTIGATE", statement: "Investigar a evolução do CPV nos últimos fechamentos.", basis }],
  });
  const interpretation = {
    hypotheses: [{ id: "h1", statement: "A queda pode estar ligada ao aumento de custos, a confirmar.", basis, confidence: "low", validationNeeded: "Confirmar com a DRE detalhada do próximo fechamento." }],
    questions: [],
    uncertainties: [],
    conflictInterpretations: [],
  };

  test("pt-BR atravessa o adapter real e a composição; prompt e tool levam a política", async () => {
    const { client, sent } = fakeClient({
      core: core("A Margem Líquida está em -4,26% em agosto de 2026, com queda de 5,69 p.p. em relação ao período anterior."),
      interpretation,
    });
    const result = await executeExecutiveAnalysis(new AnthropicExecutiveAIProvider({ client }), MARGIN_DETERIORATING, "instr");
    assert.equal(result.success, true, result.success ? "" : result.error.message);
    assert.equal(sent.length, 2, "dois estágios, como antes");
    for (const call of sent) {
      assert.ok(call.system.includes(describeExecutiveOutputLanguage("pt-BR")));
      assert.ok(call.toolDescription.includes(EXECUTIVE_OUTPUT_TOOL_LANGUAGE_NOTE));
    }
  });

  test("saída inglesa do modelo é barrada pela governança, não pelo adapter", async () => {
    const { client } = fakeClient({
      core: core("Net margin is negative this period and has been declining for four consecutive periods, which requires executive attention."),
      interpretation: {
        ...interpretation,
        hypotheses: [{ ...interpretation.hypotheses[0], statement: "The decline may be related to rising costs, which still needs to be confirmed." }],
      },
    });
    const result = await executeExecutiveAnalysis(new AnthropicExecutiveAIProvider({ client }), MARGIN_DETERIORATING, "instr");
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.error.message, /português do Brasil/);
  });
});

// ---------------------------------------------------------------- Chat

describe("Mission 206 — Executive Chat", () => {
  const questions: Array<[string, string]> = [
    ["Como está minha empresa?", "A Margem Líquida está em -4,26% e a Margem Bruta em 27,35% em agosto de 2026; as duas caíram em relação ao período anterior."],
    ["Por que minha margem caiu?", "O contexto mostra a queda da Margem Líquida (-5,69 p.p.) e da Margem Bruta (-3,85 p.p.), mas não confirma uma causa; a explicação mais provável ainda precisa ser validada."],
    ["O que mudou em relação ao período anterior?", "A Margem Líquida passou de 1,43% para -4,26%, e a Margem Bruta, de 31,20% para 27,35%."],
    ["Quais são os principais riscos?", "O principal sinal é o declínio sustentado da Margem Líquida, com severidade alta, somado à margem negativa neste período."],
    ["O que sabemos e o que é hipótese?", "Sabemos que a Margem Líquida está em -4,26% e cai há 4 períodos; que a causa seja o aumento de custos é uma hipótese a confirmar."],
    ["O que eu deveria investigar antes de decidir?", "Vale investigar a evolução dos custos e do CPV nos últimos fechamentos; o contexto atual não traz o detalhe por linha da DRE."],
  ];

  for (const [question, answer] of questions) {
    test(`"${question}" — resposta pt-BR fundamentada é aceita`, async () => {
      const provider = new StubChatProvider(chatAnswer(MARGIN_DETERIORATING, answer));
      const result = await executeExecutiveChatAnalysis(provider, MARGIN_DETERIORATING, "instr", { text: question });
      assert.equal(result.success, true, result.success ? "" : result.error.message);
      assert.equal(provider.lastRequest?.instruction.outputLanguage, "pt-BR");
    });
  }

  test("resposta em inglês e número ausente do contexto são rejeitados", async () => {
    for (const answer of [
      "Your company is currently showing a negative net margin and a declining gross margin compared with the previous period.",
      "A Margem Líquida deve voltar a 3,2% no próximo trimestre.",
    ]) {
      const result = await executeExecutiveChatAnalysis(new StubChatProvider(chatAnswer(MARGIN_DETERIORATING, answer)), MARGIN_DETERIORATING, "instr", {
        text: "Como está minha empresa?",
      });
      assert.equal(result.success, false, answer);
      if (!result.success) assert.match(result.error.message, /Política de saída do Executive Chat/);
    }
  });

  test("pergunta de simulação: o Chat repete o valor do executivo e não calcula nada", async () => {
    const output = chatAnswer(MARGIN_DETERIORATING, "Para saber o efeito de reduzir R$ 60.000 em despesas operacionais, é preciso simular no Scenario Lab.", {
      requiresScenarioSimulation: true,
    });
    const result = await executeExecutiveChatAnalysis(new StubChatProvider(output), MARGIN_DETERIORATING, "instr", {
      text: "E se eu reduzir R$ 60.000 em despesas operacionais?",
    });
    assert.equal(result.success, true, result.success ? "" : result.error.message);
  });

  test("ações governadas intactas: a proposta passa como proposta, com o valor estruturado, e nada executa", async () => {
    const output = chatAnswer(MARGIN_DETERIORATING, "Uma simulação no Scenario Lab mostraria o efeito antes de qualquer decisão.", {
      requiresScenarioSimulation: true,
      proposedActions: [
        {
          kind: "scenario",
          type: "PREPARE_OPERATING_COST_SCENARIO",
          reason: "Preparar a simulação de reduzir R$ 50.000 em despesas operacionais, sujeita à sua confirmação.",
          assumption: { kind: "operating_cost_change", scenarioType: "adjust_operating_costs", operatingExpensesDelta: { amount: -50000, currency: "BRL" } },
        },
      ],
    });
    const result = await executeExecutiveChatAnalysis(new StubChatProvider(output), MARGIN_DETERIORATING, "instr", {
      text: "Quero testar um corte de despesas.",
    });
    assert.equal(result.success, true, result.success ? "" : result.error.message);
    if (result.success) {
      assert.equal(result.value.proposedActions?.[0].type, "PREPARE_OPERATING_COST_SCENARIO");
      assert.equal(result.value.boundaries.doesNotExecuteActions, true);
    }
  });

  test("o motivo de uma ação não pode inventar número fora dos parâmetros estruturados", async () => {
    const output = chatAnswer(MARGIN_DETERIORATING, "Uma simulação no Scenario Lab mostraria o efeito antes de qualquer decisão.", {
      proposedActions: [
        {
          kind: "scenario",
          type: "PREPARE_OPERATING_COST_SCENARIO",
          reason: "Reduzir R$ 50.000 em despesas levaria a margem para 1,19%.",
          assumption: { kind: "operating_cost_change", scenarioType: "adjust_operating_costs", operatingExpensesDelta: { amount: -50000, currency: "BRL" } },
        },
      ],
    });
    const result = await executeExecutiveChatAnalysis(new StubChatProvider(output), MARGIN_DETERIORATING, "instr", { text: "Quero testar um corte." });
    assert.equal(result.success, false, "resultado de cenário calculado pelo modelo");
  });

  test("confiança fora do vocabulário é rejeitada no Chat", async () => {
    const output = chatAnswer(MARGIN_DETERIORATING, "A Margem Líquida está em -4,26% neste período.");
    (output.analysis as Array<Record<string, unknown>>)[0].confidence = "very_high";
    const result = await executeExecutiveChatAnalysis(new StubChatProvider(output), MARGIN_DETERIORATING, "instr", { text: "Como está?" });
    assert.equal(result.success, false);
  });
});

// ---------------------------------------------------------------- stand-ins e UI

describe("Mission 206 — stand-ins locais e apresentação", () => {
  for (const [name, context] of Object.entries(FIXTURES)) {
    test(`stand-in sintético (modo visual local) cumpre a política: ${name}`, async () => {
      const diagnosis = await executeExecutiveAnalysis(
        new CapturingExecutiveAIProvider({ providerName: "local", diagnosisId: "d", generatedAt: "2026-09-01T00:00:00.000Z", receivedAt: "2026-09-01T00:00:00.000Z" }),
        context,
        "instr"
      );
      assert.equal(diagnosis.success, true, diagnosis.success ? "" : diagnosis.error.message);
      const chat = await executeExecutiveChatAnalysis(
        new CapturingExecutiveChatProvider({ providerName: "local", answerId: "a", generatedAt: "2026-09-01T00:00:00.000Z", receivedAt: "2026-09-01T00:00:00.000Z" }),
        context,
        "instr",
        { text: "Como está minha empresa?" }
      );
      assert.equal(chat.success, true, chat.success ? "" : chat.error.message);
    });
  }

  test("diagnóstico rejeitado pela política aparece como mensagem executiva, com o detalhe recolhido", () => {
    const raw = "Política de saída da Executive AI: executiveSummary.statement não está em português do Brasil (pt-BR).";
    assert.deepEqual(presentExecutiveDiagnosisProviderError(raw), { message: EXECUTIVE_AI_UNEXPECTED_MESSAGE, technicalDetail: raw });
    assert.doesNotMatch(EXECUTIVE_AI_UNEXPECTED_MESSAGE, /política|pt-BR|validation|anthropic/i);
    const unavailable = "ANTHROPIC_API_KEY não configurada — o provider Anthropic não pode ser chamado sem uma chave de API válida.";
    assert.equal(presentExecutiveDiagnosisProviderError(unavailable).message, EXECUTIVE_AI_UNAVAILABLE_MESSAGE);
    // Sessão/acesso continuam visíveis pelo caminho anterior (Mission 128).
    assert.deepEqual(presentExecutiveAiError("Sessão expirada. Faça login novamente."), { message: "Sessão expirada. Faça login novamente." });
  });

  test("a ativação usa a apresentação executiva só no estágio do provedor", () => {
    const source = read("modules/decisions/components/ExecutiveDiagnosisActivation.tsx");
    assert.match(source, /setProviderStage\(result\.stage === "provider"\)/);
    assert.match(source, /providerStage\s*\?\s*presentExecutiveDiagnosisProviderError\(errorMessage\)/);
  });
});

describe("Mission 206 — observabilidade segura das rejeições", () => {
  test("o log traz só capability, provider e contagens — nunca texto, número citado ou segredo", () => {
    const lines: string[] = [];
    const message =
      'Política de saída da Executive AI: executiveSummary.statement não está em português do Brasil (pt-BR).; interpretations[0].statement cita "R$ 115.000", que não existe no contexto financeiro (número calculado ou inventado).; risks[0].statement atribui um número a "ROI", que está indisponível no contexto.';
    logExecutiveOutputRejection("diagnosis", { code: "VALIDATION_FAILED", message, providerName: "anthropic-claude" }, (line) => lines.push(line));
    assert.equal(lines.length, 1);
    assert.match(lines[0], /diagnosis: .*idioma=1 números=1 indisponível=1 sinal=0 \(provider=anthropic-claude\)/);
    assert.doesNotMatch(lines[0], /115|ROI|executiveSummary|statement|sk-ant/);
  });

  test("falha que não é da política (indisponibilidade, forma) não gera log de rejeição", () => {
    const lines: string[] = [];
    logExecutiveOutputRejection("chat", { code: "PROVIDER_UNAVAILABLE", message: "Falha de autenticação com o provider Anthropic." }, (line) => lines.push(line));
    logExecutiveOutputRejection("chat", { code: "VALIDATION_FAILED", message: "analysis[0] sem basis." }, (line) => lines.push(line));
    assert.deepEqual(lines, []);
  });

  test("as duas server actions registram a rejeição antes de devolver o erro", () => {
    assert.match(read("modules/decisions/actions/executive-diagnosis.actions.ts"), /logExecutiveOutputRejection\("diagnosis", analysis\.error\)/);
    assert.match(read("modules/executive-chat/actions/executive-chat.actions.ts"), /logExecutiveOutputRejection\("chat", result\.error\)/);
  });
});

// Referências usadas pelas fixtures (evita import morto e documenta o que cada uma exercita).
void [CURRENT_LIQUIDITY, DEBT, GROSS_MARGIN, RECEIPT_PERIOD];
