"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/services/auth.service";
import { getCompanyById } from "@/modules/companies/services/company.service";
import { saveHumanDecision, type PersistedDecision } from "@/modules/decisions/services/decision-persistence.service";
import { resolveScenarioBaseline } from "./scenario-simulation.actions";
import { composeScenarioDecision, type ScenarioDecisionRequest } from "@/modules/scenarios/lib/composeScenarioDecision";

/**
 * Mission 184 — Scenario-to-Decision Governance Bridge. Revisada pela
 * Mission 184 Closure — Exact Scenario Baseline Identity & Decision
 * Consent.
 *
 * A ponte explícita entre Scenario Lab (Missions 180-183) e a
 * governança de Decision já existente (D-063/D-082, Missions 123-179):
 * "depois de analisar alternativas, como um executivo pode levar
 * formalmente o cenário escolhido para uma decisão real?" — nunca
 * automaticamente (Seção 4: "the action must be explicit. No automatic
 * transition"), nunca criando uma Recommendation fictícia (Seção 7),
 * nunca confiando em nenhum valor projetado enviado pelo browser
 * (Seção 17/18).
 *
 * **Fluxo (Seção 4/18, identidade exata pela Closure)**: 1. resolve
 * usuário autenticado + acesso à empresa (mesmo padrão de
 * `createHumanDecisionAction()`); 2. resolve o baseline canônico ATUAL
 * via `resolveScenarioBaseline()` (D-088/089/090, MESMA função já
 * usada por `simulateScenarioAction()`/`compareScenariosAction()` —
 * nunca uma segunda implementação) — esta resolução JÁ rejeita
 * (`ambiguous`/`"conflicting"`) se existir mais de uma execução para o
 * período mais recente com conteúdo financeiro materialmente diferente
 * (`resolveCurrentFinancialExecution()`, Mission 176 Closure/Final
 * Closure, D-088/Mission 170C) — a primeira e mais forte camada de
 * defesa contra "mesmo período, verdade diferente"; 3. compara a
 * IDENTIDADE EXATA desse baseline (`ScenarioBaselineIdentity` —
 * `Period` + impressão digital do `FinancialModel`, nunca apenas
 * `Period` sozinho — D-088 é explícito: mesmo período nunca implica
 * mesma verdade) com `input.evaluatedBaselineIdentity` (a reivindicação
 * que o cenário exibido ao executivo já carregava) — se divergirem,
 * FALHA FECHADO (Seção 19: "no silent recompute against a newer/
 * different baseline, no silent success"); 4. RECOMPUTA o(s) cenário(s)
 * do zero, a partir do baseline atual e da mesma hipótese
 * (`runSingleScenario()`, mesma função pura já usada pelas duas Server
 * Actions de simulação) — o único dado que o browser fornece com
 * autoridade é a HIPÓTESE (direção + magnitude), nunca um valor
 * projetado/delta/EBITDA calculado no client; 5. monta um
 * `ScenarioDecisionContext` mínimo a partir da simulação genuinamente
 * recomputada, registrando a impressão digital exata confirmada; 6.
 * delega a criação da `Decision` inteiramente a `createHumanDecision()`
 * (Mission 124, D-063) — a MESMA composição pura já usada por
 * `createHumanDecisionAction()`, nunca uma segunda forma de produzir
 * uma `Decision`.
 *
 * **Fronteira de confiança (Seção 12/15 da Closure)**: `evaluatedBaselineIdentity`
 * é sempre uma REIVINDICAÇÃO do que o executivo viu, nunca autoridade
 * — o servidor sempre recomputa `ScenarioBaselineIdentity` do zero a
 * partir do `FinancialModel` recém-resolvido e só compara; uma
 * reivindicação adulterada nunca concede acesso, apenas causa uma
 * rejeição segura (mesma disciplina de `evaluatedPeriod` original).
 *
 * **Isolamento de empresa (Seção 21)**: nunca um mecanismo novo —
 * `resolveScenarioBaseline()`/`runSingleScenario()` já recebem
 * `companyId` e já rejeitam com `"company-mismatch"` quando a
 * execução resolvida não pertence à empresa informada (mesma defesa
 * em profundidade das Missions 180-183).
 *
 * **Nunca**: cria/referencia uma Recommendation (Seção 7); persiste um
 * `Scenario` com identidade própria (Seção 16 — o "snapshot" vive
 * inteiramente dentro do `Decision` já persistido, D-066, `decision
 * jsonb`, zero migration nova); cria Outcome/Evidence/Learning/
 * Knowledge; chama IA/Anthropic; permite que a mesma chamada produza
 * mais de uma `Decision` (Seção 29 — um clique explícito → uma única
 * `Decision`).
 */

/**
 * Mission 210 (D-135): o miolo puro (origem, identidade exata do baseline,
 * recomputação e composição) vive em `composeScenarioDecision()` — o mesmo
 * código que os testes executam. `proposedBy` só aceita o vocabulário
 * fechado; a decisão vinda do Executive Chat passa por este mesmo caminho,
 * nunca por um segundo.
 */
export type CreateScenarioDecisionInput = ScenarioDecisionRequest;

export type CreateScenarioDecisionResult =
  | { readonly success: true; readonly decision: PersistedDecision }
  | {
      readonly success: false;
      readonly error: string;
      readonly stage: "auth" | "access" | "financial-truth" | "stale-baseline" | "assumption" | "command";
      readonly errors?: readonly string[];
    };

export async function createScenarioDecisionAction(
  input: CreateScenarioDecisionInput
): Promise<CreateScenarioDecisionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, stage: "auth", error: "Sessão expirada. Faça login novamente." };
  }

  // Empresa sob RLS e ainda ativa: `getCompanyById()` exclui empresa
  // encerrada (`deleted_at`) — mesma resposta de inexistente ou de outra
  // empresa (Missions 200/202). A policy de INSERT de `decisions` repete a
  // checagem no banco.
  const company = await getCompanyById(input.companyId);
  if (!company) {
    return { success: false, stage: "access", error: "Empresa não encontrada ou sem acesso." };
  }

  const baseline = await resolveScenarioBaseline(input.companyId);
  if (baseline.outcome === "rejected") {
    return { success: false, stage: "financial-truth", error: baseline.error };
  }

  const composed = composeScenarioDecision(input, user.id, baseline, randomUUID(), new Date().toISOString());
  if (!composed.success) {
    return composed;
  }

  const persisted = await saveHumanDecision(composed.decision);
  revalidatePath(`/companies/${input.companyId}`);
  return { success: true, decision: persisted };
}
