-- =========================================================
-- NEXO PLATFORM
-- Migration 009
-- Outcome Measurement & Financial Feedback Correlation
-- (FinancialOutcomeObservation — Mission 139, D-071)
-- =========================================================

-- =========================================================
-- FINANCIAL_OBSERVATIONS
-- Uma linha por FinancialOutcomeObservation real
-- (efos/application/financial-observation/FinancialOutcomeObservation.ts,
-- Mission 139). "classification" e um vocabulario fechado que hoje so
-- tem "TEMPORAL_ASSOCIATION" — nunca afirma causalidade (D-071).
-- "computed_by" e sempre um humano (nunca a IA) que acionou o calculo
-- deterministico; nunca aceito do client, sempre resolvido server-side
-- via auth.uid(). "baseline_execution_id"/"observation_execution_id"
-- referenciam public.executions.execution_id (nao a PK tecnica "id")
-- — o mesmo identificador oficial ja usado em toda a Application Layer
-- (efos/application/history/, D-045). "metrics" armazena o array
-- completo de FinancialMetricObservation como jsonb, sem normalizacao
-- — mesmo padrao de executive_diagnoses.diagnosis/decisions.decision
-- (D-059/D-066/D-070): a Application Layer permanece a unica fonte de
-- verdade da forma interna. Imutavel apos inserida: nenhuma policy de
-- update/delete — uma observacao congela a Financial Truth como ela
-- era no momento do calculo (computed_at), nunca recalculada
-- silenciosamente quando novos dados financeiros chegam (Etapa 16 da
-- missao).
-- =========================================================

create table public.financial_observations (

    id uuid primary key default gen_random_uuid(),

    decision_id uuid not null references public.decisions (id),

    company_id uuid not null references public.companies (id),

    human_outcome_id uuid references public.decision_outcomes (id),

    computed_by uuid not null references auth.users (id),

    classification text not null,

    baseline_execution_id uuid not null references public.executions (execution_id),

    baseline_executed_at timestamptz not null,

    observation_execution_id uuid not null references public.executions (execution_id),

    observation_executed_at timestamptz not null,

    metrics jsonb not null,

    computed_at timestamptz not null default now(),

    created_at timestamptz not null default now(),

    constraint financial_observations_classification_check
        check (classification in ('TEMPORAL_ASSOCIATION')),

    constraint financial_observations_distinct_executions_check
        check (baseline_execution_id <> observation_execution_id)

);

comment on table public.financial_observations is 'FinancialOutcomeObservation persistidas (D-071, efos/application/financial-observation/). Registro imutavel — congela a Financial Truth comparada no momento do calculo, nunca atualizado. classification nunca afirma causalidade (Correlation != Causation). computed_by sempre um humano, nunca a IA.';

create index financial_observations_decision_id_idx on public.financial_observations (decision_id);
create index financial_observations_company_id_idx on public.financial_observations (company_id);

alter table public.financial_observations enable row level security;

create policy "financial_observations_select_own"
    on public.financial_observations
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = financial_observations.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "financial_observations_insert_own"
    on public.financial_observations
    for insert
    with check (
        computed_by = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = financial_observations.company_id
              and c.user_id = auth.uid()
        )
        and exists (
            select 1 from public.decisions d
            where d.id = financial_observations.decision_id
              and d.company_id = financial_observations.company_id
        )
    );

-- Nenhuma policy de update/delete: uma observacao financeira
-- persistida nunca e alterada nem removida, mesma regra de toda
-- tabela deste projeto — preserva a distincao entre "observacao feita
-- em T" e "Financial Truth atual" (Etapa 16 da missao).
