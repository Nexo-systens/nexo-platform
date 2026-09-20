import type { EngineMetadata } from "@/efos/types";

/**
 * Metadados descritivos de todos os 11 engines do EFOS Core. Puramente
 * descritivo — nenhuma logica de execucao. Ver docs/01_ARCHITECTURE/06_EFOS
 * CORE.md. A ordem abaixo segue a listagem historica dos 11 engines,
 * nao necessariamente a ordem sequencial de `EFOS_PIPELINE`
 * (efos/types/pipeline.ts) — a partir da Mission 014 (D-012, docs/
 * DECISIONS.md), `simulation` nao faz mais parte da cadeia principal
 * (`EFOS_PIPELINE`), mas continua catalogado aqui como Engine auxiliar.
 */
export const ENGINE_REGISTRY: readonly EngineMetadata[] = [
  {
    id: "data",
    name: "Data Engine",
    description:
      "Recebe, valida, normaliza e consolida dados de multiplas fontes.",
  },
  {
    id: "financial-model",
    name: "Financial Model Engine",
    description:
      "Constroi a representacao unica e viva da realidade financeira da empresa.",
  },
  {
    id: "financial-knowledge-graph",
    name: "Financial Knowledge Graph",
    description:
      "Estrutura o modelo financeiro como grafo de entidades e relacoes causais.",
  },
  {
    id: "indicators",
    name: "Indicators Engine",
    description:
      "Calcula indicadores financeiros deterministicos a partir do Financial Model diretamente (nao do grafo — ver D-006).",
  },
  {
    id: "evidence",
    name: "Evidence Engine",
    description:
      "Transforma modelo, indicadores e grafo em fatos objetivos e auditaveis. Nunca interpreta causa, nunca recomenda.",
  },
  {
    id: "context",
    name: "Context Engine",
    description:
      "Agrupa Evidencias relacionadas em situacoes financeiras compostas (ex.: Pressao de Caixa). Apenas descreve.",
  },
  {
    id: "reasoning",
    name: "Reasoning Engine",
    description:
      "Combina Contextos relacionados em conclusoes executivas deterministicas. Nunca recomenda, nunca decide.",
  },
  {
    id: "simulation",
    name: "Simulation Engine",
    description:
      "Engine auxiliar/opcional de projecao de cenarios (\"what-if\") — nao faz parte da cadeia principal (EFOS_PIPELINE); consumido sob demanda (D-012).",
  },
  {
    id: "recommendation",
    name: "Recommendation Engine",
    description:
      "Propoe acoes executivas possiveis a partir de Reasonings reconhecidos. Nunca decide qual sera executada, nunca prioriza (ver Decision Engine).",
  },
  {
    id: "decision",
    name: "Decision Engine",
    description:
      "Prioriza Recommendations de forma deterministica. Produz uma proposta estruturada de priorizacao — nunca registra a escolha humana (ver D-011).",
  },
  {
    id: "learning",
    name: "Learning Engine",
    description:
      "Registra conhecimento consolidado a partir do que ja foi produzido na execucao (Evidence/Context/Reasoning/Recommendation/Decision). Nunca altera comportamento do sistema.",
  },
];
