import { getExecutiveDiagnosesByCompany } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { ExecutiveDiagnosisView } from "@/modules/decisions/components/ExecutiveDiagnosisView";
import { ExecutiveDiagnosisActivation } from "@/modules/decisions/components/ExecutiveDiagnosisActivation";
import { DecisionCenter } from "@/modules/decisions/components/DecisionCenter";
import { KnowledgeSection } from "@/modules/decisions/components/KnowledgeSection";

/**
 * Mission 127 — Executive Review & Decision Interface. Server
 * Component: lê o estado canônico direto do banco (Mission 126,
 * `modules/decisions/services/`) — nunca de estado local/cache.
 * `companyId` já chega autorizado pela própria página (`getCompanyById()`
 * já filtrado por RLS, `app/(app)/companies/[id]/page.tsx`), mesmo
 * padrão de `AnalysisAndHistorySection`/`DocumentsSection`.
 *
 * **Onde um diagnóstico persistido é carregado (auditoria, Etapa 2)**:
 * `getExecutiveDiagnosesByCompany(companyId)` — antes da Mission 128
 * sempre devolvia `[]` em uso real, porque nenhuma rota chamava
 * `saveExecutiveDiagnosis()`. A partir da Mission 128,
 * `ExecutiveDiagnosisActivation` (client) chama
 * `activateExecutiveDiagnosisAction()` (D-067 — composição
 * canônica única, `modules/decisions/actions/executive-diagnosis.actions.ts`)
 * quando não há diagnóstico ainda; esta seção continua mostrando
 * honestamente um estado vazio (agora com ativação explícita
 * disponível) até que um diagnóstico real exista, nunca inventa um.
 *
 * **Mission 179 — Executive Decision Center**: até esta missão, tudo
 * abaixo de `ExecutiveDiagnosisView` (revisão/decisão/execução) era
 * calculado exclusivamente para `diagnoses[0]` — uma escolha de
 * composição desta função, nunca um limite real de
 * `deriveRecommendationGovernanceState()`/`listRecommendationReferences()`
 * (auditoria desta missão provou isso; a classificação
 * ARCHITECTURALLY_BLOCKED da Mission 178 estava incorreta). Esse bloco
 * foi extraído para `<DecisionCenter />` (`modules/decisions/components/`),
 * que generaliza a MESMA composição para TODOS os diagnósticos da
 * empresa — nenhuma Server Action nova, nenhuma alteração de
 * `DiagnosisReviewSection`/`HumanDecisionSection`/`DecisionExecutionSection`.
 * `ExecutiveDiagnosisView` do diagnóstico mais recente permanece aqui
 * (mostrar "o que a IA concluiu por último" continua um propósito
 * legítimo e distinto de "o que precisa da minha decisão").
 *
 * **Correção real da Mission 184 (Scenario-to-Decision Governance
 * Bridge, Seção 22/39)**: até esta missão, o ramo "sem diagnóstico"
 * nunca montava `<DecisionCenter />` — uma empresa que só tivesse
 * simulado cenários (nenhum diagnóstico executivo gerado ainda) nunca
 * veria NENHUMA `Decision` sua, incluindo as originadas de Scenario
 * Lab (`createScenarioDecisionAction()`, que nunca exige diagnóstico).
 * Corrigido montando `<DecisionCenter />` nos dois ramos — o próprio
 * `DecisionCenter` já decide corretamente não renderizar nada quando
 * não há diagnósticos NEM decisões (ver correção irmã naquele
 * arquivo), preservando o comportamento visual exato de antes para
 * toda empresa que ainda não tem nenhuma Decision de nenhuma origem.
 */
export async function ExecutiveDiagnosisSection({ companyId }: { companyId: string }) {
  const diagnoses = await getExecutiveDiagnosesByCompany(companyId);

  if (diagnoses.length === 0) {
    return (
      <div id="diagnostico-executivo" className="flex flex-col gap-4">
        <ExecutiveDiagnosisActivation companyId={companyId} />
        <DecisionCenter companyId={companyId} />
      </div>
    );
  }

  return (
    <div id="diagnostico-executivo" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Inteligência Executiva</h2>
      <ExecutiveDiagnosisView diagnosis={diagnoses[0].diagnosis} />
      <DecisionCenter companyId={companyId} />
      <KnowledgeSection companyId={companyId} />
    </div>
  );
}
