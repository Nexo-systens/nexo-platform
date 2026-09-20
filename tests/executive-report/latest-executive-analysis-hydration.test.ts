import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { prepareClassifiedDocuments } from "@/app/api/efos/_shared/prepareFinancialDocuments";
import { DefaultEFOSContainer } from "@/efos/application/composition";
import type { ExecutionRepository, ExecutionSnapshot } from "@/efos/application/persistence";
import type { AnalyzeCompanyRequest } from "@/efos/application/dto";
import type { EFOSFacade } from "@/efos/application/facade";
import type { RawFinancialDocument } from "@/efos/engines/data";
import { buildAugustDre, buildRealisticBalance, buildRealisticDre } from "../financial-ingestion/fixtures";

/**
 * Mesmo caminho de classificação usado pela rota real
 * (`POST /api/efos/analyze/[companyId]/executive`, via
 * `prepareFinancialDocuments()`) — o `EFOSFacade` espera documentos JÁ
 * CLASSIFICADOS (`kindHint` por linha), nunca texto bruto direto das
 * fixtures (essas descrevem exatamente o que um Parser real entrega
 * ANTES da classificação, Mission 193 Closure). Nenhum atalho: passar
 * pela mesma `prepareClassifiedDocuments()` que a rota de produção usa.
 */
async function analyze(
  facade: EFOSFacade,
  request: AnalyzeCompanyRequest,
  rawDocuments: readonly RawFinancialDocument[]
) {
  const { documents } = await prepareClassifiedDocuments(rawDocuments);
  return facade.analyzeCompanyWithExecutiveContext(request, documents);
}

/**
 * Mission 199B Closure — Persisted Analysis Hydration. Regressão
 * permanente do Bug P1 confirmado ao vivo: `ExecutiveAnalysisPanel`
 * nunca lia a última execução já persistida ao montar — cada
 * reload/retorno à página de uma empresa com análise concluída voltava
 * a exibir "Nenhuma análise executada ainda", mesmo com uma execução
 * canônica existindo em `public.executions`.
 *
 * Prova, sobre o `EFOSFacade` real (nenhum mock de Analysis/Report
 * Service — apenas `ExecutionRepository` é uma fake em memória, mesmo
 * princípio de composição já usado por `DefaultEFOSContainer`), que
 * `getLatestExecutiveAnalysis(companyId)`:
 *
 * 1. nunca fabrica uma execução para uma empresa sem nenhuma
 *    persistida (`value: undefined`, nunca um erro);
 * 2. reconstrói exatamente o `report`/`executiveContext` já persistido
 *    para uma execução única — mesmos valores, mesmo `executionId`;
 * 3. sempre reflete a execução MAIS RECENTE (nunca a primeira, nunca
 *    uma combinação) depois de uma segunda análise de período
 *    diferente — a mesma autoridade que `HistoricalAnalysisPanel`/
 *    `GET /api/efos/history/:companyId` já leem;
 * 4. nunca roda uma segunda pipeline para produzir esse resultado —
 *    estruturalmente impossível de provar por mock de chamada (a
 *    assinatura pública não aceita `documents`), mas a fake abaixo
 *    também nunca vê `save()` ser chamado por `getLatestExecutiveAnalysis()`
 *    (apenas por `analyzeCompanyWithExecutiveContext()`, antes).
 */

class InMemoryExecutionRepository implements ExecutionRepository {
  readonly snapshots: ExecutionSnapshot[] = [];
  saveCallCount = 0;

  async save(snapshot: ExecutionSnapshot): Promise<void> {
    this.saveCallCount += 1;
    this.snapshots.push(snapshot);
  }

  async findByExecutionId(executionId: string): Promise<ExecutionSnapshot | undefined> {
    return this.snapshots.find(
      (snapshot) => snapshot.execution.pipelineContext.executionId === executionId
    );
  }

  async findByCompany(companyId: string): Promise<readonly ExecutionSnapshot[]> {
    return this.snapshots.filter(
      (snapshot) => snapshot.execution.pipelineContext.companyId === companyId
    );
  }
}

const COMPANY_ID = "hydration-gate-company";

describe("Mission 199B Closure — EFOSFacade.getLatestExecutiveAnalysis() hidrata a partir da execução canônica persistida", () => {
  test("empresa sem nenhuma execução persistida devolve value: undefined, nunca um erro nem uma execução fabricada", async () => {
    const repository = new InMemoryExecutionRepository();
    const facade = new DefaultEFOSContainer(repository).getFacade();

    const result = await facade.getLatestExecutiveAnalysis(COMPANY_ID);

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.value, undefined);
  });

  test("depois de uma análise real, hidrata o MESMO report/executiveContext já persistido — sem rodar uma segunda análise", async () => {
    const repository = new InMemoryExecutionRepository();
    const facade = new DefaultEFOSContainer(repository).getFacade();

    const analysis = await analyze(
      facade,
      { companyId: COMPANY_ID },
      [buildRealisticDre("hydration-dre-1", COMPANY_ID), buildRealisticBalance("hydration-balanco-1", COMPANY_ID)]
    );
    assert.equal(analysis.success, true);
    if (!analysis.success) return;

    assert.equal(repository.saveCallCount, 1, "a análise real deve persistir exatamente uma execução");

    const hydrated = await facade.getLatestExecutiveAnalysis(COMPANY_ID);

    assert.equal(hydrated.success, true);
    if (!hydrated.success || !hydrated.value) {
      assert.fail("getLatestExecutiveAnalysis() deveria encontrar a execução recém-persistida");
      return;
    }

    assert.equal(
      repository.saveCallCount,
      1,
      "getLatestExecutiveAnalysis() é somente leitura — nunca deve persistir uma nova execução"
    );
    assert.equal(
      hydrated.value.report.metadata.executionId,
      analysis.value.report.metadata.executionId,
      "o report hidratado deve ser exatamente o já persistido, identificado pelo mesmo executionId"
    );
    assert.deepEqual(
      hydrated.value.report.summary,
      analysis.value.report.summary,
      "o resumo do report hidratado deve bater byte a byte com o originalmente produzido — nunca recalculado"
    );
    assert.ok(hydrated.value.executiveContext, "executiveContext também deve ser reconstruído (mesma composição pura usada durante a análise real)");
    assert.equal(hydrated.value.executiveContext?.identity.companyId, COMPANY_ID);
  });

  test("depois de uma segunda análise (período diferente), hidrata a execução MAIS RECENTE, nunca a primeira", async () => {
    const repository = new InMemoryExecutionRepository();
    const facade = new DefaultEFOSContainer(repository).getFacade();

    const first = await analyze(
      facade,
      { companyId: COMPANY_ID },
      [buildRealisticDre("hydration-dre-jul", COMPANY_ID), buildRealisticBalance("hydration-balanco-jul", COMPANY_ID)]
    );
    assert.equal(first.success, true);
    if (!first.success) return;

    const second = await analyze(
      facade,
      { companyId: COMPANY_ID },
      [
        buildAugustDre("hydration-dre-ago", COMPANY_ID),
        buildRealisticBalance("hydration-balanco-ago", COMPANY_ID, { asOfDate: "31/08/2026" }),
      ]
    );
    assert.equal(second.success, true);
    if (!second.success) return;

    assert.notEqual(
      first.value.report.metadata.executionId,
      second.value.report.metadata.executionId,
      "as duas análises devem produzir execuções distintas (períodos diferentes, nunca colapsadas)"
    );

    const hydrated = await facade.getLatestExecutiveAnalysis(COMPANY_ID);

    assert.equal(hydrated.success, true);
    if (!hydrated.success || !hydrated.value) {
      assert.fail("getLatestExecutiveAnalysis() deveria encontrar a execução mais recente");
      return;
    }

    assert.equal(
      hydrated.value.report.metadata.executionId,
      second.value.report.metadata.executionId,
      "hidratação deve sempre refletir a execução MAIS RECENTE — nunca a primeira, nunca uma execução arbitrária do histórico"
    );
    assert.notEqual(
      hydrated.value.report.metadata.executionId,
      first.value.report.metadata.executionId
    );
  });
});
