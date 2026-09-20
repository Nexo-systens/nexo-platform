import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApplicationResult } from "@/efos/application/contracts";
import type { AnalyzeCompanyRequest } from "@/efos/application/dto";
import type { EFOSFacade } from "@/efos/application/facade";
import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";
import type { ExecutiveReport } from "@/efos/application/report";
import { EFOSBootstrap } from "@/efos/bootstrap";
import type { StatementConflict } from "@/efos/domain";
import type { RawFinancialDocument } from "@/efos/engines/data";
import type { StatementArithmeticIssue } from "@/efos/engines/indicators";

/**
 * Primeiro ponto oficial de entrada da plataforma EFOS (Mission 040 —
 * First Platform Entry Point). Fecha, do lado do chamador, a cadeia de
 * composição já montada pelo Bootstrap (`efos/bootstrap/EFOSBootstrap.ts`,
 * Mission 039):
 *
 * ```
 * SupabaseClient (recebido via construtor, nunca criado aqui)
 *         ↓
 * EFOSBootstrap (Mission 039)
 *         ↓
 * EFOSFacade (getFacade())
 *         ↓
 * analyzeCompany(companyId) → AnalysisService → Pipeline →
 * ExecutionRepository (persistência automática, D-028) → ExecutiveReport
 *         ↓
 * retorno ao chamador (ApplicationResult<ExecutiveReport>)
 * ```
 *
 * Recebe `supabaseClient: SupabaseClient` via construtor — nunca
 * chama `createClient()`/`createBrowserClient()`/`createServerClient()`
 * internamente, mesmo princípio já estabelecido por
 * `SupabasePersistenceClient` (D-026), `DefaultInfrastructureContainer`
 * (D-029) e `EFOSBootstrap`: reutiliza qualquer instância já criada
 * por quem o instancia (ex.: `lib/supabase/client.ts`/`server.ts`),
 * nunca cria uma segunda.
 *
 * Único método público: `analyzeCompany(companyId, documents?)` —
 * monta o `AnalyzeCompanyRequest` oficial (`{ companyId }`, Mission
 * 017) e repassa, junto de `documents`, para `EFOSFacade.analyzeCompany()`.
 * `EFOSPlatform` nunca executa Engines/Runtime/Services diretamente;
 * apenas instancia o Bootstrap e repassa a chamada para a `EFOSFacade`
 * já montada por ele.
 *
 * `documents` (Mission 044 — End-to-End Document Flow) é um segundo
 * parâmetro opcional, default `[]` — mesmo padrão já usado por
 * `AnalysisService.analyze()` (Mission 026, D-022) e agora por
 * `EFOSFacade.analyzeCompany()`; nenhum DTO novo, reaproveita
 * `RawFinancialDocument` (contrato oficial do Data Engine). Fecha a
 * lacuna registrada em D-031: os documentos preparados pelo Upload
 * API (`app/api/efos/upload/route.ts`, Mission 042/043) agora chegam
 * de fato até `PipelineContext.metadata.documents` (D-016) e o Data
 * Engine.
 *
 * **Mission 175 — Production Executive Analysis API**: ganhou um
 * segundo método público, `analyzeCompanyWithExecutiveContext()` —
 * espelha `analyzeCompany()` byte a byte (mesmo `AnalyzeCompanyRequest`,
 * mesmo parâmetro `documents`), repassando apenas para o método
 * ADITIVO já existente na `EFOSFacade` desde a Mission 173. Nunca uma
 * segunda pipeline: ambos os métodos desta classe repassam para a
 * MESMA `facade` já montada pelo Bootstrap, que por sua vez
 * compartilha `runAnalysisAndPersist()` internamente (Mission 174) —
 * uma única análise, uma única persistência, por chamada.
 */
export class EFOSPlatform {
  private readonly facade: EFOSFacade;

  constructor(supabaseClient: SupabaseClient) {
    const bootstrap = new EFOSBootstrap(supabaseClient);

    this.facade = bootstrap.getFacade();
  }

  async analyzeCompany(
    companyId: string,
    documents: readonly RawFinancialDocument[] = [],
    conflicts?: readonly StatementConflict[]
  ): Promise<ApplicationResult<ExecutiveReport>> {
    const request: AnalyzeCompanyRequest = { companyId };

    return this.facade.analyzeCompany(request, documents, conflicts);
  }

  async analyzeCompanyWithExecutiveContext(
    companyId: string,
    documents: readonly RawFinancialDocument[] = [],
    conflicts?: readonly StatementConflict[]
  ): Promise<
    ApplicationResult<{
      readonly report: ExecutiveReport;
      readonly executiveContext?: ExecutiveFinancialContext;
      readonly statementArithmeticIssues: readonly StatementArithmeticIssue[];
    }>
  > {
    const request: AnalyzeCompanyRequest = { companyId };

    return this.facade.analyzeCompanyWithExecutiveContext(request, documents, conflicts);
  }
}
