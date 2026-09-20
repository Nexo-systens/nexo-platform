/**
 * `DecisionExecutionEvent` (Mission 138 — Decision Execution & Outcome
 * Feedback Loop). Fecha o elo que D-011 deixou explicitamente em
 * aberto ("`Outcome.decisionId` ... sua resolução contra uma Decision
 * específica ... passa a ser responsabilidade de quem a consumir —
 * futuro Learning Engine") — mas para a metade "o que aconteceu com a
 * execução em si", nunca para o resultado observado (isso continua
 * sendo `Outcome`, `efos/domain/entities/Outcome.ts`).
 *
 * Vive em `efos/application/decision-execution/`, nunca em
 * `efos/domain/` — mesma decisão de camada já tomada para
 * `DiagnosisReview` (Mission 123, D-063): isto não é um fato
 * determinístico produzido por um Engine, é o acompanhamento humano do
 * andamento de uma `Decision` já registrada (`efos/domain/entities/
 * Decision.ts`). Auditoria desta missão confirmou que nenhum conceito
 * equivalente (`DecisionExecution`/`DecisionStatus`/`ExecutionStatus`)
 * existia em lugar nenhum do domínio antes desta missão — `Decision`
 * em si é imutável (nenhuma policy de UPDATE/DELETE em
 * `public.decisions`, D-066) e não carrega nenhum campo de progresso.
 *
 * **Nome deliberadamente composto** (`DecisionExecutionEvent`, nunca
 * `Execution` isolado): "execução" já é um termo pesadamente
 * sobrecarregado neste código-base para significar "uma rodada
 * determinística do pipeline financeiro" (`ExecutionSnapshot`,
 * `ExecutionRepository`, `PipelineExecution`, a tabela
 * `public.executions`) — um conceito inteiramente diferente. Este tipo
 * nunca deve ser abreviado para "Execution" sozinho em código novo, por
 * risco real de confusão com esses símbolos já existentes.
 *
 * **Modelo escolhido: log de eventos imutável, não uma linha mutável
 * única** — mesmo padrão já usado por `DiagnosisReview` (múltiplas
 * revisões por diagnóstico, a mais recente por `created_at` é a
 * autoritativa) e por toda tabela deste código-base (nenhuma tem
 * policy de UPDATE). Cada mudança de status real é um novo evento
 * imutável, nunca uma edição in-place — evita reintroduzir mutabilidade
 * onde o resto do sistema deliberadamente não tem. `startedAt`/
 * `completedAt`/`owner` (pedidos pela missão) não são campos próprios
 * aqui — são **derivados** da sequência de eventos por
 * `deriveDecisionExecutionState()` (`deriveDecisionExecutionState.ts`,
 * mesmo arquivo deste módulo), a única fonte de verdade sobre "estado
 * atual".
 */

/**
 * Estados de execução — vocabulário exatamente pedido pela missão
 * (Etapa 4.2), mantido sem adição/remoção. UPPERCASE_SNAKE segue o
 * precedente mais próximo por categoria (`DiagnosisReviewStatus`,
 * D-063/D-066 — outro "status de workflow humano" recém-introduzido),
 * não o precedente mais antigo (`CompanyStatus`/`DocumentStatus`,
 * lowercase) — os dois padrões coexistem legitimamente neste
 * código-base; esta escolha prioriza a analogia conceitual mais
 * próxima sobre a ordem cronológica.
 *
 * `NOT_STARTED` nunca é persistido como um evento real — mesma
 * convenção já estabelecida por `DiagnosisReviewStatus.PENDING`
 * (D-063): "ainda não iniciada" é representado pela AUSÊNCIA de
 * qualquer `DecisionExecutionEvent` para a `Decision`, nunca por um
 * evento com este status. Mantido no vocabulário (não removido) porque
 * é o valor que `deriveDecisionExecutionState()` devolve nesse caso —
 * precisa existir como valor de tipo válido, só nunca como linha
 * persistida.
 */
export const DECISION_EXECUTION_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type DecisionExecutionStatus = (typeof DECISION_EXECUTION_STATUSES)[number];

/**
 * Um evento real de progresso (Etapa 4.1). `actorId` é sempre
 * resolvido server-side (nunca aceito do client — mesma regra de
 * `reviewedBy`/`humanActorId`, D-065/D-067) — quem chama a função de
 * composição (`modules/decisions/lib/buildDecisionExecutionEvent.ts`)
 * é responsável por já ter resolvido essa identidade via
 * `getCurrentUser()`. `targetDate?`/`notes?` são livres, nunca
 * interpretados por nenhuma regra determinística.
 */
export interface DecisionExecutionEvent {
  readonly id: string;
  readonly decisionId: string;
  readonly companyId: string;
  readonly status: DecisionExecutionStatus;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly targetDate?: string;
  readonly notes?: string;
}
