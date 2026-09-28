import { SectionShell } from "@/components/shared/SectionShell";
import { getExecutiveHistory } from "@/modules/analysis/services/executive-history.service";
import { formatDateTime } from "@/modules/dashboard/lib/format";
import { DecisionCenter } from "@/modules/decisions/components/DecisionCenter";
import { ExecutiveDiagnosisActivation } from "@/modules/decisions/components/ExecutiveDiagnosisActivation";
import { ExecutiveDiagnosisView } from "@/modules/decisions/components/ExecutiveDiagnosisView";
import { buildReferenceLabels } from "@/modules/decisions/lib/diagnosis-references";
import { getExecutiveDiagnosesByCompany } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { getKnowledgeByCompany } from "@/modules/decisions/services/knowledge-persistence.service";

/**
 * Mission 204 — visão Decisões do workspace. A decisão é o objeto
 * principal: a Central de Decisões vem primeiro (o que requer decisão →
 * decidido/em execução → concluído); a leitura da Executive AI vem em
 * seguida, como apoio, com a proveniência traduzida em nomes a partir da
 * análise que a originou. Sem diagnóstico, o ponto de entrada é gerá-lo.
 * O conhecimento formado ganhou visão própria (Conhecimento).
 */
export async function ExecutiveDiagnosisSection({ companyId }: { companyId: string }) {
  const diagnoses = await getExecutiveDiagnosesByCompany(companyId);

  const shell = {
    id: "decisoes",
    eyebrow: "Decisão",
    title: "Decisões",
    description:
      "O que precisa da sua decisão, o que já foi decidido e o que aconteceu depois — com a leitura da Executive AI como apoio. A decisão final é sempre da empresa.",
  } as const;

  if (diagnoses.length === 0) {
    return (
      <SectionShell {...shell}>
        <ExecutiveDiagnosisActivation companyId={companyId} />
        <DecisionCenter companyId={companyId} />
      </SectionShell>
    );
  }

  const latest = diagnoses[0];
  const [history, knowledge] = await Promise.all([getExecutiveHistory(companyId), getKnowledgeByCompany(companyId)]);
  const sourceReport = history.find((execution) => execution.executionId === latest.executionId)?.report;

  return (
    <SectionShell {...shell}>
      <div className="flex flex-col gap-12">
        <DecisionCenter companyId={companyId} />
        <ExecutiveDiagnosisView
          diagnosis={latest.diagnosis}
          references={buildReferenceLabels(sourceReport, knowledge)}
          generatedAt={formatDateTime(latest.createdAt)}
        />
      </div>
    </SectionShell>
  );
}
