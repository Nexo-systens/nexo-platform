import type { KnowledgeCategory } from "../enums";
import type { DomainEntity } from "./base";

/**
 * Conhecimento — fato permanente aprendido sobre uma empresa (Camada 9
 * da Ontologia), ex.: "possui forte sazonalidade entre novembro e
 * janeiro". Permanece vivo e pode ser reutilizado em diagnosticos
 * futuros.
 *
 * **Mission 140 — auditoria explícita (Etapa 5)**: `Knowledge` já
 * representa exatamente "conhecimento executivo derivado de
 * observações rastreáveis" — não precisou ser redesenhado. Continuava
 * sem nenhuma implementação real (nunca persistido, nunca consumido
 * por nenhum código, confirmado por busca em todo o repositório) —
 * mesmo estado de antes da Mission 138 ter ativado `Outcome`.
 * `derivedFromLearningRecordIds?` foi adicionado como contrato,
 * deliberadamente NÃO implementado naquela missão: com apenas 1
 * `Decision` real em produção, qualquer construção automática de
 * `Knowledge` seria, por definição, um padrão fabricado a partir de
 * uma amostra de 1.
 *
 * **Mission 141 — Knowledge Formation & Cross-Decision Learning —
 * primeira ativação real.** `category: KnowledgeCategory` (novo,
 * obrigatório — nenhum `Knowledge` já existia em produção, campo
 * seguro de tornar obrigatório) é a garantia estrutural anti-
 * causalidade desta missão: só os 3 valores fechados de
 * `KnowledgeCategory` (`efos/domain/enums/knowledge.ts`) são
 * representáveis, nenhum deles afirma causalidade. `statement` agora é
 * sempre gerado deterministicamente por
 * `buildKnowledgeFromLearningRecords()`
 * (`efos/application/knowledge-formation/`) a partir de um GRUPO de
 * `LearningRecord`s recorrentes e comparáveis — nunca de uma opinião
 * livre. `derivedFromOutcomeIds` (já existia, obrigatório desde a
 * Mission 003) e `derivedFromLearningRecordIds` (agora sempre
 * preenchido quando `Knowledge` é formado por esta missão, nunca
 * vazio) juntos garantem rastreabilidade completa até `Decision`
 * (via `LearningRecord.decisions`) e `Outcome`/`FinancialOutcomeObservation`
 * reais — nunca um fato inventado. `Knowledge` continua distinto de
 * `LearningRecord` (um caso individual) e de Financial Truth (fatos
 * financeiros brutos) — ver `efos/application/knowledge-formation/README.md`.
 */
export interface Knowledge extends DomainEntity {
  readonly companyId: string;
  readonly category: KnowledgeCategory;
  readonly statement: string;
  readonly derivedFromOutcomeIds: readonly string[];
  readonly derivedFromLearningRecordIds?: readonly string[];
}
