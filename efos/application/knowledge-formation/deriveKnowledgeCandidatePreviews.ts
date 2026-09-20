import type { Knowledge, LearningRecord, ScenarioType } from "@/efos/domain";

import { deriveKnowledgeCandidates, type KnowledgeCandidateInterpretation } from "./KnowledgeCandidate";
import { buildKnowledgeForCandidate, MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE } from "./buildKnowledgeFromLearningRecords";

/**
 * `KnowledgeCandidatePreview` (Mission 187 Closure — Governed Knowledge
 * Synthesis). Nunca persistido — sempre recalculado a cada leitura, a
 * partir de `LearningRecord`s reais já persistidos. `candidateId` é o
 * `Knowledge.id` que este candidato produziria (já determinístico,
 * D-073) — a CHAVE que `formGovernedKnowledgeAction()`
 * (`modules/decisions/actions/knowledge-formation.actions.ts`) usa para
 * reencontrar o MESMO candidato depois, recomputado a partir de dados
 * reais, nunca um identificador confiado às cegas do client (Seção 28
 * da missão). `suggestedStatement` é sempre o template determinístico
 * de sempre (`statementFor()`, D-073/D-101) — uma SUGESTÃO que um
 * revisor humano pode confirmar ou substituir, nunca a única opção.
 * `interpretations` preserva o texto VERBATIM de cada
 * `LearningRecord.humanStatement` do grupo (D-100), com lineage —
 * nunca resumido/sintetizado aqui (Seção 6 da missão de fechamento).
 */
export interface KnowledgeCandidatePreview {
  readonly candidateId: string;
  readonly category: Knowledge["category"];
  readonly evidenceClassification: string;
  readonly suggestedStatement: string;
  readonly decisionIds: readonly string[];
  readonly dominantScenarioType?: ScenarioType;
  readonly interpretations: readonly KnowledgeCandidateInterpretation[];
}

/**
 * `deriveKnowledgeCandidatePreviews()` (Mission 187 Closure). Único
 * ponto autorizado de cálculo de candidatos PENDENTES de revisão
 * governada — reaproveitado tanto por `KnowledgeSection.tsx` (exibição
 * na leitura, sem nenhuma ação do usuário) quanto por
 * `formKnowledgeAction()` (mesmo cálculo, nunca duplicado
 * divergentemente).
 *
 * Pura — sem acesso a Repository/banco, sem `randomUUID()`/`Date.now()`
 * internos (`previewedAt` é sempre parâmetro, nunca lido do relógio do
 * sistema — mesmo princípio de `formedAt` em
 * `buildKnowledgeFromLearningRecords()`). Um candidato só aparece aqui
 * quando: (a) atinge o threshold de recorrência
 * (`MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE`, D-073, inalterado); (b)
 * carrega ao menos 1 interpretação executiva (`humanInterpretedCount > 0`,
 * D-101) — candidatos sem interpretação continuam sendo formados
 * automaticamente por `buildKnowledgeFromLearningRecords()`, nunca
 * aparecendo aqui (Seção 21 da missão de fechamento: Knowledge
 * ordinário permanece 100% automático); (c) ainda não tem um
 * `Knowledge` persistido com o mesmo `id` (`existingKnowledgeIds`) —
 * um candidato já governado nunca reaparece como pendente.
 */
export function deriveKnowledgeCandidatePreviews(
  learningRecords: readonly LearningRecord[],
  existingKnowledgeIds: ReadonlySet<string>,
  previewedAt: string
): readonly KnowledgeCandidatePreview[] {
  const recurring = deriveKnowledgeCandidates(learningRecords).filter(
    (candidate) =>
      candidate.decisionIds.length >= MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE && candidate.humanInterpretedCount > 0
  );

  const previews: KnowledgeCandidatePreview[] = [];
  for (const candidate of recurring) {
    const built = buildKnowledgeForCandidate(candidate, previewedAt);
    if (!built.success) continue; // um candidato estruturalmente inválido nunca é oferecido para revisão
    if (existingKnowledgeIds.has(built.value.id)) continue; // já governado — nunca reaparece como pendente

    previews.push({
      candidateId: built.value.id,
      category: built.value.category,
      evidenceClassification: candidate.evidenceClassification,
      suggestedStatement: built.value.statement,
      decisionIds: candidate.decisionIds,
      dominantScenarioType: candidate.dominantScenarioType,
      interpretations: candidate.interpretations,
    });
  }
  return previews;
}
