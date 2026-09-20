import type { Knowledge, LearningRecord } from "@/efos/domain";

import { validateKnowledge } from "@/efos/application/knowledge-formation";
import { validateLearningRecord } from "@/efos/application/learning-derivation";

import type {
  KnowledgeEvaluationRejection,
  KnowledgeEvaluationResult,
} from "./KnowledgeEvaluationResult";

/**
 * Par de classificações diretamente OPOSTAS dentro do mesmo eixo
 * (julgamento humano) — a única relação estrutural que esta missão
 * reconhece como CONTRADIÇÃO real (Etapa 6.5: "mesmo eixo estrutural,
 * classificação incompatível"). `INCONCLUSIVE` nunca conta como
 * contradição de `EVIDENCE_FAVORABLE`/`EVIDENCE_CONTRARY` — o próprio
 * humano já registrou "sem conclusão clara", o que não é o mesmo que
 * "o oposto" (mesma distinção já usada por D-072 para nunca inventar
 * uma leitura mais forte do que o dado sustenta).
 */
const OPPOSITE_CLASSIFICATIONS: ReadonlySet<string> = new Set([
  "EVIDENCE_FAVORABLE::EVIDENCE_CONTRARY",
  "EVIDENCE_CONTRARY::EVIDENCE_FAVORABLE",
]);

/**
 * `evaluateKnowledgeAgainstLearning()` (Mission 145 — Knowledge-Driven
 * Continuous Improvement). Única função autorizada a comparar um
 * `Knowledge` já formado (D-073) contra `LearningRecord`s reais —
 * incluindo os que já o formaram (origem) e quaisquer outros
 * observados desde então (candidatos) — para determinar se o padrão
 * continua reforçado, foi contradito, ou permanece sem evidência
 * suficiente. **Nunca reescreve `knowledge`** (Etapa 7) — puramente de
 * leitura, devolve sempre uma nova estrutura de avaliação, nunca uma
 * versão modificada do `Knowledge` original.
 *
 * **Determinístico, estrutural, auditável — nunca IA/embeddings/
 * similaridade semântica/score arbitrário/inferência causal** (Etapa
 * 2). A COMPATIBILIDADE entre um `LearningRecord` candidato e o
 * padrão de origem do `Knowledge` é decidida por uma única regra
 * estrutural: a `evidenceClassification` (D-072) dos `LearningRecord`s
 * que originalmente formaram o `Knowledge` (`knowledge.derivedFromLearningRecordIds`)
 * é a "classificação de origem" — comparada, classificação a
 * classificação, contra cada `LearningRecord` candidato:
 *
 * - IGUAL à classificação de origem → **supporting** (reforça).
 * - EXATAMENTE o par oposto dentro do eixo de julgamento humano
 *   (`EVIDENCE_FAVORABLE` ↔ `EVIDENCE_CONTRARY`) → **contradicting**.
 * - Qualquer outra relação (eixo diferente, ou `INCONCLUSIVE`
 *   envolvido) → **insufficient** (considerado, mas não comparável).
 *
 * **Company boundary (Etapa 6.1)**: qualquer `LearningRecord` de
 * entrada com `companyId` diferente do `Knowledge` é REJEITADO
 * explicitamente (`COMPANY_MISMATCH`), nunca comparado.
 *
 * **Temporalidade (Etapa 6.2)**: `asOf?`, quando informado, exclui
 * qualquer `LearningRecord` candidato com `audit.createdAt > asOf` —
 * nunca usa evidência futura em relação ao ponto de avaliação. Mesmo
 * princípio de `asOf?` em `buildKnowledgeFromLearningRecords()`
 * (D-073)/`selectRelevantKnowledge()` (D-074), nunca duplicado
 * divergentemente.
 *
 * **Rastreabilidade (Etapa 6.3)**: `supporting`/`contradicting`/
 * `insufficient` são sempre `LearningRecord`s reais completos — cada
 * um já carrega `id`/`outcomeIds`/`financialObservationIds`.
 *
 * **Confidence nunca mutada (Etapa 8)**: esta função nunca lê nem
 * escreve `knowledge.provenance.confidence` — a avaliação é uma
 * camada nova e separada, nunca uma reescrita silenciosa da força do
 * conhecimento original. Mutação de confidence, se um dia desejável,
 * é missão futura explícita.
 *
 * Pura — nunca acessa Supabase/`createClient`, nunca chama IA, nunca
 * lê o relógio do sistema (`asOf` é sempre parâmetro).
 */
export function evaluateKnowledgeAgainstLearning(
  knowledge: Knowledge,
  learningRecords: readonly LearningRecord[],
  asOf?: string
): KnowledgeEvaluationResult {
  const rejected: KnowledgeEvaluationRejection[] = [];

  const knowledgeValidation = validateKnowledge(knowledge);
  if (!knowledgeValidation.valid) {
    rejected.push({
      code: "INVALID_KNOWLEDGE",
      message: `Knowledge estruturalmente inválido, avaliação abortada: ${knowledgeValidation.errors.join("; ")}.`,
    });
    return { outcome: "INSUFFICIENT_EVIDENCE", knowledgeId: knowledge.id, supporting: [], contradicting: [], insufficient: [], rejected };
  }

  const originIds = new Set(knowledge.derivedFromLearningRecordIds ?? []);
  const eligible: LearningRecord[] = [];

  for (const record of learningRecords) {
    if (record.companyId !== knowledge.companyId) {
      rejected.push({
        code: "COMPANY_MISMATCH",
        learningRecordId: record.id,
        message: `LearningRecord pertence à empresa "${record.companyId}", diferente da empresa do Knowledge ("${knowledge.companyId}") — nunca comparado.`,
      });
      continue;
    }

    const recordValidation = validateLearningRecord(record);
    if (!recordValidation.valid) {
      rejected.push({
        code: "INVALID_LEARNING_RECORD",
        learningRecordId: record.id,
        message: `LearningRecord estruturalmente inválido, nunca usado como evidência: ${recordValidation.errors.join("; ")}.`,
      });
      continue;
    }

    eligible.push(record);
  }

  const originRecords = eligible.filter((record) => originIds.has(record.id));
  const originClassification = originRecords.find((record) => record.evidenceClassification !== undefined)?.evidenceClassification;

  if (!originClassification) {
    // Sem os LearningRecords de origem disponíveis na entrada, não há
    // como determinar compatibilidade — resultado honesto, nunca uma
    // suposição sobre o que o Knowledge "provavelmente" representa.
    return { outcome: "INSUFFICIENT_EVIDENCE", knowledgeId: knowledge.id, supporting: [], contradicting: [], insufficient: [], rejected };
  }

  const candidates = eligible.filter((record) => {
    if (originIds.has(record.id)) return false;
    if (asOf !== undefined && record.audit.createdAt > asOf) return false;
    return true;
  });

  const supporting: LearningRecord[] = [];
  const contradicting: LearningRecord[] = [];
  const insufficient: LearningRecord[] = [];

  for (const candidate of candidates) {
    if (candidate.evidenceClassification === undefined) {
      insufficient.push(candidate);
      continue;
    }
    if (candidate.evidenceClassification === originClassification) {
      supporting.push(candidate);
    } else if (OPPOSITE_CLASSIFICATIONS.has(`${originClassification}::${candidate.evidenceClassification}`)) {
      contradicting.push(candidate);
    } else {
      insufficient.push(candidate);
    }
  }

  const outcome =
    supporting.length > 0 && contradicting.length > 0
      ? "MIXED"
      : supporting.length > 0
        ? "REINFORCED"
        : contradicting.length > 0
          ? "CONTRADICTED"
          : "INSUFFICIENT_EVIDENCE";

  return { outcome, knowledgeId: knowledge.id, supporting, contradicting, insufficient, rejected };
}
