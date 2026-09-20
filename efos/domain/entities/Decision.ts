import type {
  DecisionType,
  RecommendationConfidence,
  RecommendationPriority,
} from "../enums";
import type { DomainEntity } from "./base";

/**
 * Decision — priorização executiva determinística, resultado de uma ou
 * mais Recommendations (Mission 013 — Decision Engine). Ex.:
 * Recommendations "Melhorar geração de caixa" + "Reduzir custos" →
 * Decision "Priorizar ações de preservação de caixa antes de
 * iniciativas de expansão". Organiza e ordena recomendações para apoiar
 * a decisão humana — **não é o registro da escolha humana em si**.
 *
 * Reconciliação com a Regra Fundamental ("o EFOS nunca decide, apenas
 * apoia quem decide" — `docs/PROJECT_RULES.md`, `docs/AI_START.md`): o
 * formato anterior desta entidade (Mission 003 — `recommendationId`,
 * `decidedByUserId`, `decidedAt`, `justification`, `accepted`)
 * modelava o *registro de uma escolha humana já tomada*. A Mission 013
 * pede algo estruturalmente diferente — o Decision Engine organiza e
 * ordena Recommendations deterministicamente, produzindo uma
 * *proposta estruturada de priorização*, nunca uma ação executada nem
 * uma escolha humana registrada. Este `Decision` é o artefato que o
 * EFOS entrega para apoiar a decisão — a captura da escolha humana
 * real (quem aceitou, quando, por quê) continua sendo um conceito
 * futuro, fora do escopo desta missão, e deve ser modelada
 * separadamente quando existir (ver docs/DECISIONS.md D-011).
 *
 * `priority`/`confidence` reaproveitam `RecommendationPriority`/
 * `RecommendationConfidence` (`efos/domain/enums/decision.ts` e
 * `efos/domain/enums/recommendation.ts`) — mesmo eixo de prioridade e
 * confiança das Recommendations que a Decision consolida, sem duplicar
 * vocabulário (D-011, ao contrário de D-009/D-010, que criaram enums
 * próprios por instrução explícita de missão). `rationale` é texto
 * determinístico explicando o critério de priorização usado — nunca
 * gerado por IA, nunca subjetivo. `audit.createdAt` (DomainEntity)
 * cumpre o papel de timestamp, mesmo precedente de D-003/D-007/D-008/
 * D-009/D-010.
 *
 * `recommendations`/`reasonings`/`contexts`/`evidences` referenciam
 * por ID, nunca por composição direta de objeto — mesma convenção de
 * todo agregado do domínio. `reasonings`/`contexts`/`evidences` são a
 * união (sem duplicatas) dos mesmos campos já presentes nas
 * Recommendations incluídas — denormalizado para rastreabilidade
 * direta, sem introduzir referência nova além das que já existiam.
 *
 * `basedOnDiagnosisId?`/`basedOnReviewId?`/`humanActorId?` (Mission 123
 * — Human Review & Decision Authority Model, D-063): extensão aditiva
 * e opcional, nunca uma reinterpretação silenciosa do que este tipo já
 * significava (D-011 alerta explicitamente contra isso). O
 * `Decision Engine` (`efos/engines/decision/`) **nunca** preenche esses
 * três campos — toda `Decision` que ele produz continua, byte a byte,
 * a mesma proposta determinística de sempre, sem nenhuma mudança de
 * comportamento. Eles só existem para o **segundo caminho**,
 * igualmente válido, de produzir uma `Decision`: um humano, depois de
 * revisar um `ExecutiveDiagnosis` via `DiagnosisReview`
 * (`efos/application/diagnosis-review/`), decide algo — possivelmente
 * na direção oposta à sugestão da IA — e essa decisão é registrada
 * como uma `Decision` com estes três campos preenchidos.
 * `humanActorId !== undefined` é o único sinal estrutural que distingue
 * as duas origens; nenhum campo determinístico (`type`/`priority`/
 * `confidence`) muda de significado entre os dois casos. **Nenhum
 * código de produção constrói esse segundo tipo de `Decision`
 * automaticamente** — é sempre um ato humano explícito, fora do escopo
 * desta missão (contrato apenas).
 *
 * `basedOnRecommendationId?` (Mission 150 — Executive Recommendation →
 * Human Decision Traceability, D-082): extensão aditiva e opcional,
 * mesmo precedente exato de `basedOnDiagnosisId?`/`basedOnReviewId?`
 * acima — nunca reinterpreta `recommendations` (que continua
 * referenciando `Recommendation.id[]`, a entidade determinística do
 * Recommendation Engine, D-010/D-011, nunca os itens gerados pela
 * Executive AI). Referencia o `id` opaco de um item específico dentro
 * de um `ExecutiveDiagnosis` já persistido (`interpretations[].id`/
 * `hypotheses[].id`/`risks[].id`/`priorities[].id`/`possibleActions[].id`/
 * `questions[].id`/`uncertainties[].id`/`conflictInterpretations[].id`,
 * D-059) — a "Recommendation" gerada pela IA que este `Decision`
 * humano responde, quando houver uma. Sempre opcional: uma `Decision`
 * pode continuar existindo sem nenhum diagnóstico (`basedOnDiagnosisId`
 * ausente), com diagnóstico mas sem recomendação específica citada
 * (Cenário comum: humano concorda com o resumo geral, sem responder a
 * um item específico), ou com diagnóstico + recomendação específica
 * (Cenário Etapa 9/10 da missão: aceitação/modificação/rejeição de uma
 * proposta específica da IA). **Nunca preenchido automaticamente** —
 * mesma disciplina de `humanActorId`/`basedOnReviewId`, sempre um ato
 * humano explícito.
 */
export interface Decision extends DomainEntity {
  readonly companyId: string;
  readonly type: DecisionType;
  readonly priority: RecommendationPriority;
  readonly confidence: RecommendationConfidence;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly recommendations: readonly string[];
  readonly reasonings: readonly string[];
  readonly contexts: readonly string[];
  readonly evidences: readonly string[];
  readonly supportingData: Readonly<Record<string, unknown>>;
  readonly basedOnDiagnosisId?: string;
  readonly basedOnReviewId?: string;
  readonly basedOnRecommendationId?: string;
  readonly humanActorId?: string;
}
