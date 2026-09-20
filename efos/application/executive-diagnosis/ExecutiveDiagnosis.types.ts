/**
 * Tipos de apoio de `ExecutiveDiagnosis` (Mission 115 — Executive
 * Diagnosis Contract). Nenhum destes tipos representa FACT/DECISION/
 * OUTCOME/EXECUTION — são exclusivamente vocabulário de interpretação
 * (Mission 113: INTERPRETATION/HYPOTHESIS, nunca FACT/DECISION).
 */

/**
 * Confiança que a própria Executive AI atribui a uma interpretação —
 * eixo deliberadamente distinto de `EvidenceConfidence`/
 * `ReasoningConfidence` (D-007/D-009, que descrevem confiança num
 * processo **determinístico**). Uma interpretação generativa não tem
 * o mesmo tipo de garantia — vocabulário próprio, nunca reaproveitado
 * dos Engines determinísticos (mesmo princípio de D-009/D-010: eixos
 * de confiança genuinamente diferentes nunca compartilham enum).
 */
export type ExecutiveConfidence = "low" | "medium" | "high";

/**
 * Base de uma interpretação/hipótese/prioridade/ação — sempre aponta
 * para elementos **já existentes** de um `ExecutiveFinancialContext`
 * (D-058): `Indicator.id`, `Evidence.id`, `Context.id`, ou o id de um
 * `ExecutiveConflict` (Mission 114 — hoje sempre `[]`, mas o campo já
 * existe no contrato para quando a detecção for implementada). Nunca
 * um texto livre, nunca uma fonte inventada — a Executive AI só pode
 * apontar para o que o Engine já produziu.
 *
 * `knowledgeIds?` (Mission 148 — Knowledge-Conditioned Executive
 * Decision Intelligence, D-080) — 5ª categoria de referência, aditiva.
 * Aponta para `Knowledge.id` já presente em `knowledgeContext.knowledge`
 * (D-075), nunca um `Knowledge` bruto/não selecionado. Campo IRMÃO dos
 * 4 já existentes, nunca fundido — a distinção estrutural entre CURRENT
 * FACT (`indicatorIds`/`evidenceIds`/`contextIds`/`conflictIds`, todos
 * produzidos por Engines determinísticos sobre Financial Truth) e
 * HISTORICAL EVIDENCE (`knowledgeIds`, produzido por
 * `selectRelevantKnowledge()`/`deriveKnowledgeState()`, D-074/D-078)
 * fica visível no próprio dado, nunca apenas em documentação — mesmo
 * princípio já usado por `context`/`knowledgeContext` (D-075). Citar
 * um `knowledgeId` em `basis` significa apenas "este item CONSIDEROU
 * este Knowledge" — nunca "este Knowledge CAUSOU este item" (Etapa 7
 * da missão: `CAUSED_RECOMMENDATION` e equivalentes são proibidos por
 * construção — este campo é uma lista de referência, não um vínculo
 * causal). Qualquer item que cite `knowledgeIds` continua sujeito aos
 * 4 constraints de D-079 (`RESPECT_KNOWLEDGE_STATE_IN_INTERPRETATION`/
 * `TREAT_MIXED_KNOWLEDGE_STATE_AS_CONFLICTING_EVIDENCE`/
 * `TREAT_WEAKENED_KNOWLEDGE_STATE_AS_REDUCED_CONFIDENCE`/
 * `DO_NOT_TREAT_KNOWLEDGE_STATE_AS_CERTAINTY`) — nenhum constraint novo
 * foi necessário (Etapa 10 da missão: reutilizar antes de criar).
 */
export interface InterpretationBasis {
  readonly indicatorIds?: readonly string[];
  readonly evidenceIds?: readonly string[];
  readonly contextIds?: readonly string[];
  readonly conflictIds?: readonly string[];
  readonly knowledgeIds?: readonly string[];
}

/**
 * Síntese executiva da situação (Etapa 7) — nunca inventa fatos,
 * nunca altera números, nunca substitui indicadores, nunca declara
 * causalidade como certeza. Sempre carrega `basis`, pelo mesmo motivo
 * de `ExecutiveInterpretation`: mesmo o resumo não pode ser
 * livre-flutuante.
 */
export interface ExecutiveSummary {
  readonly statement: string;
  readonly basis: InterpretationBasis;
}

/** Leitura contextual de múltiplos fatos (Etapa 8) — nunca apresentada como fato. */
export interface ExecutiveInterpretation {
  readonly id: string;
  readonly statement: string;
  readonly basis: InterpretationBasis;
  readonly confidence: ExecutiveConfidence;
}

/**
 * Possível explicação para um padrão observado (Etapa 9) —
 * explicitamente distinta de `ExecutiveInterpretation`. `validationNeeded`
 * é obrigatório e não-vazio: uma hipótese sem descrição de como
 * validá-la não é inteligência operacional útil, é apenas especulação.
 */
export interface ExecutiveHypothesis {
  readonly id: string;
  readonly statement: string;
  readonly basis: InterpretationBasis;
  readonly confidence: ExecutiveConfidence;
  readonly validationNeeded: string;
}

/**
 * `"CONFIRMED_SIGNAL"` — o risco é lido diretamente de uma Evidence/
 * Indicator já determinístico (ex.: liquidez abaixo do mínimo).
 * `"INFERRED_RISK"` — o risco depende de correlação/interpretação da
 * própria IA, nunca apresentado com a mesma força que um sinal
 * confirmado (Etapa 10: a IA nunca transforma `signal → certainty`).
 */
export type RiskAssessmentType = "CONFIRMED_SIGNAL" | "INFERRED_RISK";

export interface ExecutiveRiskAssessment {
  readonly id: string;
  readonly statement: string;
  readonly type: RiskAssessmentType;
  readonly basis: InterpretationBasis;
}

/**
 * Prioridade executiva (Etapa 11) — nunca uma `Decision`. `rank` é a
 * ordem relativa (1 = mais prioritário); `reason` é obrigatório e
 * não-vazio — nunca uma prioridade sem justificativa (`priority:
 * "HIGH"` sozinho, sem `reason`/`basis`, é explicitamente rejeitado
 * pelo validator, Etapa 17).
 */
export interface ExecutivePriority {
  readonly id: string;
  readonly rank: number;
  readonly statement: string;
  readonly reason: string;
  readonly basis: InterpretationBasis;
}

/**
 * Vocabulário fechado de ação possível (Etapa 12) — nunca
 * `"EXECUTE"`/`"APPROVE"`/`"REJECT"`/`"DECIDE"` (esses verbos nem
 * existem neste tipo, por construção). Cada valor comunica
 * explicitamente que a ação é uma possibilidade a ser considerada por
 * um humano, nunca uma ordem.
 */
export type PossibleActionKind =
  | "POSSIBLE_ACTION"
  | "OPTION"
  | "INVESTIGATE"
  | "CONSIDER"
  | "VALIDATE";

export interface ExecutivePossibleAction {
  readonly id: string;
  readonly kind: PossibleActionKind;
  readonly statement: string;
  readonly basis: InterpretationBasis;
}

/**
 * Uma pergunta que a Executive AI reconhece precisar ser respondida
 * (Etapa 13) — nunca uma resposta fabricada quando o dado não existe.
 * `raisedFrom`/`relatedId` apontam para o item específico (`Unknown`/
 * `Uncertainty`/`ExecutiveConflict`/`ExecutiveHypothesis`) que
 * motivou a pergunta — uma pergunta nunca surge do nada.
 */
export interface ExecutiveQuestion {
  readonly id: string;
  readonly question: string;
  readonly raisedFrom: "unknown" | "uncertainty" | "conflict" | "hypothesis";
  readonly relatedId?: string;
}

/**
 * Incerteza declarada explicitamente (Etapa 14) — nunca escondida.
 * `reason` explica por que a IA não consegue concluir, nunca apenas
 * "não sei" sem contexto.
 */
export interface ExecutiveUncertainty {
  readonly id: string;
  readonly statement: string;
  readonly reason: string;
}

/**
 * Interpretação de um conflito já preservado pelo Engine (Etapa 15,
 * `ExecutiveConflict`, Mission 114) — a IA pode interpretar a
 * coexistência dos sinais, mas nunca apagar nenhum dos dois nem
 * declarar uma conclusão que o Engine não comprovou (ex.: "a empresa
 * está financeiramente saudável"/"insolvente" sem fundamento
 * determinístico). `conflictSignals` espelha `ExecutiveConflict.signals`
 * (Mission 114) — mesmos textos, nunca reinterpretados.
 */
export interface ExecutiveConflictInterpretation {
  readonly id: string;
  readonly conflictSignals: readonly string[];
  readonly statement: string;
  readonly basis: InterpretationBasis;
}

/**
 * Fronteiras arquiteturais explícitas do diagnóstico (Etapa 16) — um
 * tipo literal fechado: os 5 campos só podem ser `true`, nunca
 * `false`/omitidos. Existe exatamente **um** valor válido deste tipo
 * — ver `DIAGNOSIS_BOUNDARIES` (`ExecutiveDiagnosis.ts`) — a
 * separação arquitetural fica visível no próprio contrato, nunca
 * apenas em documentação externa.
 */
export interface DiagnosisBoundaries {
  readonly doesNotChangeFinancialTruth: true;
  readonly doesNotMakeDecisions: true;
  readonly doesNotExecuteActions: true;
  readonly containsInterpretations: true;
  readonly containsHypotheses: true;
}
