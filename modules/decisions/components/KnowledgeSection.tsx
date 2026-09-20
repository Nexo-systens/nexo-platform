import { getKnowledgeByCompany } from "@/modules/decisions/services/knowledge-persistence.service";
import { getKnowledgeEvaluationsGroupedByKnowledge } from "@/modules/decisions/services/knowledge-evaluation-persistence.service";
import { getLearningRecordsByCompany } from "@/modules/decisions/services/learning-record-persistence.service";
import { deriveKnowledgeState } from "@/efos/application/knowledge-lifecycle";
import { deriveKnowledgeCandidatePreviews } from "@/efos/application/knowledge-formation";
import { KnowledgeFormationPanel } from "@/modules/decisions/components/KnowledgeFormationPanel";

/**
 * Mission 141 — Knowledge Formation & Cross-Decision Learning. Server
 * Component: lê o estado canônico direto do banco, mesmo padrão de
 * `DecisionExecutionSection` (Mission 138). Diferente das demais
 * seções desta família (`DiagnosisReviewSection`/`HumanDecisionSection`/
 * `DecisionExecutionSection`), esta seção é escopada à COMPANY inteira,
 * nunca a uma única `Decision` ou `ExecutiveDiagnosis` — `Knowledge` só
 * existe quando múltiplas `Decision`s independentes concordam num
 * padrão recorrente (`buildKnowledgeFromLearningRecords()`,
 * `efos/application/knowledge-formation/`). Renderizado como irmão de
 * `DecisionExecutionSection` em `ExecutiveDiagnosisSection.tsx`.
 *
 * **Mission 146 — Knowledge Lifecycle & Historical Intelligence
 * Maturity (Etapa 14)**: para cada `Knowledge`, deriva o estado de
 * ciclo de vida COMPLETO (`deriveKnowledgeState()`, agregando TODO o
 * histórico de avaliações — nunca só a mais recente, diferente da
 * versão Mission 145) a partir de
 * `getKnowledgeEvaluationsGroupedByKnowledge()` (1 única query,
 * agrupamento em memória). A derivação é pura e barata — feita aqui no
 * Server Component, nunca persistida (Etapa 12: sem tabela nova).
 * Resultado convertido para `Record` plano (nunca um `Map`) antes de
 * ser passado ao Client Component, mesma disciplina de serialização
 * RSC da Mission 145. Nenhum dashboard genérico novo — o estado é
 * exibido exatamente onde o Knowledge já era exibido desde a
 * Mission 141.
 *
 * **Mission 187 — Governed Learning → Organizational Knowledge (Seção
 * 25/26 da missão).** Busca também `getLearningRecordsByCompany()`
 * (mesma função já usada por `formKnowledgeAction()`, nenhuma consulta
 * nova) para que `KnowledgeFormationPanel` possa, sob demanda ("Ver
 * evidência", já existente desde a Mission 146), exibir a interpretação
 * executiva (`LearningRecord.humanStatement`, Mission 186 Closure) dos
 * registros que efetivamente formaram cada `Knowledge`
 * (`derivedFromLearningRecordIds`) — nunca reconstruída a partir do
 * `statement` do próprio `Knowledge`, sempre lida da fonte original.
 * Convertido para `Record<string, LearningRecord>` plano (mesma
 * disciplina de serialização RSC de `knowledgeStates` acima).
 *
 * **Mission 187 Closure — Governed Knowledge Synthesis (Seção 24 da
 * missão).** Computa também `pendingReview`
 * (`deriveKnowledgeCandidatePreviews()`, pura, nenhuma escrita) na
 * PRÓPRIA leitura desta seção — o revisor vê candidatos aguardando uma
 * interpretação executiva ANTES de clicar em qualquer botão, nunca
 * apenas como resultado de uma ação. `formKnowledgeAction()` (clique
 * "Formar conhecimento") continua recalculando a mesma lista de forma
 * independente para o resultado imediato do clique — nunca duas fontes
 * de verdade divergentes, a mesma função pura em ambos os lugares.
 */
export async function KnowledgeSection({ companyId }: { companyId: string }) {
  const [knowledge, evaluationsByKnowledge, learningRecords] = await Promise.all([
    getKnowledgeByCompany(companyId),
    getKnowledgeEvaluationsGroupedByKnowledge(companyId),
    getLearningRecordsByCompany(companyId),
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

  return (
    <div id="knowledge" className="flex flex-col gap-4">
      <h3 className="text-base font-semibold text-foreground">Conhecimento Acumulado (Knowledge)</h3>
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
