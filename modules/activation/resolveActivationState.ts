/**
 * Mission 195 — Founding Company Production Onboarding & First
 * Executive Value.
 *
 * Resolvedor PURO do estado de ativação de uma empresa — nenhum
 * cálculo financeiro, nenhuma persistência própria (Seção 35/36 da
 * missão: "Preferred answer: NO [new persisted state], if state can be
 * derived reliably from canonical data"). Toda entrada já é uma
 * contagem canônica já existente em produção (`documents`/
 * `executions`/`decisions` — Executive Diagnosis persistido) — este
 * módulo apenas ORDENA essas contagens em um estado nomeado e uma ação
 * primária, nunca cria verdade nova (Seção 60: "may observe/explain/
 * route toward canonical state... may NOT create financial truth").
 *
 * Precedência DELIBERADA, da mais "madura" para a mais "inicial": uma
 * vez que `executionsCount > 0`, a empresa NUNCA mais regride para um
 * estado de onboarding — mesmo que o lote de documentos atual esteja
 * 100% não-analisável ou vazio (Seção 39: "existing customer safety" —
 * um documento processando, um duplicado, ou um histórico não-atual
 * nunca deve jogar uma empresa madura de volta para a experiência de
 * primeiro uso).
 */

export type ActivationState =
  | "no_documents"
  | "documents_not_analyzable"
  | "ready_for_analysis"
  | "analysis_available"
  | "diagnosis_available";

export interface ActivationInputs {
  readonly documentsCount: number;
  readonly analyzableDocumentsCount: number;
  readonly executionsCount: number;
  readonly diagnosesCount: number;
}

export interface ActivationResult {
  readonly state: ActivationState;
  readonly primaryAction: string;
  readonly description: string;
}

/**
 * Rótulos determinísticos, nunca gerados por IA — mesmo princípio já
 * estabelecido por `DOCUMENT_GOVERNANCE_LABELS`/`STATEMENT_CATEGORY_LABELS`
 * (linguagem de produto fixa, a mesma para toda empresa). `description`
 * nunca afirma suporte a um formato que a ingestão real não processa
 * (Seção 9/10 da missão — apenas PDF/CSV são citados como analisáveis,
 * a mesma verdade já usada por `isAnalyzableDocumentName()`).
 */
export function resolveActivationState(inputs: ActivationInputs): ActivationResult {
  const { documentsCount, analyzableDocumentsCount, executionsCount, diagnosesCount } = inputs;

  if (diagnosesCount > 0) {
    return {
      state: "diagnosis_available",
      primaryAction: "Ver diagnóstico executivo",
      description:
        "Esta empresa já tem um diagnóstico executivo. Reenvie documentos e execute a análise novamente sempre que houver informação financeira nova.",
    };
  }

  if (executionsCount > 0) {
    return {
      state: "analysis_available",
      primaryAction: "Gerar diagnóstico executivo",
      description:
        "Esta empresa já tem uma análise financeira executada. Gere o diagnóstico executivo para obter recomendações a partir dela.",
    };
  }

  if (analyzableDocumentsCount > 0) {
    return {
      state: "ready_for_analysis",
      primaryAction: "Executar análise",
      description:
        "Os documentos enviados já podem ser analisados. Execute a análise executiva para obter a primeira verdade financeira desta empresa.",
    };
  }

  if (documentsCount > 0) {
    return {
      state: "documents_not_analyzable",
      primaryAction: "Enviar um PDF ou CSV",
      description:
        "Os documentos enviados não estão em um formato que a análise financeira usa hoje (apenas PDF e CSV) — eles permanecem armazenados, mas não contribuem para nenhuma análise. Envie um demonstrativo em PDF ou CSV para continuar.",
    };
  }

  return {
    state: "no_documents",
    primaryAction: "Enviar documento",
    description:
      "Para a primeira análise executiva, envie ao menos um demonstrativo financeiro em PDF ou CSV: Demonstração do Resultado (DRE), Balanço Patrimonial/Balancete, ou um extrato bancário com transações.",
  };
}

/**
 * Seção 28 da missão — capacidades secundárias (Scenario Lab, Executive
 * Chat, trajetória histórica) só ficam descobríveis depois que a
 * empresa alcança pelo menos UMA análise real — nunca antes, quando
 * elas não teriam nenhuma verdade financeira para operar sobre (Seção
 * 1: "Secondary capabilities... should become discoverable only when
 * relevant"). Pura função da mesma precedência acima — nunca uma
 * segunda árvore de decisão divergente.
 */
export function hasReachedFirstAnalysis(state: ActivationState): boolean {
  return state === "analysis_available" || state === "diagnosis_available";
}
