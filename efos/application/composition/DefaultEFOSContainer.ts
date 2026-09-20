import { DefaultEFOSFacade } from "../facade";
import type { EFOSFacade } from "../facade";
import { DefaultHistoricalExecutionService } from "../history";
import type { HistoricalExecutionService } from "../history";
import { DefaultDocumentIntake } from "../intake";
import type { DocumentIntake } from "../intake";
import { EFOSPipelineRuntime } from "../orchestrators";
import type { EFOSPipelineOrchestrator } from "../orchestrators";
import type { ExecutionRepository } from "../persistence";
import { DefaultAnalysisService, DefaultReportService } from "../services";
import type { AnalysisService, ReportService } from "../services";

import type { EFOSContainer } from "./EFOSContainer";

/**
 * Primeira implementação concreta de `EFOSContainer` (Mission 024 —
 * Composition Root). Única classe do sistema autorizada a
 * instanciar (`new`) `EFOSPipelineRuntime`, `DefaultDocumentIntake`
 * (Mission 026), `DefaultAnalysisService`, `DefaultReportService` e
 * `DefaultEFOSFacade` — toda a montagem dos componentes do EFOS
 * acontece exclusivamente aqui, na ordem oficial:
 *
 * ```
 * EFOSPipelineRuntime (implementa EFOSPipelineOrchestrator)
 * DocumentIntake (DefaultDocumentIntake, sem dependências)
 *         ↓
 * AnalysisService (DefaultAnalysisService, recebe o Orchestrator + o DocumentIntake)
 *         ↓
 * ReportService (DefaultReportService, sem dependências)
 *         ↓
 * EFOSFacade (DefaultEFOSFacade, recebe os dois Services + o ExecutionRepository)
 * ```
 *
 * Apenas montagem — nenhuma regra de negócio, nenhum cálculo, nenhum
 * acesso a Engine/Domain diretamente. `getFacade()` devolve sempre a
 * mesma instância já montada (construída uma única vez no
 * construtor) — nunca remonta o grafo de dependências a cada
 * chamada.
 *
 * Desde a Mission 037 (Automatic Execution Persistence, D-028), o
 * construtor recebe `executionRepository: ExecutionRepository`
 * (`efos/application/persistence/ExecutionRepository.ts`, Mission 027)
 * — nunca instancia uma implementação concreta (ex.:
 * `SupabaseExecutionRepository`, `efos/infrastructure/repositories/`)
 * internamente. A Application Layer nunca importa a Infrastructure
 * Layer diretamente (`docs/AI_START.md`, ordem de dependências: Domain
 * → Domain Events → EFOS Engines → Application → Experience →
 * Infrastructure — Infrastructure depende da Application, nunca o
 * contrário); quem monta um `SupabaseExecutionRepository` real (com um
 * `SupabaseClient` de verdade, `SupabasePersistenceClient`, Mission
 * 032) e o passa para `new DefaultEFOSContainer(executionRepository)` é
 * um futuro ponto de composição fora de `efos/` (ex.: um bootstrap da
 * Plataforma), ainda não construído.
 *
 * Desde a Mission 066 (Executive Report Persistence, D-038, revisando
 * D-028), `executionRepository` é repassado para `DefaultEFOSFacade`
 * em vez de `DefaultAnalysisService` — a persistência automática
 * migrou para o único ponto que já possui `metadata`+`execution`+
 * `report` juntos. A assinatura pública deste construtor não mudou.
 */
export class DefaultEFOSContainer implements EFOSContainer {
  private readonly facade: EFOSFacade;

  constructor(executionRepository: ExecutionRepository) {
    const runtime: EFOSPipelineOrchestrator = new EFOSPipelineRuntime();
    const documentIntake: DocumentIntake = new DefaultDocumentIntake();
    const analysisService: AnalysisService = new DefaultAnalysisService(
      runtime,
      documentIntake
    );
    const reportService: ReportService = new DefaultReportService();

    // Mission 173 — Production Executive Financial Context
    // Orchestrator. `historicalExecutionService` reaproveita o MESMO
    // `executionRepository` já recebido — nenhuma implementação
    // concreta de Infrastructure é instanciada aqui (mesmo princípio já
    // documentado acima para `executionRepository`). Assinatura pública
    // deste construtor não mudou.
    const historicalExecutionService: HistoricalExecutionService =
      new DefaultHistoricalExecutionService(executionRepository);

    this.facade = new DefaultEFOSFacade(
      analysisService,
      reportService,
      executionRepository,
      historicalExecutionService
    );
  }

  getFacade(): EFOSFacade {
    return this.facade;
  }
}
