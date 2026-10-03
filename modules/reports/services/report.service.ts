import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getExecutiveHistory } from "@/modules/analysis/services/executive-history.service";
import { getCompanyById, type Company } from "@/modules/companies/services/company.service";
import {
  getDecisionExecutionEventsByDecision,
  getOutcomesByDecision,
} from "@/modules/decisions/services/decision-execution-persistence.service";
import { getDecisionsByCompany } from "@/modules/decisions/services/decision-persistence.service";
import { getDiagnosisReviewsByDiagnosis } from "@/modules/decisions/services/diagnosis-review-persistence.service";
import { getExecutiveDiagnosesByCompany } from "@/modules/decisions/services/executive-diagnosis-persistence.service";
import { getFinancialObservationsByDecision } from "@/modules/decisions/services/financial-observation-persistence.service";
import { getKnowledgeByCompany } from "@/modules/decisions/services/knowledge-persistence.service";
import { getLearningRecordsByCompany } from "@/modules/decisions/services/learning-record-persistence.service";

import { buildReportIndex, type ReportIndexCompany, type ReportIndexGroup } from "../lib/report-index";
import { buildReportReading, type ReportReading } from "../lib/report-reading";

import { listDiagnosisLinks, listReportCompanies, listReportEntries, resolveReportCompanyId } from "./report-queries";

/**
 * Mission 208 — carregamento das duas superfícies de relatório. Só leitura,
 * sempre com a sessão do usuário (RLS). Nenhum relatório é gerado aqui: o
 * `ExecutiveReport` nasce na análise (`DefaultEFOSFacade`) e é lido como foi
 * gravado. Nenhuma chamada de IA, nenhuma escrita.
 */

export interface LoadedReportIndex {
  readonly groups: readonly ReportIndexGroup[];
  /** Empresas visíveis sem nenhuma análise — ainda sem relatório. */
  readonly companiesWithoutReports: readonly ReportIndexCompany[];
}

export async function loadReportIndex(): Promise<LoadedReportIndex> {
  const supabase = await createClient();
  const [companies, entries, diagnosisLinks] = await Promise.all([
    listReportCompanies(supabase),
    listReportEntries(supabase),
    listDiagnosisLinks(supabase),
  ]);
  const groups = buildReportIndex({ companies, entries, diagnosisLinks });
  const withReports = new Set(groups.map((group) => group.company.id));
  return { groups, companiesWithoutReports: companies.filter((company) => !withReports.has(company.id)) };
}

export interface LoadedReport {
  readonly company: Company;
  readonly reading: ReportReading;
}

/**
 * `null` sempre que o relatório não existe para esta sessão — id malformado,
 * inexistente, de outra empresa (RLS) ou de empresa encerrada. A página
 * responde 404 nos quatro casos, sem distinguir. `cache()`: metadados e
 * página leem o mesmo carregamento numa requisição.
 */
export const loadReport = cache(async function loadReport(executionId: string): Promise<LoadedReport | null> {
  const supabase = await createClient();
  const companyId = await resolveReportCompanyId(supabase, executionId);
  if (!companyId) return null;

  const company = await getCompanyById(companyId);
  if (!company) return null;

  const [history, diagnoses, decisions, learningRecords, knowledge] = await Promise.all([
    getExecutiveHistory(company.id),
    getExecutiveDiagnosesByCompany(company.id),
    getDecisionsByCompany(company.id),
    getLearningRecordsByCompany(company.id),
    getKnowledgeByCompany(company.id),
  ]);

  const current = history.find((execution) => execution.executionId === executionId && execution.companyId === company.id);
  if (!current?.report) return null;

  const reportDiagnoses = diagnoses.filter((diagnosis) => diagnosis.executionId === executionId);
  const [reviews, perDecision] = await Promise.all([
    Promise.all(reportDiagnoses.map((diagnosis) => getDiagnosisReviewsByDiagnosis(diagnosis.id))),
    Promise.all(
      decisions.map((decision) =>
        Promise.all([
          getDecisionExecutionEventsByDecision(decision.id),
          getOutcomesByDecision(decision.id),
          getFinancialObservationsByDecision(decision.id),
        ])
      )
    ),
  ]);

  const reading = buildReportReading({
    history,
    current,
    diagnoses,
    reviewsByDiagnosis: Object.fromEntries(reportDiagnoses.map((diagnosis, index) => [diagnosis.id, reviews[index]])),
    decisions,
    executionEvents: perDecision.flatMap(([events]) => events),
    outcomes: perDecision.flatMap(([, outcomes]) => outcomes),
    financialObservations: perDecision.flatMap(([, , observations]) => observations),
    learningRecords,
    knowledge,
    stateAsOf: new Date().toISOString(),
  });

  return reading ? { company, reading } : null;
});
