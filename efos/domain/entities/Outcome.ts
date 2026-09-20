import type { OutcomeStatus } from "../enums";
import type { DomainEntity } from "./base";

/**
 * Resultado — consequencia observada apos uma decisao
 * (docs/01_ARCHITECTURE/04_DOMAIN MODEL.md, "Resultado"). Alimenta o
 * Learning Engine (efos/engines/learning).
 *
 * Mission 138 — Decision Execution & Outcome Feedback Loop: `Outcome`
 * já existia neste arquivo desde a Mission 003 (D-011), mas nunca
 * havia sido persistido nem consumido por nenhum código — esta missão
 * é a primeira a ativá-lo de fato, resolvendo o vínculo que D-011
 * deixou explicitamente pendente ("`Outcome.decisionId` ... sua
 * resolução ... passa a ser responsabilidade de quem a consumir").
 * `expectedResult?`/`recordedBy?` são aditivos e opcionais (mesmo
 * precedente de `Decision.basedOnDiagnosisId?`/`basedOnReviewId?`/
 * `humanActorId?`, D-063). `expectedResult?` denormaliza, apenas para
 * comparação lado a lado, o que se esperava no momento da decisão;
 * nunca confundido com `description` (o que de fato foi observado) —
 * a distinção Expected vs. Observed é preservada estruturalmente por
 * serem dois campos sempre distintos, nunca um único campo
 * reaproveitado para os dois sentidos. `recordedBy?` é o humano que
 * registrou o Outcome — sempre resolvido server-side (nunca aceito do
 * client, mesma regra de `humanActorId`), nunca preenchido pela IA.
 */
export interface Outcome extends DomainEntity {
  readonly companyId: string;
  readonly decisionId: string;
  readonly status: OutcomeStatus;
  readonly observedAt: string; // ISO date
  readonly description: string;
  readonly expectedResult?: string;
  readonly recordedBy?: string;
}
