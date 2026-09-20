import { LEARNING_EVIDENCE_CLASSIFICATIONS, type LearningRecord } from "@/efos/domain";

export interface LearningRecordValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Valida um `LearningRecord` derivado (Mission 140) antes de persistir
 * — mesma disciplina de `validateOutcome()`/`validateFinancialOutcomeObservation()`
 * (Missions 138/139). **Etapa 8.A da missão — "conhecimento sem
 * origem rastreável é rejeitado"**: um `LearningRecord` produzido por
 * `buildLearningRecord()` sempre referencia ao menos 1 `Decision` real
 * (`decisions`) e ao menos 1 `Outcome`/`FinancialOutcomeObservation`
 * real (`outcomeIds`/`financialObservationIds`) — este validador
 * rejeita qualquer registro que não tenha nenhuma das duas origens.
 */
export function validateLearningRecord(record: LearningRecord): LearningRecordValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(record.id)) errors.push("LearningRecord.id é obrigatório.");
  if (!isNonEmptyString(record.companyId)) errors.push("LearningRecord.companyId é obrigatório.");
  if (!isNonEmptyString(record.title)) errors.push("LearningRecord.title é obrigatório.");
  if (!isNonEmptyString(record.description)) errors.push("LearningRecord.description é obrigatório.");

  if (record.decisions.length === 0) {
    errors.push("LearningRecord.decisions não pode ser vazio — todo LearningRecord derivado precisa apontar para ao menos 1 Decision real.");
  }

  const outcomeIds = record.outcomeIds ?? [];
  const financialObservationIds = record.financialObservationIds ?? [];
  if (outcomeIds.length === 0 && financialObservationIds.length === 0) {
    errors.push(
      "LearningRecord sem origem rastreável — precisa referenciar ao menos 1 Outcome real ou 1 FinancialOutcomeObservation real (outcomeIds/financialObservationIds), nunca uma conclusão sem evidência (Etapa 8.A)."
    );
  }

  if (record.evidenceClassification !== undefined && !LEARNING_EVIDENCE_CLASSIFICATIONS.includes(record.evidenceClassification)) {
    errors.push(`evidenceClassification desconhecida: "${record.evidenceClassification}".`);
  }

  // Mission 186 — Decision Learning from Expected vs Observed, Seção
  // 5/31: "live comparison ineligible for durable E-v-O Learning".
  // Defesa em profundidade — `ExpectedActualLearningContext.basis` já
  // é um literal de tipo único (`"formal"`) que impede a construção de
  // um valor `"live"` em tempo de compilação; esta checagem reafirma a
  // mesma regra em tempo de execução, nunca confiando apenas na UI para
  // esconder a opção (Seção 31: "Enforce in Application/server boundary").
  const expectedActualContext = record.supportingData?.expectedActualContext;
  if (isPlainObject(expectedActualContext) && expectedActualContext.basis !== "formal") {
    errors.push(
      'LearningRecord.supportingData.expectedActualContext.basis deve ser sempre "formal" — uma comparação "live" nunca pode fundamentar um aprendizado durável (Mission 186, Seção 5/31).'
    );
  }

  // Mission 186 Closure — Human Learning Statement & Governance,
  // Seção 3/22/23: um aprendizado que carrega contexto Esperado vs.
  // Observado formal nunca pode se apoiar apenas no template genérico
  // (`CLASSIFICATION_DESCRIPTIONS`, idêntico para qualquer distância
  // financeira) — exige uma interpretação humana explícita.
  // `buildLearningRecord()` já recusa isso antes de chegar aqui
  // (`HUMAN_STATEMENT_REQUIRED`); esta checagem reafirma a mesma regra
  // em tempo de execução para qualquer outro chamador futuro (defesa
  // em profundidade, mesmo princípio do `basis` acima).
  if (isPlainObject(expectedActualContext) && !isNonEmptyString(record.humanStatement)) {
    errors.push(
      "LearningRecord.humanStatement é obrigatório quando supportingData.expectedActualContext está presente — nenhum aprendizado com contexto Esperado vs. Observado formal é persistido sem uma interpretação humana explícita (Mission 186 Closure)."
    );
  }

  return { valid: errors.length === 0, errors };
}
