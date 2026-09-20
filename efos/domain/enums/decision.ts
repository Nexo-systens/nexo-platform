/**
 * Enums do ciclo Cenario -> Recomendacao -> Decisao -> Resultado
 * (docs/00_FUNDACION/EXECUTIVE FINANCIAL ONTOLOGY.md, Camadas 6-8;
 * docs/01_ARCHITECTURE/04_DOMAIN MODEL.md).
 *
 * `"adjust_operating_costs"`/`"adjust_collection_terms"` (Mission 182,
 * D-092): os 7 valores originais descrevem AÇÕES de negócio
 * ("contratar", "reduzir equipe", "buscar crédito"...) — a Mission 180
 * reaproveitou `"hire"`/`"reduce_workforce"` como as duas metades
 * assinadas de um único mecanismo financeiro (uma mudança direta,
 * bidirecional, em Despesas Operacionais), o que a própria Mission 181
 * já havia identificado como impreciso o bastante para nunca ser
 * exposto na UI. Com uma segunda vertical (mudança de prazo de
 * recebimento) genuinamente não representável por nenhum dos 7 valores
 * originais, a Mission 182 audita a pergunta diretamente: forçar essa
 * vertical num rótulo de ação de negócio já existente fabricaria uma
 * semântica falsa (ex.: chamar "prazo de recebimento" de
 * "increase_price"). Os dois novos valores nomeiam o MECANISMO
 * financeiro em si (o que a Application Layer de fato calcula), nunca
 * uma narrativa de negócio específica — e substituem o reuso impreciso
 * de `"hire"`/`"reduce_workforce"` por Despesas Operacionais (nenhum
 * dado persistido a migrar: Scenario Lab nunca persiste, D-091/Seção
 * 18 da Mission 180). Os 7 valores originais permanecem no enum,
 * intocados — continuam a vocabulário correto para uma futura vertical
 * que genuinamente module a AÇÃO de negócio (ex.: contratação com
 * custo por funcionário real), não apenas seu efeito numérico agregado.
 */

export const SCENARIO_TYPES = [
  "hire",
  "reduce_workforce",
  "raise_credit",
  "buy_equipment",
  "open_branch",
  "increase_price",
  "launch_product",
  "adjust_operating_costs",
  "adjust_collection_terms",
] as const;
export type ScenarioType = (typeof SCENARIO_TYPES)[number];

/**
 * Valores atualizados na Mission 012 (Recommendation Engine — D-010):
 * `"urgent"` (Mission 003, nunca consumido por nenhum Engine) foi
 * substituido por `"critical"`, alinhando com o vocabulario pedido
 * explicitamente pela missao e com o mesmo rotulo usado por
 * `EvidenceSeverity`/`ContextSeverity`.
 */
export const RECOMMENDATION_PRIORITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

/**
 * Natureza da decisao executiva produzida pelo Decision Engine
 * (Mission 013). Conjunto minimo e fechado — apenas 2 valores, cada um
 * mapeado a uma regra deterministica em `decision.builder.ts`.
 * Conceito distinto de `RecommendationType` (que descreve a acao de
 * negocio proposta): `DecisionType` descreve a postura de priorizacao
 * do Decision Engine em si (docs/DECISIONS.md D-011).
 */
export const DECISION_TYPES = [
  "execute_immediately",
  "prioritize_sequence",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const OUTCOME_STATUSES = [
  "pending",
  "positive",
  "negative",
  "neutral",
  "inconclusive",
] as const;
export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];
