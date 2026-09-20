import type { LearningEvidenceClassification, LearningRecord, ScenarioType } from "@/efos/domain";
import { readExpectedActualLearningContext } from "@/efos/application/expected-actual-learning";

/**
 * `KnowledgeCandidate` — padrão recorrente POTENCIAL ainda não
 * consolidado (Mission 141 — Knowledge Formation & Cross-Decision
 * Learning, Etapa 3 da missão). Tipo da Application Layer, nunca uma
 * entidade de Domain nem uma tabela persistida — mesmo padrão de
 * `ObservationWindow`/`FinancialMetricObservation`
 * (`efos/application/financial-observation/`, Mission 139): uma
 * estrutura intermediária de composição, descartável, nunca
 * sobrevivendo além do cálculo de uma única formação.
 *
 * Um `KnowledgeCandidate` é formado por SIMILARIDADE ESTRUTURAL
 * determinística — nunca por IA/LLM (proibido explicitamente pela
 * Etapa 4 da missão). A chave de agrupamento escolhida
 * (`companyId`+`evidenceClassification`) é a única combinação de
 * campos de `LearningRecord` (D-072, Mission 140) que expressa
 * comparabilidade estrutural sem inventar nenhuma interpretação nova:
 * `evidenceClassification` já É, por construção, um vocabulário
 * fechado que classifica a FORÇA/DIREÇÃO da evidência disponível a
 * partir do julgamento humano já registrado (`Outcome.status`) — dois
 * `LearningRecord`s com a mesma `evidenceClassification`, da mesma
 * empresa, representam o mesmo tipo de padrão observado, por definição
 * do próprio vocabulário que já existe. Nenhum outro campo de
 * `LearningRecord` serve para este propósito: `type`/`source` são
 * sempre `"observation"`/`"historical_pattern"` para todo registro
 * produzido por `buildLearningRecord()` (Mission 140) — constantes,
 * não discriminam nada; `title`/`description` são texto livre — usá-
 * los exigiria comparação textual (fuzzy matching), exatamente o tipo
 * de julgamento não-determinístico que esta missão proíbe na Etapa 4.
 *
 * **Filtro implícito**: só `LearningRecord`s com `evidenceClassification`
 * definido participam de qualquer candidato — isso exclui
 * estruturalmente os `LearningRecord`s produzidos pelo `LearningEngine`
 * determinístico de execução única (`efos/engines/learning/`, Mission
 * 015), que nunca preenche esse campo (documentado em
 * `LearningRecord.ts`, Mission 140) — nenhuma mistura entre os dois
 * tipos de `LearningRecord` é possível.
 *
 * **Mission 187 — Governed Learning → Organizational Knowledge.**
 * `humanInterpretedCount`/`dominantScenarioType` (aditivos) permitem
 * que `buildKnowledgeFromLearningRecords()` produza um `statement`
 * genuinamente mais informativo sem nunca ler/citar o CONTEÚDO de
 * nenhum `LearningRecord.humanStatement` (Mission 186 Closure, D-100)
 * — apenas fatos estruturais AGREGADOS (contagem, homogeneidade de
 * `scenarioType`), nunca uma síntese semântica (proibida: "no AI/
 * embeddings/similarity", Seção 12 da missão). `humanInterpretedCount`
 * é a contagem de registros do grupo com `humanStatement` não-vazio —
 * um SINAL de que existe interpretação executiva a consultar, nunca o
 * texto em si. `dominantScenarioType` é definido SOMENTE quando TODOS
 * os registros do grupo que carregam `expectedActualContext` (D-099)
 * compartilham o MESMO `scenarioType` — `undefined` quando nenhum
 * registro tem contexto E-v-O, ou quando o grupo mistura tipos de
 * cenário diferentes (nunca uma homogeneidade fabricada).
 *
 * **Mission 187 Closure — Governed Knowledge Synthesis.**
 * `interpretations` (aditivo) preserva o texto VERBATIM de cada
 * `humanStatement` do grupo, com lineage (`learningRecordId`/
 * `decisionId`) — nunca reescrito/resumido aqui (Seção 6: "preserve
 * original text"). Continua sendo apenas SUPORTE PARA REVISÃO: um
 * humano revisor lê `interpretations` (nunca este módulo) para decidir
 * o `statement` organizacional final (`buildKnowledgeForCandidate()`,
 * `buildKnowledgeFromLearningRecords.ts`) — `KnowledgeCandidate`
 * continua nunca sintetizando/comparando/interpretando o conteúdo
 * semanticamente (D-101 reafirmado). `humanInterpretedCount` permanece
 * canônico e inalterado (D-101) — sempre igual a
 * `interpretations.length`, nunca duplicado por acidente de
 * manutenção futura (um só é derivado do outro, nunca calculado
 * separadamente).
 */
export interface KnowledgeCandidateInterpretation {
  readonly learningRecordId: string;
  readonly decisionId?: string;
  readonly humanStatement: string;
}

export interface KnowledgeCandidate {
  readonly companyId: string;
  readonly evidenceClassification: LearningEvidenceClassification;
  readonly learningRecordIds: readonly string[];
  readonly decisionIds: readonly string[];
  readonly outcomeIds: readonly string[];
  readonly financialObservationIds: readonly string[];
  readonly humanInterpretedCount: number;
  readonly dominantScenarioType?: ScenarioType;
  readonly interpretations: readonly KnowledgeCandidateInterpretation[];
}

function dedupe(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values));
}

/**
 * Mission 187 — Seção 7/11. `undefined` cobre tanto "nenhum registro do
 * grupo tem `expectedActualContext`" quanto "o grupo mistura mais de um
 * `scenarioType`" — ambos os casos são estruturalmente honestos: nenhum
 * mecanismo financeiro único pode ser atribuído ao grupo inteiro.
 */
function dominantScenarioTypeFor(group: readonly LearningRecord[]): ScenarioType | undefined {
  const scenarioTypes = new Set(
    group
      .map((record) => readExpectedActualLearningContext(record.supportingData)?.scenarioType)
      .filter((value): value is ScenarioType => value !== undefined)
  );
  return scenarioTypes.size === 1 ? [...scenarioTypes][0] : undefined;
}

/**
 * Agrupa `LearningRecord`s por similaridade estrutural
 * (`companyId`+`evidenceClassification`) — pura, determinística,
 * auditável, sem IA/LLM, sem acesso a banco. Devolve um
 * `KnowledgeCandidate` por grupo, **independente do tamanho** —
 * inclusive grupos de 1 (um candidato ainda não é `Knowledge`; a
 * exigência de recorrência mínima vive em
 * `buildKnowledgeFromLearningRecords()`, nunca aqui). Separar
 * "agrupar" de "decidir se é recorrente o suficiente" mantém cada
 * função com uma única responsabilidade testável.
 */
export function deriveKnowledgeCandidates(
  learningRecords: readonly LearningRecord[]
): readonly KnowledgeCandidate[] {
  const groups = new Map<string, LearningRecord[]>();

  for (const record of learningRecords) {
    if (!record.evidenceClassification) continue;
    const key = `${record.companyId}::${record.evidenceClassification}`;
    const group = groups.get(key);
    if (group) {
      group.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  return Array.from(groups.values()).map((group) => {
    const interpretations: KnowledgeCandidateInterpretation[] = group
      .filter((record) => typeof record.humanStatement === "string" && record.humanStatement.trim().length > 0)
      .map((record) => ({ learningRecordId: record.id, decisionId: record.decisions[0], humanStatement: record.humanStatement! }));

    return {
      companyId: group[0].companyId,
      evidenceClassification: group[0].evidenceClassification as LearningEvidenceClassification,
      learningRecordIds: group.map((record) => record.id),
      decisionIds: dedupe(group.flatMap((record) => record.decisions)),
      outcomeIds: dedupe(group.flatMap((record) => record.outcomeIds ?? [])),
      financialObservationIds: dedupe(group.flatMap((record) => record.financialObservationIds ?? [])),
      humanInterpretedCount: interpretations.length,
      dominantScenarioType: dominantScenarioTypeFor(group),
      interpretations,
    };
  });
}
