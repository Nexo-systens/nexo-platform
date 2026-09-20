import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { prepareClassifiedDocuments } from "@/app/api/efos/_shared/prepareFinancialDocuments";
import { EFOSPipelineRuntime } from "@/efos/application/orchestrators";
import { buildExecutiveFinancialContext } from "@/efos/application/executive-context";
import { periodOf } from "@/efos/engines/evidence";
import type { RawFinancialDocument, RawFinancialLine } from "@/efos/engines/data";
import { buildRealisticBalance, buildRealisticBankStatement, buildRealisticDre } from "../financial-ingestion/fixtures";

/**
 * Mission 198 — Founding Company Operational Trial & Release Candidate
 * Gate. A trial rodou o pipeline completo (Data → FinancialModel →
 * Indicators → FinancialKnowledgeGraph → Evidence → Context →
 * Reasoning → Recommendation → Decision → Learning) via
 * `EFOSPipelineRuntime.execute()` — o mesmo orquestrador de produção
 * usado por `EFOSPlatform`/toda rota de análise — e a rejeição
 * cross-company de `buildExecutiveFinancialContext()` (D-0XX, Mission
 * 162) contra uma "NEXO RC TRIAL COMPANY" sintética. Nenhum dos dois
 * jamais tinha um teste COMMITTED protegendo-os: `tests/financial-
 * ingestion/` para deliberadamente em Indicators (nunca chama
 * `EFOSPipelineRuntime`); a suíte adversarial de cross-company da
 * Mission 162 (README, `efos/application/synthetic-validation/`) só
 * existiu como script efêmero de sessão, nunca commitado. Este arquivo
 * fecha os dois gaps reais encontrados pela Mission 198.
 *
 * Entra pelo mesmo caminho de intake de documento já usado por toda a
 * suíte `tests/financial-ingestion/` (`prepareClassifiedDocuments()`)
 * — nunca um `FinancialModel`/agregado construído à mão.
 */

const COMPANY_ID = "rc-gate-company";
const OTHER_COMPANY_ID = "rc-gate-company-other";

async function runFullPipeline(companyId: string, documents: readonly RawFinancialDocument[]) {
  const { documents: prepared, conflicts } = await prepareClassifiedDocuments(documents);
  return new EFOSPipelineRuntime().execute({
    companyId,
    requestId: `rc-request-${companyId}`,
    executionId: `rc-execution-${companyId}`,
    timestamp: new Date().toISOString(),
    metadata: { documents: prepared, conflicts },
  });
}

describe("Mission 198 — EFOSPipelineRuntime completo, ponta a ponta, via intake real de documento", () => {
  test("empresa vazia (zero documentos) falha de forma limpa — nenhum indicador/relatório/diagnóstico fabricado", async () => {
    const result = await runFullPipeline(COMPANY_ID, []);
    assert.equal(result.success, false, "zero documentos nunca produz uma execução bem-sucedida");
  });

  test("pacote completo (DRE+Balanço+Extrato) alcança os 10 estágios do EFOS_PIPELINE via o orquestrador de produção real", async () => {
    const documents = [
      buildRealisticDre("rc-dre", COMPANY_ID),
      buildRealisticBalance("rc-balanco", COMPANY_ID),
      buildRealisticBankStatement("rc-extrato", COMPANY_ID),
    ];

    const result = await runFullPipeline(COMPANY_ID, documents);
    assert.equal(result.success, true);
    if (!result.success) return;

    assert.deepEqual(
      [...result.value.metadata.completedStages],
      [
        "data", "financial-model", "indicators", "financial-knowledge-graph",
        "evidence", "context", "reasoning", "recommendation", "decision", "learning",
      ],
      "os 10 estágios oficiais de EFOS_PIPELINE (efos/types/pipeline.ts) devem ser alcançados, na ordem oficial, pelo mesmo orquestrador que qualquer rota de produção usa"
    );

    const exec = result.value.execution;
    assert.ok(exec.indicators && exec.indicators.indicators.length > 0, "Indicators deve produzir indicadores reais");
    assert.ok(exec.evidence, "Evidence deve existir como agregado (mesmo que vazio para um período saudável — nunca ausente)");
    assert.ok(exec.decision, "Decision deve existir como agregado determinístico do pipeline oficial (nunca a Decision humana do Decision Center — vocabulário distinto, D-011)");
  });
});

describe("Mission 198 — buildExecutiveFinancialContext() rejeita composição cross-company (Mission 162, nunca antes commitado como teste permanente)", () => {
  test("um Evidence de outra empresa nunca pode compor um ExecutiveFinancialContext — lança explicitamente, nunca combina silenciosamente", async () => {
    const ownResult = await runFullPipeline(COMPANY_ID, [
      buildRealisticDre("rc-dre-own", COMPANY_ID),
      buildRealisticBalance("rc-balanco-own", COMPANY_ID),
    ]);
    const otherResult = await runFullPipeline(OTHER_COMPANY_ID, [
      buildRealisticDre("rc-dre-other", OTHER_COMPANY_ID),
    ]);

    assert.equal(ownResult.success, true);
    assert.equal(otherResult.success, true);
    if (!ownResult.success || !otherResult.success) return;

    const own = ownResult.value.execution;
    const other = otherResult.value.execution;
    assert.ok(own.indicators && own.evidence && own.context && own.reasoning && own.recommendation);
    assert.ok(other.evidence);

    const period = periodOf(own.indicators!);
    assert.ok(period, "a execução própria deve ter um período resolvível");

    assert.throws(
      () =>
        buildExecutiveFinancialContext(
          COMPANY_ID,
          period!,
          own.indicators!,
          other.evidence!, // Evidence de OUTRA empresa, injetado deliberadamente
          own.context!,
          own.reasoning!,
          own.recommendation!
        ),
      /companyId divergente/,
      "buildExecutiveFinancialContext() deve rejeitar explicitamente um agregado de empresa diferente — nunca compor um contexto executivo misto"
    );
  });

  test("agregados todos da mesma empresa continuam compondo normalmente (a rejeição é sobre fronteira, nunca o mecanismo quebrado)", async () => {
    const result = await runFullPipeline(COMPANY_ID, [
      buildRealisticDre("rc-dre-happy", COMPANY_ID),
      buildRealisticBalance("rc-balanco-happy", COMPANY_ID),
    ]);
    assert.equal(result.success, true);
    if (!result.success) return;

    const exec = result.value.execution;
    assert.ok(exec.indicators && exec.evidence && exec.context && exec.reasoning && exec.recommendation);
    const period = periodOf(exec.indicators!);
    assert.ok(period);

    const context = buildExecutiveFinancialContext(
      COMPANY_ID, period!, exec.indicators!, exec.evidence!, exec.context!, exec.reasoning!, exec.recommendation!
    );
    assert.equal(context.identity.companyId, COMPANY_ID);
  });
});

describe("Mission 198 — duplicata/conflito de documento através do orquestrador completo (nunca apenas Indicators)", () => {
  function line(label: string): RawFinancialLine {
    return { label };
  }

  test("DRE reenviada com o mesmo conteúdo (documentId diferente, como um re-upload real) colapsa — nenhuma duplicação de Financial Truth através dos 10 estágios", async () => {
    const dre = buildRealisticDre("rc-dre-dup-1", COMPANY_ID);
    const dreReupload: RawFinancialDocument = {
      documentId: "rc-dre-dup-2",
      companyId: COMPANY_ID,
      source: dre.source,
      lines: dre.lines.map((l) => line(l.label)),
    };
    const balance = buildRealisticBalance("rc-balanco-dup", COMPANY_ID);

    const single = await runFullPipeline(COMPANY_ID, [dre, balance]);
    const duplicated = await runFullPipeline(COMPANY_ID, [dre, dreReupload, balance]);

    assert.equal(single.success, true);
    assert.equal(duplicated.success, true);
    if (!single.success || !duplicated.success) return;

    const marginSingle = single.value.execution.indicators?.indicators.find((i) => i.name === "Margem Bruta")?.result;
    const marginDuplicated = duplicated.value.execution.indicators?.indicators.find((i) => i.name === "Margem Bruta")?.result;
    assert.deepEqual(
      marginDuplicated,
      marginSingle,
      "um re-upload com o mesmo conteúdo econômico nunca pode alterar Financial Truth — deve colapsar para o mesmo resultado exato do envio único"
    );
  });
});
