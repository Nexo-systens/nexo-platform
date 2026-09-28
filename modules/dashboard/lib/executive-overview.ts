import type { ExecutiveReportSummary } from "@/efos/application/report";
import {
  resolveActivationState,
  type ActivationState,
} from "@/modules/activation/resolveActivationState";

/**
 * Mission 203 — Visão executiva (dashboard).
 *
 * Monta, a partir de dados que o backend JÁ fornece por empresa
 * (contagens canônicas + o `summary` persistido da última análise), a
 * leitura executiva: em que estágio cada empresa está, quando foi a
 * última análise, o que ela produziu e qual é o próximo passo. Função
 * pura, testável, sem acesso a banco.
 *
 * Regras de honestidade:
 * - nada é fabricado: sem análise → "nenhuma análise", nunca contagens 0;
 * - análise persistida sem `summary` (execução antiga) → sinais
 *   INDISPONÍVEIS, nunca zero;
 * - nenhuma classificação financeira nova (saúde/risco) é inventada
 *   aqui — isso é trabalho dos Engines e aparece na página da empresa.
 */

export interface LatestAnalysisInput {
  readonly generatedAt: string;
  readonly summary: ExecutiveReportSummary | null;
}

export interface CompanyOverviewInput {
  readonly id: string;
  readonly name: string;
  readonly documentsCount: number;
  readonly analyzableDocumentsCount: number;
  readonly executionsCount: number;
  readonly diagnosesCount: number;
  readonly decisionsCount: number;
  readonly latestAnalysis: LatestAnalysisInput | null;
}

export interface PortfolioInput {
  readonly activeCount: number;
  readonly archivedCount: number;
  readonly closedCount: number;
}

export type AnalysisSignals =
  | { readonly status: "none" }
  | { readonly status: "unavailable" }
  | {
      readonly status: "available";
      readonly evidence: number;
      readonly interpretations: number;
      readonly recommendations: number;
      readonly proposals: number;
    };

export type StageTone = "neutral" | "info" | "warning" | "positive";

export interface CompanyOverview {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly stage: ActivationState;
  readonly stageLabel: string;
  readonly stageTone: StageTone;
  readonly lastAnalysisAt: string | null;
  readonly signals: AnalysisSignals;
  readonly documentsCount: number;
  readonly decisionsCount: number;
  readonly nextStep: { readonly label: string; readonly href: string };
}

export interface AttentionItem {
  readonly companyId: string;
  readonly companyName: string;
  readonly tone: StageTone;
  readonly title: string;
  readonly detail: string;
  readonly action: { readonly label: string; readonly href: string };
}

export interface ExecutiveOverview {
  readonly portfolio: PortfolioInput;
  readonly companies: readonly CompanyOverview[];
  /** Empresas ativas além das exibidas (o painel é limitado). */
  readonly hiddenActiveCount: number;
  readonly attention: readonly AttentionItem[];
}

const STAGE: Readonly<Record<ActivationState, { label: string; tone: StageTone }>> = {
  no_documents: { label: "Aguardando documentos", tone: "neutral" },
  documents_not_analyzable: { label: "Documentos não analisáveis", tone: "warning" },
  ready_for_analysis: { label: "Pronta para análise", tone: "info" },
  analysis_available: { label: "Análise disponível", tone: "info" },
  diagnosis_available: { label: "Diagnóstico disponível", tone: "positive" },
};

/** Ordem de atenção: o que bloqueia primeiro, depois o que destrava valor. */
const ATTENTION_ORDER: readonly ActivationState[] = [
  "documents_not_analyzable",
  "ready_for_analysis",
  "analysis_available",
  "no_documents",
];

function nextStep(stage: ActivationState, companyId: string): { label: string; href: string } {
  const company = `/companies/${companyId}`;
  switch (stage) {
    case "no_documents":
      return { label: "Enviar documentos", href: `/documents?companyId=${companyId}` };
    case "documents_not_analyzable":
      return { label: "Enviar PDF ou CSV", href: `/documents?companyId=${companyId}` };
    case "ready_for_analysis":
      return { label: "Executar análise", href: `${company}?secao=analise` };
    case "analysis_available":
      return { label: "Gerar diagnóstico", href: `${company}?secao=decisoes` };
    case "diagnosis_available":
      return { label: "Abrir decisões", href: `${company}?secao=decisoes` };
  }
}

function signalsFor(input: CompanyOverviewInput): AnalysisSignals {
  if (!input.latestAnalysis) return { status: "none" };
  const summary = input.latestAnalysis.summary;
  if (!summary) return { status: "unavailable" };
  return {
    status: "available",
    evidence: summary.evidenceCount,
    interpretations: summary.contextCount + summary.reasoningCount,
    recommendations: summary.recommendationCount,
    proposals: summary.decisionCount,
  };
}

function attentionFor(company: CompanyOverview): AttentionItem | null {
  const base = { companyId: company.id, companyName: company.name, action: company.nextStep };
  switch (company.stage) {
    case "documents_not_analyzable":
      return {
        ...base,
        tone: "warning",
        title: "Documentos em formato não analisável",
        detail: "Os arquivos enviados ficam guardados, mas só PDF e CSV entram na análise financeira.",
      };
    case "ready_for_analysis":
      return {
        ...base,
        tone: "info",
        title: "Documentos prontos para a primeira análise",
        detail: "Execute a análise executiva para obter a primeira leitura financeira da empresa.",
      };
    case "analysis_available":
      return {
        ...base,
        tone: "info",
        title: "Análise sem diagnóstico executivo",
        detail: "Gere o diagnóstico para transformar a análise em recomendações e decisões.",
      };
    case "no_documents":
      return {
        ...base,
        tone: "neutral",
        title: "Nenhum documento enviado",
        detail: "Envie a DRE, o Balanço/Balancete ou um extrato em PDF ou CSV para começar.",
      };
    case "diagnosis_available":
      return null;
  }
}

export function buildExecutiveOverview(
  portfolio: PortfolioInput,
  inputs: readonly CompanyOverviewInput[]
): ExecutiveOverview {
  const companies: CompanyOverview[] = inputs.map((input) => {
    const { state } = resolveActivationState(input);
    return {
      id: input.id,
      name: input.name,
      href: `/companies/${input.id}`,
      stage: state,
      stageLabel: STAGE[state].label,
      stageTone: STAGE[state].tone,
      lastAnalysisAt: input.latestAnalysis?.generatedAt ?? null,
      signals: signalsFor(input),
      documentsCount: input.documentsCount,
      decisionsCount: input.decisionsCount,
      nextStep: nextStep(state, input.id),
    };
  });

  const attention = companies
    .map(attentionFor)
    .filter((item): item is AttentionItem => item !== null)
    .sort((a, b) => {
      const stageOf = (item: AttentionItem) => companies.find((c) => c.id === item.companyId)!.stage;
      return ATTENTION_ORDER.indexOf(stageOf(a)) - ATTENTION_ORDER.indexOf(stageOf(b));
    });

  return {
    portfolio,
    companies,
    hiddenActiveCount: Math.max(0, portfolio.activeCount - companies.length),
    attention,
  };
}
