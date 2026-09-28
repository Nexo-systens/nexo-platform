import { SemanticBadge } from "@/components/shared/SemanticBadge";
import { deriveKnowledgeCandidatePreviews } from "@/efos/application/knowledge-formation";
import { deriveKnowledgeState } from "@/efos/application/knowledge-lifecycle";
import { KnowledgeFormationPanel } from "@/modules/decisions/components/KnowledgeFormationPanel";
import { getDecisionsByCompany } from "@/modules/decisions/services/decision-persistence.service";
import { getKnowledgeEvaluationsGroupedByKnowledge } from "@/modules/decisions/services/knowledge-evaluation-persistence.service";
import { getKnowledgeByCompany } from "@/modules/decisions/services/knowledge-persistence.service";
import { getLearningRecordsByCompany } from "@/modules/decisions/services/learning-record-persistence.service";

const EVIDENCE_CLASSIFICATION_LABELS: Readonly<Record<string, string>> = {
  TEMPORAL_ASSOCIATION: "Associação temporal",
  EVIDENCE_FAVORABLE: "Evidência favorável",
  EVIDENCE_CONTRARY: "Evidência contrária",
  INCONCLUSIVE: "Inconclusivo",
};

const CONFIDENCE_LABELS: Readonly<Record<string, string>> = {
  low: "Confiança baixa",
  medium: "Confiança média",
  high: "Confiança alta",
};

/**
 * Mission 204 — Conhecimento como memória financeira: primeiro o que já
 * foi aprendido (cada aprendizado com a decisão de origem, a
 * interpretação escrita pelo executivo e a força da evidência), depois o
 * conhecimento formado a partir de aprendizados recorrentes. Mesmas
 * leituras e mesma formação governada de antes — só a apresentação muda.
 */
export async function KnowledgeSection({ companyId }: { companyId: string }) {
  const [knowledge, evaluationsByKnowledge, learningRecords, decisions] = await Promise.all([
    getKnowledgeByCompany(companyId),
    getKnowledgeEvaluationsGroupedByKnowledge(companyId),
    getLearningRecordsByCompany(companyId),
    getDecisionsByCompany(companyId),
  ]);

  const knowledgeStates = Object.fromEntries(
    knowledge.map((k) => [k.id, deriveKnowledgeState(k, evaluationsByKnowledge.get(k.id) ?? [])])
  );
  const learningRecordsById = Object.fromEntries(learningRecords.map((record) => [record.id, record]));
  const pendingReview = deriveKnowledgeCandidatePreviews(
    learningRecords,
    new Set(knowledge.map((k) => k.id)),
    new Date().toISOString()
  );
  const decisionTitle = new Map(decisions.map((decision) => [decision.id, decision.decision.title]));

  return (
    <div id="knowledge" className="flex flex-col gap-12">
      <section aria-labelledby="aprendizados-titulo" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="type-eyebrow">Memória</p>
          <h3 id="aprendizados-titulo" className="type-section-title">
            O que já foi aprendido
          </h3>
          <p className="type-meta max-w-3xl">
            Cada aprendizado nasce de uma decisão executada e do resultado que a empresa observou — com a interpretação
            escrita por quem decidiu. Associação no tempo, nunca prova de causa.
          </p>
        </div>

        {learningRecords.length === 0 ? (
          <p className="type-body">
            Nenhum aprendizado registrado ainda. Eles surgem na visão Decisões, depois que uma decisão é executada e seu
            resultado é registrado.
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-border border-y border-border">
            {learningRecords.map((record) => {
              // A origem só é repetida quando o título do aprendizado ainda não a nomeia.
              const sources = record.decisions
                .map((id) => decisionTitle.get(id))
                .filter((title): title is string => Boolean(title) && !record.title.includes(title!));
              return (
                <li key={record.id} className="flex flex-col gap-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{record.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {record.evidenceClassification && (
                        <SemanticBadge tone={record.evidenceClassification === "EVIDENCE_CONTRARY" ? "warning" : "info"}>
                          {EVIDENCE_CLASSIFICATION_LABELS[record.evidenceClassification] ?? record.evidenceClassification}
                        </SemanticBadge>
                      )}
                      <SemanticBadge>{CONFIDENCE_LABELS[record.confidence] ?? record.confidence}</SemanticBadge>
                    </div>
                  </div>
                  {record.humanStatement && (
                    <blockquote className="border-l-2 border-border-strong pl-3 text-[0.875rem] italic text-foreground-secondary">
                      {record.humanStatement}
                    </blockquote>
                  )}
                  <p className="type-meta">{record.description}</p>
                  {sources.length > 0 && <p className="type-meta">Da decisão: {sources.join(" · ")}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <KnowledgeFormationPanel
        companyId={companyId}
        knowledge={knowledge}
        knowledgeStates={knowledgeStates}
        learningRecordsById={learningRecordsById}
        pendingReview={pendingReview}
      />
    </div>
  );
}
