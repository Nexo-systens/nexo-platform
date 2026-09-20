import type {
  LearningConfidence,
  LearningEvidenceClassification,
  LearningSource,
  LearningType,
} from "../enums";
import type { DomainEntity } from "./base";

/**
 * LearningRecord — conhecimento consolidado, registrado durante a
 * operação do sistema para evolução futura da metodologia (Mission 015
 * — Learning Engine). Ex.: "Pressão de caixa e deterioração de
 * rentabilidade tendem a coexistir nesta execução" (`recurring_risk`);
 * "Este conjunto de Recommendations originou esta Decision"
 * (`methodology_note`). Nunca modifica o comportamento do EFOS, nunca
 * altera Evidence/Context/Reasoning/Recommendation/Decision já
 * produzidos — apenas observa e registra o que já foi produzido.
 *
 * Relação com `Knowledge` (`efos/domain/entities/Knowledge.ts`,
 * Mission 003): são conceitos distintos, não fundidos por esta missão.
 * `Knowledge` representa um fato permanente sobre uma empresa, derivado
 * de `Outcome`s observados ao longo do tempo (`derivedFromOutcomeIds`)
 * — ainda não consumido por nenhum Engine, pois depende de `Outcome`
 * (que por sua vez depende de uma `Decision` já executada e avaliada,
 * fora do escopo de qualquer Engine implementado até agora).
 * `LearningRecord` é mais imediato: um registro estrutural do que foi
 * observado dentro de uma única execução do pipeline, sem depender de
 * resultado futuro algum. Ver docs/DECISIONS.md D-013.
 *
 * `type`/`confidence`/`source` usam vocabulário próprio deste Engine
 * (`LearningType`, `LearningConfidence`, `LearningSource` —
 * `efos/domain/enums/learning.ts`), nenhum reaproveitado — instrução
 * explícita da missão ("enums próprios"). `audit.createdAt`
 * (DomainEntity) cumpre o papel de timestamp, mesmo precedente de
 * D-003/D-007/D-008/D-009/D-010/D-011.
 *
 * `decisions`/`recommendations`/`reasonings`/`contexts`/`evidences`
 * referenciam por ID, nunca por composição direta de objeto — mesma
 * convenção de todo agregado do domínio.
 *
 * **Mission 140 — EFOS Continuous Financial Intelligence & Learning
 * Loop**: `outcomeIds?`/`financialObservationIds?`/
 * `evidenceClassification?` são aditivos e opcionais (mesmo precedente
 * de `Decision.basedOnDiagnosisId?`/`basedOnReviewId?`/`humanActorId?`,
 * D-063) — ativam, pela primeira vez, exatamente o vínculo que D-013
 * previu e deixou pendente ("a promoção de `LearningRecord` para
 * `Knowledge`... exigirá uma decisão arquitetural explícita"). Nunca
 * preenchidos pelo `LearningEngine` determinístico (`efos/engines/learning/`)
 * — todo `LearningRecord` que ele produz continua, byte a byte, o
 * mesmo registro estrutural de sempre, escopado a uma única execução
 * do pipeline. Estes três campos só existem para o **segundo
 * caminho**, igualmente válido: um `LearningRecord` derivado
 * deterministicamente de uma `Decision` real e do que foi observado
 * dela ao longo do tempo (`buildLearningRecord()`,
 * `efos/application/learning-derivation/`) — nunca uma opinião
 * arbitrária, sempre derivado de estado canônico já persistido
 * (`Outcome`, `FinancialOutcomeObservation`).
 *
 * **Mission 186 Closure — Human Learning Statement & Governance**:
 * `humanStatement?` (aditivo, opcional, mesmo precedente exato de
 * `DiagnosisReviewModification.humanStatement`,
 * `efos/application/diagnosis-review/DiagnosisReview.ts` — o texto do
 * humano é sempre atribuído ao humano, nunca gravado como se fosse
 * conteúdo determinístico). Corrige a leitura de D-099: "acionado por
 * um clique humano" (`deriveLearningRecordAction()`) nunca significou
 * "a conclusão do aprendizado é do humano" — `title`/`description`
 * continuam SEMPRE determinísticos (template por `evidenceClassification`,
 * nunca reescritos por esta extensão). `humanStatement` é a camada
 * distinta e genuinamente autoral: quando um `LearningRecord` carrega
 * `supportingData.expectedActualContext` (D-099), `humanStatement`
 * passa a ser OBRIGATÓRIO (`buildLearningRecord()`/
 * `LearningRecord.validator.ts`) — nenhum aprendizado que reivindique
 * contexto Esperado vs. Observado formal é persistido sem uma
 * interpretação humana explícita. Para o caminho genérico (sem
 * `expectedActualContext`), permanece opcional — nenhuma retrocompatibilidade
 * quebrada, nenhum `LearningRecord` histórico invalidado.
 */
export interface LearningRecord extends DomainEntity {
  readonly companyId: string;
  readonly type: LearningType;
  readonly confidence: LearningConfidence;
  readonly title: string;
  readonly description: string;
  readonly source: LearningSource;
  readonly decisions: readonly string[];
  readonly recommendations: readonly string[];
  readonly reasonings: readonly string[];
  readonly contexts: readonly string[];
  readonly evidences: readonly string[];
  readonly supportingData: Readonly<Record<string, unknown>>;
  readonly outcomeIds?: readonly string[];
  readonly financialObservationIds?: readonly string[];
  readonly evidenceClassification?: LearningEvidenceClassification;
  readonly humanStatement?: string;
}
