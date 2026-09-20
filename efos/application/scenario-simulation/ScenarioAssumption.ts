import type { Money } from "@/efos/domain";

/**
 * Mission 180 — Scenario Intelligence Foundation & First Real
 * Simulation. Revisado pela Mission 182 — Scenario Engine
 * Generalization (D-092).
 *
 * Contrato tipado da hipótese da vertical de mudança de Despesas
 * Operacionais (Seção 7/8/9 da Mission 180). Escolhida em vez de
 * "mudança de receita" precisamente porque não exige inventar uma
 * relação financeira não suportada pelo modelo atual —
 * `operatingExpenses` já é um campo de entrada direto de
 * `FinancialStatementInputs` (`efos/engines/indicators/indicators.types.ts`),
 * então alterá-lo não requer decompor custos fixos/variáveis (o
 * problema explícito da Seção 8 para "Receita +20%").
 *
 * Nunca um `Record<string, number>` genérico, nunca uma DSL universal
 * (Seção 9) — apenas este único campo assinado, com moeda explícita
 * (reaproveita `Money`, nunca um `number` cru).
 *
 * **Correção da Mission 182 (D-092)**: `scenarioType` era
 * `Extract<ScenarioType, "hire" | "reduce_workforce">` — reaproveitando
 * duas narrativas de AÇÃO de negócio (Camada 6 da Ontologia) como se
 * fossem as duas metades assinadas de um mecanismo genérico. A própria
 * Mission 181 já havia identificado essa imprecisão (por isso nunca
 * expôs esses rótulos na UI). Com uma segunda vertical (mudança de
 * prazo de recebimento) provando que o padrão certo é um valor de
 * `ScenarioType` por MECANISMO financeiro, não por narrativa de ação,
 * `scenarioType` passa a ser o literal único `"adjust_operating_costs"`
 * — a direção (aumento/redução) já está inteiramente capturada pelo
 * sinal de `operatingExpensesDelta.amount`, nunca precisando de dois
 * valores de enum para o mesmo mecanismo. Nenhum dado persistido a
 * migrar (Scenario Lab nunca persiste, D-091).
 */
export interface OperatingCostChangeAssumption {
  readonly kind: "operating_cost_change";
  readonly scenarioType: "adjust_operating_costs";
  /**
   * Delta assinado sobre `operatingExpenses` do período base — negativo
   * = redução, positivo = aumento. Nunca `0` como valor válido aqui —
   * um cenário deve representar uma mudança real; o caso "mudança
   * zero" (Seção 21) é provado diretamente sobre o núcleo numérico puro
   * (`deriveIncomeStatementResults`), não sobre este contrato.
   */
  readonly operatingExpensesDelta: Money;
}

export type OperatingCostAssumptionValidationFailure =
  | { readonly valid: false; readonly reason: "non-finite-amount" }
  | { readonly valid: false; readonly reason: "zero-amount" }
  | { readonly valid: false; readonly reason: "would-make-operating-expenses-negative" };

export type OperatingCostAssumptionValidationResult =
  | { readonly valid: true }
  | OperatingCostAssumptionValidationFailure;

/**
 * Validação explícita da hipótese ANTES de qualquer recálculo (Seção 8
 * — "Reject False Simulation" — e Seção 27 — "Fail Closed"). Nunca
 * inventa/corrige um valor inválido silenciosamente; apenas classifica
 * o motivo da rejeição.
 *
 * **Mission 182**: a checagem de `"sign-type-mismatch"` foi removida —
 * ela só existia porque `scenarioType` antes carregava a direção
 * (`hire`/`reduce_workforce`); agora que `scenarioType` é um literal
 * único e a direção vive inteiramente no sinal de `amount`, não há mais
 * dois valores para conferir consistência entre si.
 *
 * `baselineOperatingExpenses` é necessário para a última checagem: uma
 * redução não pode fazer a despesa operacional projetada ficar
 * negativa — despesa operacional negativa não tem significado
 * financeiro válido neste modelo (Seção 23 — nenhuma garantia contábil
 * além das que o `FinancialModel` já suporta, mas um valor
 * estruturalmente impossível nunca é aceito).
 */
export function validateOperatingCostChangeAssumption(
  assumption: OperatingCostChangeAssumption,
  baselineOperatingExpenses: number
): OperatingCostAssumptionValidationResult {
  const amount = assumption.operatingExpensesDelta.amount;

  if (!Number.isFinite(amount)) {
    return { valid: false, reason: "non-finite-amount" };
  }

  if (amount === 0) {
    return { valid: false, reason: "zero-amount" };
  }

  if (baselineOperatingExpenses + amount < 0) {
    return { valid: false, reason: "would-make-operating-expenses-negative" };
  }

  return { valid: true };
}

/**
 * Mission 182 — Scenario Engine Generalization & Second Financial
 * Vertical.
 *
 * Contrato tipado da hipótese da segunda vertical: uma mudança
 * assinada, em DIAS, sobre o Prazo Médio de Recebimento (DSO) da
 * empresa — "e se meus clientes demorarem N dias a mais/a menos para
 * pagar?" (Seção 23 — pergunta de negócio, nunca "Modificar DSO").
 *
 * **Por que dias, e não um valor monetário de Contas a Receber
 * diretamente**: Prazo Médio de Recebimento (`averageReceiptPeriod`,
 * `indicators.calculator.ts`) já é o indicador canônico e em produção
 * que a própria Application Layer usa para expressar essa noção — a
 * mesma fórmula (`(Contas a Receber / Receita) × Dias no Período`) é
 * reaproveitada por `simulateCollectionPeriodScenario()` apenas
 * invertida (resolvida para Contas a Receber dado um DSO-alvo, nunca
 * uma segunda fórmula) — E é a forma como um executivo genuinamente
 * fala sobre isso (Seção 23 da missão).
 *
 * **Timing não é Receita (Seção 6)**: esta hipótese NUNCA altera
 * `revenue`. Prazo de recebimento é uma transformação de ESTOQUE
 * (saldo de Contas a Receber, balanço patrimonial) usando uma razão
 * normalizada por FLUXO (Receita do período) como veículo — nunca uma
 * mudança do próprio fluxo. Ver `simulateCollectionPeriodScenario.ts`
 * para a prova algébrica de que Receita/CMV/Despesas
 * Operacionais/Juros permanecem bit-a-bit inalterados.
 *
 * Nunca um `Record<string, number>` genérico, nunca uma DSL universal —
 * apenas este único campo assinado, em dias (unidade explícita pelo
 * próprio nome do campo, nunca ambígua com moeda ou percentual).
 */
export interface CollectionPeriodChangeAssumption {
  readonly kind: "collection_period_change";
  readonly scenarioType: "adjust_collection_terms";
  /**
   * Delta assinado, em dias, sobre o Prazo Médio de Recebimento atual —
   * positivo = clientes demoram MAIS para pagar (adverso para caixa);
   * negativo = clientes pagam MAIS RÁPIDO (favorável para caixa). Nunca
   * `0` como valor válido aqui, mesmo princípio de
   * `OperatingCostChangeAssumption.operatingExpensesDelta`.
   */
  readonly collectionPeriodDeltaDays: number;
}

export type CollectionPeriodAssumptionValidationFailure =
  | { readonly valid: false; readonly reason: "non-finite-delta" }
  | { readonly valid: false; readonly reason: "zero-delta" }
  | { readonly valid: false; readonly reason: "would-make-collection-period-negative" }
  | { readonly valid: false; readonly reason: "would-make-cash-negative" };

export type CollectionPeriodAssumptionValidationResult =
  | { readonly valid: true }
  | CollectionPeriodAssumptionValidationFailure;

/**
 * Validação explícita da hipótese ANTES de qualquer recálculo — mesma
 * disciplina fail-closed de `validateOperatingCostChangeAssumption()`,
 * nunca compartilhada por uma abstração genérica (Seção 14 — "It is
 * acceptable and preferable... to remain specialized"): as quantidades
 * validadas (dias de prazo vs. valor monetário de despesa) e os
 * motivos de rejeição são genuinamente distintos entre as duas
 * verticais.
 *
 * `baselineCollectionPeriodDays`/`baselineCash`/`projectedCashDelta`
 * são necessários para as duas últimas checagens: um prazo projetado
 * negativo não tem significado (não existe "prazo de recebimento
 * negativo"); e uma redução de prazo tão grande que o caixa projetado
 * ficaria negativo é estruturalmente impossível (nunca aceita,
 * análogo a `would-make-operating-expenses-negative`).
 */
export function validateCollectionPeriodChangeAssumption(
  assumption: CollectionPeriodChangeAssumption,
  baselineCollectionPeriodDays: number,
  baselineCash: number,
  projectedCashDelta: number
): CollectionPeriodAssumptionValidationResult {
  const delta = assumption.collectionPeriodDeltaDays;

  if (!Number.isFinite(delta)) {
    return { valid: false, reason: "non-finite-delta" };
  }

  if (delta === 0) {
    return { valid: false, reason: "zero-delta" };
  }

  if (baselineCollectionPeriodDays + delta < 0) {
    return { valid: false, reason: "would-make-collection-period-negative" };
  }

  if (baselineCash + projectedCashDelta < 0) {
    return { valid: false, reason: "would-make-cash-negative" };
  }

  return { valid: true };
}

/**
 * Mission 182 — união discriminada (Seção 13: "extract only common
 * semantics proven by both" verticais). Nunca um `Record<string,
 * unknown>`/DSL genérica — cada membro continua um contrato nomeado e
 * fechado; o único ponto compartilhado é o discriminante `kind`, usado
 * por `ScenarioProjection.assumption` (`ScenarioProjection.ts`) para
 * que o mesmo contrato de resultado represente qualquer uma das duas
 * verticais sem `any`.
 */
export type ScenarioAssumption = OperatingCostChangeAssumption | CollectionPeriodChangeAssumption;
