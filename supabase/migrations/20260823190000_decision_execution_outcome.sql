-- =========================================================
-- NEXO PLATFORM
-- Migration 008
-- Decision Execution & Outcome Feedback Loop (DecisionExecutionEvent,
-- Outcome — Mission 138)
-- =========================================================

-- =========================================================
-- DECISION_EXECUTION_EVENTS
-- Uma linha por evento real de progresso de execucao de uma Decision
-- (efos/application/decision-execution/DecisionExecutionEvent.ts,
-- Mission 138). Log de eventos imutavel — mesmo padrao de
-- diagnosis_reviews (multiplos eventos por decision permitidos,
-- cardinalidade N; o mais recente por created_at e o autoritativo
-- para "estado atual", derivado por deriveDecisionExecutionState(),
-- nunca uma coluna fisica propria). "company_id" e denormalizado a
-- partir de decisions.company_id (mesmo padrao de diagnosis_reviews/
-- executions) — evita join de dois niveis em toda policy de RLS.
-- "status" exclui "NOT_STARTED": o proprio contrato
-- (DecisionExecutionEvent.ts) documenta que NOT_STARTED nunca e um
-- evento real — representa a AUSENCIA de qualquer evento, nunca uma
-- linha persistida (mesmo padrao de diagnosis_review_status excluir
-- "PENDING" da pratica, mesmo mantendo o valor no vocabulario).
-- Imutavel apos inserido: nenhuma policy de update/delete.
-- =========================================================

create type public.decision_execution_status as enum (
    'NOT_STARTED',
    'IN_PROGRESS',
    'BLOCKED',
    'COMPLETED',
    'CANCELLED'
);

create table public.decision_execution_events (

    id uuid primary key default gen_random_uuid(),

    decision_id uuid not null references public.decisions (id),

    company_id uuid not null references public.companies (id),

    actor_id uuid not null references auth.users (id),

    status public.decision_execution_status not null,

    occurred_at timestamptz not null default now(),

    target_date date,

    notes text,

    created_at timestamptz not null default now()

);

comment on table public.decision_execution_events is 'Log imutavel de eventos de progresso de execucao de uma Decision (Mission 138). "Estado atual" e sempre derivado do evento mais recente por decision_id, nunca uma coluna propria. actor_id nunca aceito do client — sempre resolvido server-side via auth.uid().';

create index decision_execution_events_decision_id_idx on public.decision_execution_events (decision_id);
create index decision_execution_events_company_id_idx on public.decision_execution_events (company_id);

alter table public.decision_execution_events enable row level security;

create policy "decision_execution_events_select_own"
    on public.decision_execution_events
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = decision_execution_events.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "decision_execution_events_insert_own"
    on public.decision_execution_events
    for insert
    with check (
        actor_id = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = decision_execution_events.company_id
              and c.user_id = auth.uid()
        )
        and exists (
            select 1 from public.decisions d
            where d.id = decision_execution_events.decision_id
              and d.company_id = decision_execution_events.company_id
        )
    );

-- Nenhuma policy de update/delete: um evento de execucao persistido
-- nunca e alterado nem removido — o progresso avanca sempre por um
-- NOVO evento, nunca por edicao in-place de um evento anterior.

-- =========================================================
-- DECISION_OUTCOMES
-- Uma linha por Outcome real observado apos uma Decision
-- (efos/domain/entities/Outcome.ts, D-011, ativado pela primeira vez
-- por esta missao). "status" reaproveita OutcomeStatus (D-011,
-- inalterado: pending/positive/negative/neutral/inconclusive) — nao e
-- um novo enum. "recorded_by" e o humano que registrou o outcome —
-- nunca a IA (nenhum codigo em efos/infrastructure/executive-ai/
-- referencia esta tabela). "expected_result" e opcional, denormaliza
-- o que se esperava no momento da decisao apenas para comparacao lado
-- a lado com "description" (o que de fato foi observado) — os dois
-- nunca sao confundidos. Multiplos outcomes por decision sao
-- permitidos (uma decisao pode ser reavaliada ao longo do tempo); o
-- mais recente por observed_at/created_at e o autoritativo para
-- "avaliacao atual". Imutavel apos inserido: nenhuma policy de
-- update/delete.
-- =========================================================

create type public.outcome_status as enum (
    'pending',
    'positive',
    'negative',
    'neutral',
    'inconclusive'
);

create table public.decision_outcomes (

    id uuid primary key default gen_random_uuid(),

    decision_id uuid not null references public.decisions (id),

    company_id uuid not null references public.companies (id),

    recorded_by uuid not null references auth.users (id),

    status public.outcome_status not null,

    observed_at timestamptz not null,

    description text not null,

    expected_result text,

    created_at timestamptz not null default now()

);

comment on table public.decision_outcomes is 'Outcome persistidos (D-011, efos/domain/entities/Outcome.ts) — primeira ativacao real, Mission 138. Registro imutavel — nunca atualizado apos inserido. recorded_by nunca aceito do client — sempre resolvido server-side via auth.uid(). Nunca criado pela IA.';

create index decision_outcomes_decision_id_idx on public.decision_outcomes (decision_id);
create index decision_outcomes_company_id_idx on public.decision_outcomes (company_id);

alter table public.decision_outcomes enable row level security;

create policy "decision_outcomes_select_own"
    on public.decision_outcomes
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = decision_outcomes.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "decision_outcomes_insert_own"
    on public.decision_outcomes
    for insert
    with check (
        recorded_by = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = decision_outcomes.company_id
              and c.user_id = auth.uid()
        )
        and exists (
            select 1 from public.decisions d
            where d.id = decision_outcomes.decision_id
              and d.company_id = decision_outcomes.company_id
        )
    );

-- Nenhuma policy de update/delete: um Outcome persistido nunca e
-- alterado nem removido, mesma regra de toda tabela deste projeto.
