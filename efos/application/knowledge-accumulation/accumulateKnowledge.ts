import type { Knowledge, LearningRecord } from "@/efos/domain";

import { buildKnowledgeFromLearningRecords } from "@/efos/application/knowledge-formation";

import type {
  KnowledgeAccumulationRejection,
  KnowledgeAccumulationResult,
} from "./KnowledgeAccumulationResult";

/**
 * `accumulateKnowledge()` (Mission 144 — Knowledge Accumulation &
 * Historical Pattern Formation). Orquestrador explícito de
 * `LearningRecord[] → Knowledge Formation → KnowledgeCandidate[] →
 * Validation → (created/existing/rejected)` — Etapa 3 da missão.
 *
 * **Full recomputation, nunca incremental** (Etapa 2.C da missão,
 * decisão explícita): a cada chamada, TODOS os `LearningRecord`s
 * elegíveis da empresa são reconsiderados — nunca um estado "já
 * processado" é mantido entre chamadas. Escolhido sobre incremental
 * evaluation porque: **correção** — recomputação total nunca perde um
 * grupo que só se tornou recorrente com um `LearningRecord` mais
 * antigo adicionado fora de ordem; **determinismo** — o resultado
 * depende só do conjunto de entrada, nunca de qual chamada aconteceu
 * quando; **idempotência** — reexecutar com o mesmo conjunto sempre
 * produz o mesmo `created`/`existing` (via `id` determinístico, D-073);
 * **auditabilidade** — nenhum estado oculto de "quais registros já
 * foram vistos" para inspecionar; **escalabilidade futura** — no
 * volume atual (dezenas de `LearningRecord`s por empresa, não
 * milhões), o custo de recomputar é desprezível, e incremental
 * evaluation exigiria um novo conceito de "cursor"/"checkpoint" sem
 * necessidade comprovada agora (nunca escolhido "só por parecer mais
 * sofisticado", conforme a própria missão instrui).
 *
 * **Nunca duplica** `deriveKnowledgeCandidates()`/seleção/validação de
 * `Knowledge` (Etapa 2.D) — delega inteiramente a
 * `buildKnowledgeFromLearningRecords()` (Mission 141, D-073), que já
 * reaproveita `deriveKnowledgeCandidates()` e `validateKnowledge()`
 * internamente.
 *
 * **Company boundary explícito (Etapa 6)**: `companyId` é sempre um
 * parâmetro obrigatório — qualquer `LearningRecord` de entrada com
 * `companyId` diferente é REJEITADO explicitamente (`COMPANY_MISMATCH`,
 * nunca silenciosamente agrupado nem silenciosamente descartado sem
 * registro).
 *
 * **Temporalidade (Etapa 7)**: `asOf?` é repassado diretamente a
 * `buildKnowledgeFromLearningRecords()` — mesma lógica da Mission 141,
 * nunca duplicada/divergente.
 *
 * **Idempotência real (Etapa 5)**: `existingKnowledge` (já persistido,
 * lido pelo chamador) é comparado por `id` determinístico contra cada
 * `Knowledge` computado — um candidato cujo `id` já existe em
 * `existingKnowledge` nunca é reclassificado como `created`, sempre
 * como `existing`. A persistência (fora desta função pura) continua
 * sendo a autoridade final contra duplicação (colisão `23505` tratada
 * em `saveKnowledge()`, Mission 141).
 *
 * Pura — nunca acessa Supabase/`createClient`, nunca chama IA, nunca
 * lê o relógio do sistema (`formedAt`/`asOf` sempre parâmetros).
 * **Nunca interpreta resultados** (Etapa 3 da missão) — apenas
 * classifica cada `Knowledge` computado como `created`/`existing`,
 * nunca julga se o padrão "faz sentido" ou é "importante".
 */
export function accumulateKnowledge(
  companyId: string,
  learningRecords: readonly LearningRecord[],
  existingKnowledge: readonly Knowledge[],
  formedAt: string,
  asOf?: string
): KnowledgeAccumulationResult {
  const rejected: KnowledgeAccumulationRejection[] = [];
  const eligible: LearningRecord[] = [];

  for (const record of learningRecords) {
    if (record.companyId !== companyId) {
      rejected.push({
        code: "COMPANY_MISMATCH",
        learningRecordId: record.id,
        message: `LearningRecord pertence à empresa "${record.companyId}", diferente da empresa informada ("${companyId}") — nunca agrupado silenciosamente.`,
      });
      continue;
    }
    eligible.push(record);
  }

  if (eligible.length === 0) {
    return { outcome: "NO_ELIGIBLE_LEARNING", created: [], existing: [], rejected };
  }

  const built = buildKnowledgeFromLearningRecords(eligible, formedAt, asOf);

  if (!built.success) {
    if (built.error.code === "NO_SUFFICIENT_RECURRING_LEARNING") {
      return { outcome: "NO_SUFFICIENT_RECURRING_LEARNING", created: [], existing: [], rejected };
    }

    // INVALID_KNOWLEDGE — Etapa 12.P: nenhum Knowledge inválido é
    // persistido. Cada erro de validação vira uma rejeição explícita,
    // rastreável, nunca um Knowledge fabricado para contornar o erro.
    for (const validationError of built.error.errors) {
      rejected.push({ code: "INVALID_KNOWLEDGE_CANDIDATE", message: validationError });
    }
    return { outcome: "NO_SUFFICIENT_RECURRING_LEARNING", created: [], existing: [], rejected };
  }

  const existingIds = new Set(existingKnowledge.map((k) => k.id));
  const created: Knowledge[] = [];
  const existing: Knowledge[] = [];

  for (const knowledge of built.value) {
    if (existingIds.has(knowledge.id)) {
      existing.push(knowledge);
    } else {
      created.push(knowledge);
    }
  }

  const outcome = created.length > 0 ? "KNOWLEDGE_CREATED" : "KNOWLEDGE_ALREADY_EXISTS";
  return { outcome, created, existing, rejected };
}
