import type { Knowledge, LearningRecord } from "@/efos/domain";
import type { Result } from "@/efos/application/shared";

import { deriveKnowledgeCandidates, type KnowledgeCandidate } from "./KnowledgeCandidate";
import { deriveKnowledgeId } from "./deriveKnowledgeId";
import { validateKnowledge } from "./Knowledge.validator";

/**
 * Número mínimo de `Decision`s DISTINTAS exigido para que um
 * `KnowledgeCandidate` vire `Knowledge` (Mission 141, Etapa 5 — "Regra
 * de Recorrência"). **Auditado antes de escolher**: nenhum threshold
 * de recorrência já existia para `Knowledge`/`LearningRecord`
 * especificamente, mas um precedente arquitetural direto já existe —
 * `MINIMUM_EVIDENCES_FOR_CONTEXT = 2`
 * (`efos/engines/context/context.constants.ts`, Mission 010): "abaixo
 * disso, o fato já é coberto sozinho pela própria Evidence — um
 * Context só existe quando há algo a mais do que repetir uma única
 * observação". Mesmo raciocínio aplicado aqui: um único caso já é
 * inteiramente coberto pelo próprio `LearningRecord` — `Knowledge`
 * (conhecimento CONSOLIDADO, reutilizável) só se justifica quando há
 * mais de um caso independente confirmando o mesmo padrão. `2` é o
 * menor valor deterministicamente defensável (o menor número que ainda
 * significa "mais de um caso"), mesmo valor do precedente — nunca
 * assumido silenciosamente, registrado como D-073.
 *
 * **Contagem por Decisions DISTINTAS, nunca por LearningRecords**: o
 * título da missão é "Cross-Decision Learning" — reexecutar
 * `deriveLearningRecordAction()" (Mission 140) várias vezes para a
 * MESMA `Decision` produziria múltiplos `LearningRecord`s sobre o
 * MESMO caso, nunca uma recorrência real entre casos independentes.
 * Contar `decisionIds` distintas (não `learningRecordIds.length`)
 * impede essa fabricação estrutural de recorrência.
 */
export const MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE = 2;

export type BuildKnowledgeError =
  | { readonly code: "NO_SUFFICIENT_RECURRING_LEARNING"; readonly message: string }
  | { readonly code: "INVALID_KNOWLEDGE"; readonly errors: readonly string[] };

const HUMAN_JUDGED_CLASSIFICATIONS = new Set(["EVIDENCE_FAVORABLE", "EVIDENCE_CONTRARY", "INCONCLUSIVE"]);

/**
 * Mission 187 — Seção 11/16. Vocabulário LOCAL deste módulo (Application
 * Layer nunca importa de `modules/scenarios/lib/scenario-language.ts`,
 * que é Experience/Platform) — apenas os 2 tipos com simulador real em
 * produção (D-092); qualquer outro `ScenarioType` cai no fallback
 * genérico abaixo, nunca um erro.
 */
const SCENARIO_TYPE_DESCRIPTIONS: Partial<Record<string, string>> = {
  adjust_operating_costs: "mudança de Despesas Operacionais",
  adjust_collection_terms: "mudança de prazo de recebimento",
};

/**
 * Mission 187 — nota estrutural ADITIVA, sempre ao final do template
 * por `evidenceClassification` (nunca substitui/reescreve a frase
 * original). `dominantScenarioType` é um FATO estrutural (todos os
 * registros do grupo compartilham o mesmo mecanismo financeiro) —
 * nunca uma afirmação de causa/efeito. `humanInterpretedCount` aponta
 * para a EXISTÊNCIA de interpretação executiva, nunca reproduz seu
 * conteúdo (Seção 6 da missão: `humanStatement` nunca se torna fato
 * verificado/Knowledge automaticamente).
 */
function contributionNoteFor(candidate: KnowledgeCandidate): string {
  const scenarioNote = candidate.dominantScenarioType
    ? ` Todos os casos observados compartilham o mesmo mecanismo financeiro (${SCENARIO_TYPE_DESCRIPTIONS[candidate.dominantScenarioType] ?? candidate.dominantScenarioType}).`
    : "";
  const interpretationNote =
    candidate.humanInterpretedCount > 0
      ? ` ${candidate.humanInterpretedCount} ${candidate.humanInterpretedCount === 1 ? "destes registros inclui" : "destes registros incluem"} interpretação executiva registrada explicitamente — consulte os LearningRecords de origem para o texto completo.`
      : "";
  return scenarioNote + interpretationNote;
}

function statementFor(candidate: KnowledgeCandidate): string {
  const n = candidate.decisionIds.length;
  const note = contributionNoteFor(candidate);
  switch (candidate.evidenceClassification) {
    case "TEMPORAL_ASSOCIATION":
      return `${n} decisões independentes desta empresa apresentam movimento financeiro observado recorrente, sem julgamento humano associado ainda (associação temporal, nunca causalidade) — evidência: ${candidate.learningRecordIds.length} LearningRecord(s).${note}`;
    case "EVIDENCE_FAVORABLE":
      return `${n} decisões independentes desta empresa foram avaliadas pelo humano responsável como resultado positivo — padrão histórico recorrente, nunca prova de que uma decisão futura semelhante terá o mesmo resultado.${note}`;
    case "EVIDENCE_CONTRARY":
      return `${n} decisões independentes desta empresa foram avaliadas pelo humano responsável como resultado negativo — padrão histórico recorrente, nunca prova de que uma decisão futura semelhante terá o mesmo resultado.${note}`;
    case "INCONCLUSIVE":
      return `${n} decisões independentes desta empresa permanecem com julgamento humano neutro/inconclusivo/pendente — ausência recorrente de conclusão clara, nunca um resultado inventado.${note}`;
  }
}

function categoryFor(candidate: KnowledgeCandidate): Knowledge["category"] {
  return HUMAN_JUDGED_CLASSIFICATIONS.has(candidate.evidenceClassification) ? "historical_pattern" : "recurring_observation";
}

/**
 * `buildKnowledgeForCandidate()` (Mission 187 Closure — Governed
 * Knowledge Synthesis). Extraído de dentro do laço de
 * `buildKnowledgeFromLearningRecords()` (refatoração pura — o
 * comportamento OBSERVÁVEL de `buildKnowledgeFromLearningRecords()`
 * permanece byte a byte idêntico ao de antes desta missão, confirmado
 * por regressão) para ser reaproveitado por DOIS chamadores: o laço de
 * formação automática abaixo (`organizationalStatement` sempre
 * `undefined`) e a nova ação de revisão governada
 * (`modules/decisions/actions/knowledge-formation.actions.ts`,
 * `formGovernedKnowledgeAction()`), que passa o texto CONFIRMADO por um
 * revisor humano.
 *
 * **`organizationalStatement` (Seção 7/9 da missão de fechamento)**:
 * quando ausente ou vazio/só espaços, o `statement` continua sendo
 * `statementFor(candidate)` — o template determinístico de sempre
 * (D-073/D-101), nunca alterado. Quando um revisor humano fornece um
 * texto não-vazio, ELE se torna o `statement` final — nunca uma
 * concatenação/síntese automática de `candidate.interpretations`
 * (proibida, Seção 8) — apenas o texto que o revisor escreveu, ao pé da
 * letra, exatamente como `LearningRecord.humanStatement` (D-100) nunca
 * é reformulado pelo sistema.
 *
 * **`provenance.confidence` nunca muda (Seção 14 — auditoria
 * obrigatória, ver `docs/DECISIONS.md` D-102 para o racional completo)**:
 * permanece sempre `{value:100, level:"very_high"}`, com ou sem
 * `organizationalStatement`. Este campo NUNCA representou confiança na
 * VERACIDADE do conteúdo do `statement` — representa confiança no
 * PROCESSO DE FORMAÇÃO (mesmo eixo de `EvidenceConfidence`/
 * `LearningConfidence`: "confiança no processo que gerou o dado" ≠
 * "quão bem fundamentado o fato está", `efos/domain/enums/evidence.ts`).
 * Um `Knowledge` formado automaticamente e um `Knowledge` confirmado
 * por revisão humana são IGUALMENTE bem-formados estruturalmente
 * (mesma lineage, mesmo threshold, mesma validação) — `confidence`
 * nunca foi, e continua não sendo, uma alegação de causalidade/verdade
 * do `statement`.
 */
export function buildKnowledgeForCandidate(
  candidate: KnowledgeCandidate,
  formedAt: string,
  organizationalStatement?: string
): Result<Knowledge, BuildKnowledgeError> {
  const category = categoryFor(candidate);
  const statement =
    organizationalStatement !== undefined && organizationalStatement.trim().length > 0
      ? organizationalStatement.trim()
      : statementFor(candidate);

  const knowledge: Knowledge = {
    id: deriveKnowledgeId(candidate.companyId, category, candidate.learningRecordIds),
    companyId: candidate.companyId,
    category,
    statement,
    derivedFromOutcomeIds: candidate.outcomeIds,
    derivedFromLearningRecordIds: candidate.learningRecordIds,
    provenance: { source: "knowledge-formation", confidence: { value: 100, level: "very_high" } },
    audit: { createdAt: formedAt, updatedAt: formedAt, version: 1 },
  };

  const validation = validateKnowledge(knowledge);
  if (!validation.valid) {
    return { success: false, error: { code: "INVALID_KNOWLEDGE", errors: validation.errors } };
  }

  return { success: true, value: knowledge };
}

/**
 * `buildKnowledgeFromLearningRecords()` (Mission 141 — Knowledge
 * Formation & Cross-Decision Learning). Única composição autorizada a
 * transformar múltiplos `LearningRecord`s (D-072, Mission 140) reais
 * em `Knowledge` (D-011/D-072-extensão, ativado por esta missão) —
 * nunca a partir de uma opinião livre, nunca via IA/LLM.
 *
 * Pura — sem acesso a Repository/banco (quem chama já resolveu
 * `learningRecords`), sem `randomUUID()`/`Date.now()` internos (`id`
 * é sempre derivado deterministicamente de `deriveKnowledgeId()`;
 * `formedAt` é sempre parâmetro).
 *
 * **Temporalidade (Etapa 9)**: `asOf?`, quando informado, filtra
 * `learningRecords` para `record.audit.createdAt <= asOf` ANTES de
 * qualquer agrupamento — garante que nenhum registro criado depois do
 * ponto de corte contamine uma formação que representa um estado
 * histórico anterior. Sem `asOf`, todos os registros recebidos
 * participam (a pureza da função já impede qualquer leitura oculta do
 * relógio do sistema).
 *
 * **Sem conhecimento fabricado (Etapa 6/Etapa 13)**: se nenhum grupo
 * atingir `MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE`, devolve
 * `NO_SUFFICIENT_RECURRING_LEARNING` — nunca um `Knowledge` inventado
 * a partir de evidência insuficiente. Pode formar MAIS de um
 * `Knowledge` numa mesma chamada (um por `KnowledgeCandidate` que
 * atingir o threshold) — cada padrão independente vira seu próprio
 * `Knowledge`, nunca misturado.
 *
 * **Mission 187 — Governed Learning → Organizational Knowledge.**
 * `statementFor()` ganha uma nota estrutural aditiva
 * (`contributionNoteFor()`) — nunca uma reescrita do template original
 * por `evidenceClassification` (inalterado, D-073) — reportando (a)
 * quando o grupo inteiro compartilha o mesmo `scenarioType`
 * (`KnowledgeCandidate.dominantScenarioType`, Mission 187) e (b) quantos
 * registros do grupo carregam interpretação executiva explícita
 * (`KnowledgeCandidate.humanInterpretedCount`, Mission 187, contagem de
 * `LearningRecord.humanStatement` não-vazios). Nunca lê/cita o
 * CONTEÚDO de `humanStatement` — apenas sua EXISTÊNCIA agregada (Seção
 * 6 da missão: interpretação humana nunca vira fato automaticamente
 * verificado). Para grupos sem nenhum registro enriquecido (Mission
 * 186/186 Closure), ambas as notas ficam vazias — `statement` idêntico
 * byte a byte ao produzido antes desta missão (retrocompatibilidade
 * total, Seção 17/18).
 */
export function buildKnowledgeFromLearningRecords(
  learningRecords: readonly LearningRecord[],
  formedAt: string,
  asOf?: string
): Result<readonly Knowledge[], BuildKnowledgeError> {
  const temporallyScoped = asOf
    ? learningRecords.filter((record) => record.audit.createdAt <= asOf)
    : learningRecords;

  const candidates = deriveKnowledgeCandidates(temporallyScoped);
  const recurring = candidates.filter(
    (candidate) => candidate.decisionIds.length >= MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE
  );

  if (recurring.length === 0) {
    return {
      success: false,
      error: {
        code: "NO_SUFFICIENT_RECURRING_LEARNING",
        message: `Nenhum grupo de LearningRecords comparáveis atinge o mínimo de ${MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE} Decisions independentes — nenhum Knowledge é fabricado a partir de evidência insuficiente.`,
      },
    };
  }

  const knowledgeRecords: Knowledge[] = [];
  const allErrors: string[] = [];

  for (const candidate of recurring) {
    const built = buildKnowledgeForCandidate(candidate, formedAt);
    if (!built.success) {
      if (built.error.code === "INVALID_KNOWLEDGE") allErrors.push(...built.error.errors);
      continue;
    }
    knowledgeRecords.push(built.value);
  }

  if (allErrors.length > 0) {
    return { success: false, error: { code: "INVALID_KNOWLEDGE", errors: allErrors } };
  }

  return { success: true, value: knowledgeRecords };
}
