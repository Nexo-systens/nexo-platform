import type { ExecutiveDiagnosis } from "./ExecutiveDiagnosis";
import type {
  InterpretationBasis,
  PossibleActionKind,
} from "./ExecutiveDiagnosis.types";
import {
  RECOMMENDATION_REFERENCE_CATEGORIES,
  type RecommendationReferenceCategory,
} from "./traceRecommendationReference";

export interface ExecutiveDiagnosisValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const ALLOWED_POSSIBLE_ACTION_KINDS: readonly PossibleActionKind[] = [
  "POSSIBLE_ACTION",
  "OPTION",
  "INVESTIGATE",
  "CONSIDER",
  "VALIDATE",
];

/**
 * Campos que, se presentes em um `ExecutiveDiagnosis` recebido de
 * fora (ex.: de uma futura integração de IA, antes de qualquer
 * validação de tipo em runtime), indicariam uma tentativa de produzir
 * Decision/Outcome/Execution/Financial Truth como se fosse saída da
 * IA — nenhum deles é um campo do contrato `ExecutiveDiagnosis`
 * (Etapa 17, "Contradição de autoridade"). Checagem defensiva em
 * runtime: o `readonly`/tipo estrito do TypeScript já impede isso em
 * tempo de compilação para código que constrói o objeto diretamente,
 * mas um payload desserializado de uma fonte externa (JSON de uma API
 * de IA) não passa pelo compilador — só por este validator.
 */
const FORBIDDEN_AUTHORITY_KEYS = [
  "decision",
  "decisions",
  "outcome",
  "outcomes",
  "execution",
  "executions",
  "financialTruth",
  "indicators",
  "resources",
  "financialEvents",
] as const;

function basisIsEmpty(basis: InterpretationBasis | undefined): boolean {
  if (!basis) return true;
  return (
    (!basis.indicatorIds || basis.indicatorIds.length === 0) &&
    (!basis.evidenceIds || basis.evidenceIds.length === 0) &&
    (!basis.contextIds || basis.contextIds.length === 0) &&
    (!basis.conflictIds || basis.conflictIds.length === 0) &&
    // Mission 148 — Knowledge-Conditioned Executive Decision
    // Intelligence (D-080): `knowledgeIds` conta como base rastreável
    // real, mesmo padrão dos outros 4 campos — um item cuja ÚNICA
    // referência é a um Knowledge selecionado continua tendo basis,
    // nunca é tratado como livre-flutuante.
    (!basis.knowledgeIds || basis.knowledgeIds.length === 0)
  );
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Valida um `ExecutiveDiagnosis` contra as regras mínimas de
 * integridade da Mission 115 (Etapa 17) — nunca valida conteúdo
 * semântico ("esta interpretação faz sentido?"), apenas a estrutura
 * que separa interpretação de fato: toda interpretação/hipótese/
 * prioridade precisa de base rastreável; hipótese precisa de
 * `validationNeeded`; prioridade precisa de `reason`; ação possível
 * só pode usar o vocabulário fechado permitido; nenhum campo de
 * autoridade proibida (Decision/Outcome/Execution/Financial Truth)
 * pode estar presente. Função pura — nunca lança exceção, sempre
 * devolve a lista completa de problemas encontrados (não para no
 * primeiro erro), para que um consumidor veja o diagnóstico inteiro
 * de uma vez.
 */
export function validateExecutiveDiagnosis(
  diagnosis: ExecutiveDiagnosis
): ExecutiveDiagnosisValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(diagnosis.id)) {
    errors.push("ExecutiveDiagnosis.id é obrigatório e não pode ser vazio.");
  }

  if (!isNonEmptyString(diagnosis.basedOn?.generatedAt)) {
    errors.push("ExecutiveDiagnosis.basedOn.generatedAt é obrigatório.");
  }

  if (!isNonEmptyString(diagnosis.executiveSummary?.statement)) {
    errors.push("executiveSummary.statement é obrigatório e não pode ser vazio.");
  }
  if (basisIsEmpty(diagnosis.executiveSummary?.basis)) {
    errors.push(
      "executiveSummary sem basis — o resumo executivo nunca pode ser livre-flutuante, mesmo sendo uma síntese."
    );
  }

  diagnosis.interpretations.forEach((interpretation, index) => {
    if (!isNonEmptyString(interpretation.statement)) {
      errors.push(`interpretations[${index}] sem statement.`);
    }
    if (basisIsEmpty(interpretation.basis)) {
      errors.push(
        `interpretations[${index}] ("${interpretation.statement}") sem basis — toda interpretação precisa apontar para elementos existentes do ExecutiveFinancialContext.`
      );
    }
  });

  diagnosis.hypotheses.forEach((hypothesis, index) => {
    if (basisIsEmpty(hypothesis.basis)) {
      errors.push(`hypotheses[${index}] ("${hypothesis.statement}") sem basis.`);
    }
    if (!isNonEmptyString(hypothesis.validationNeeded)) {
      errors.push(
        `hypotheses[${index}] ("${hypothesis.statement}") sem validationNeeded — uma hipótese sem possibilidade de validação não é inteligência operacional útil, é apresentada como fato implicitamente.`
      );
    }
  });

  diagnosis.risks.forEach((risk, index) => {
    if (basisIsEmpty(risk.basis)) {
      errors.push(`risks[${index}] ("${risk.statement}") sem basis.`);
    }
    if (risk.type !== "CONFIRMED_SIGNAL" && risk.type !== "INFERRED_RISK") {
      errors.push(`risks[${index}] com type inválido: "${risk.type}".`);
    }
  });

  diagnosis.priorities.forEach((priority, index) => {
    if (!isNonEmptyString(priority.reason)) {
      errors.push(
        `priorities[${index}] ("${priority.statement}") sem reason — prioridade sem justificativa nunca é aceita (nunca "priority: HIGH" isolado).`
      );
    }
    if (basisIsEmpty(priority.basis)) {
      errors.push(`priorities[${index}] ("${priority.statement}") sem basis.`);
    }
  });

  diagnosis.possibleActions.forEach((action, index) => {
    if (!ALLOWED_POSSIBLE_ACTION_KINDS.includes(action.kind)) {
      errors.push(
        `possibleActions[${index}] ("${action.statement}") com kind inválido: "${action.kind}" — só ${ALLOWED_POSSIBLE_ACTION_KINDS.join(", ")} são permitidos; a estrutura deve representar "possible", nunca "command".`
      );
    }
    if (basisIsEmpty(action.basis)) {
      errors.push(`possibleActions[${index}] ("${action.statement}") sem basis.`);
    }
  });

  diagnosis.conflictInterpretations.forEach((conflict, index) => {
    if (basisIsEmpty(conflict.basis)) {
      errors.push(`conflictInterpretations[${index}] ("${conflict.statement}") sem basis.`);
    }
    if (conflict.conflictSignals.length < 2) {
      errors.push(
        `conflictInterpretations[${index}] deve referenciar ao menos 2 sinais conflitantes (obtido: ${conflict.conflictSignals.length}) — um conflito nunca é sobre um único sinal.`
      );
    }
  });

  if (
    diagnosis.boundaries?.doesNotChangeFinancialTruth !== true ||
    diagnosis.boundaries?.doesNotMakeDecisions !== true ||
    diagnosis.boundaries?.doesNotExecuteActions !== true ||
    diagnosis.boundaries?.containsInterpretations !== true ||
    diagnosis.boundaries?.containsHypotheses !== true
  ) {
    errors.push(
      "boundaries deve afirmar explicitamente os 5 limites arquiteturais fixos (use DIAGNOSIS_BOUNDARIES)."
    );
  }

  const presentForbiddenKeys = FORBIDDEN_AUTHORITY_KEYS.filter(
    (key) => key in (diagnosis as unknown as Record<string, unknown>)
  );
  if (presentForbiddenKeys.length > 0) {
    errors.push(
      `ExecutiveDiagnosis contém campo(s) de autoridade proibida: ${presentForbiddenKeys.join(", ")} — a Executive AI nunca pode produzir Decision/Outcome/Execution/Financial Truth como saída própria.`
    );
  }

  // Mission 153 — First Real Recommendation-Backed Decision & Production
  // Workflow Validation (Etapa 4). `traceRecommendationReference()`
  // (D-082) identifica um item citável pelo par (diagnosisId, itemId),
  // percorrendo as 8 categorias em ordem fixa e devolvendo o primeiro
  // match — o `id` em si é gerado pelo modelo, sem garantia de
  // unicidade entre categorias diferentes do MESMO diagnóstico (nenhuma
  // instrução do schema/prompt exige isso). Um id duplicado entre
  // `priorities`/`possibleActions`, por exemplo, faria
  // `traceRecommendationReference()` sempre resolver silenciosamente
  // para a categoria checada primeiro, produzindo um trace/lineage
  // incorreto para o item da categoria "perdida" — sem nunca lançar
  // erro. Em vez de criar uma segunda identidade (proibido pela Etapa
  // 4), a estrutura de identidade já existente (D-082) é reforçada
  // aqui: um diagnóstico com ids colidentes entre categorias nunca
  // passa a ser confiável (`validateExecutiveDiagnosis()` já é o único
  // portão antes de persistência, `executeExecutiveAnalysis.ts`).
  const seenIds = new Map<string, RecommendationReferenceCategory>();
  for (const category of RECOMMENDATION_REFERENCE_CATEGORIES) {
    const items = diagnosis[category] as readonly { readonly id?: string }[];
    for (const item of items) {
      if (!isNonEmptyString(item.id)) continue;
      const previousCategory = seenIds.get(item.id);
      if (previousCategory && previousCategory !== category) {
        errors.push(
          `id "${item.id}" duplicado entre categorias diferentes ("${previousCategory}" e "${category}") — cada id citável de um ExecutiveDiagnosis deve ser único em todas as 8 categorias, nunca apenas dentro da própria categoria.`
        );
      } else if (!previousCategory) {
        seenIds.set(item.id, category);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
