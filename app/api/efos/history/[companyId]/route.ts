import { NextResponse } from "next/server";

import { DefaultHistoricalExecutionService } from "@/efos/application/history";
import { SupabaseExecutionRepository } from "@/efos/infrastructure/repositories";
import { SupabasePersistenceClient } from "@/efos/infrastructure/providers";
import { createClient } from "@/lib/supabase/server";

import { buildHistoryResponse } from "../../_shared/HistoryResponse";

// Mission 087 — NEXO Historical & Comparative Intelligence Experience:
// primeira rota somente leitura sobre o histórico já persistido de uma
// empresa. Fluxo obrigatório da missão, seguido à risca:
// ExecutionRepository -> HistoricalExecutionService -> HistoricalExecution[]
// -> compareExecutions() -> ExecutionComparison -> NEXO UI. Nenhum
// calculo/interpretacao acontece aqui — apenas orquestracao (mesmo
// espirito de EFOSPlatform, D-043) e projecao para um contrato de
// apresentacao menor (HistoryResponse, `../../_shared/HistoryResponse.ts`)
// que nunca expoe ExecutionSnapshot/ExecutiveReport inteiros.
//
// `SupabaseExecutionRepository`/`SupabasePersistenceClient` sao
// instanciados diretamente aqui (mesmo padrao ja usado por
// `DefaultInfrastructureContainer`, Mission 038) — nao existe hoje um
// Composition Root que exponha `ExecutionRepository` isoladamente (o
// existente so monta a cadeia inteira ate `EFOSFacade`, que essa rota
// nao precisa). Nenhum novo Composition Root foi criado; nenhuma
// alteracao em `DefaultInfrastructureContainer`/`EFOSBootstrap`/
// `EFOSPlatform`.
//
// Sessao/RLS: `createClient()` (`lib/supabase/server.ts`) — mesmo
// client de sessao ja usado por toda a Plataforma, nunca
// `service_role`. `ExecutionRepository.findByCompany()` so devolve
// execucoes cujo `company_id` passa pela RLS de `public.executions`
// (D-043) — companyId de outra empresa simplesmente devolve historico
// vazio, nunca um erro nem dado de outra empresa.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const previousExecutionId =
    new URL(request.url).searchParams.get("previousExecutionId") ?? undefined;

  try {
    const supabaseClient = await createClient();
    const persistenceClient = new SupabasePersistenceClient(supabaseClient);
    const executionRepository = new SupabaseExecutionRepository(persistenceClient);
    const historicalExecutionService = new DefaultHistoricalExecutionService(
      executionRepository
    );

    const history = await historicalExecutionService.getHistory(companyId);
    const response = buildHistoryResponse(companyId, history, previousExecutionId);

    return NextResponse.json({ success: true, value: response });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unexpected",
          message:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao carregar o histórico.",
        },
      },
      { status: 500 }
    );
  }
}
