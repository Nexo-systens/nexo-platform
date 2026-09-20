-- =========================================================
-- NEXO PLATFORM
-- Migration 010
-- EFOS Continuous Financial Intelligence & Learning Loop
-- (LearningRecord — Mission 140, D-072)
-- =========================================================

-- =========================================================
-- LEARNING_RECORDS
-- Uma linha por LearningRecord derivado de uma Decision real
-- (efos/domain/entities/LearningRecord.ts, D-013, ativado pela
-- primeira vez para este proposito por esta missao). Distinto dos
-- LearningRecords produzidos pelo LearningEngine deterministico
-- (esses continuam embutidos em public.executions.execution.learning,
-- escopados a uma unica execucao do pipeline, nunca nesta tabela).
-- "evidence_classification" e um vocabulario fechado
-- (LearningEvidenceClassification, D-072) que nunca afirma
-- causalidade — apenas classifica a forca/direcao da evidencia
-- disponivel, sempre derivada do julgamento humano ja existente
-- (Outcome.status). "derived_by" e sempre um humano (nunca a IA) que
-- acionou o calculo deterministico; nunca aceito do client, sempre
-- resolvido server-side via auth.uid(). "record" armazena o
-- LearningRecord completo como jsonb, sem normalizacao — mesmo padrao
-- de executive_diagnoses.diagnosis/decisions.decision/
-- financial_observations.metrics (D-059/D-066/D-070/D-071).
-- Imutavel apos inserido: nenhuma policy de update/delete — um
-- aprendizado persistido nunca e alterado silenciosamente.
-- =========================================================

create type public.learning_evidence_classification as enum (
    'TEMPORAL_ASSOCIATION',
    'EVIDENCE_FAVORABLE',
    'EVIDENCE_CONTRARY',
    'INCONCLUSIVE'
);

create table public.learning_records (

    id uuid primary key default gen_random_uuid(),

    company_id uuid not null references public.companies (id),

    primary_decision_id uuid not null references public.decisions (id),

    derived_by uuid not null references auth.users (id),

    evidence_classification public.learning_evidence_classification not null,

    record jsonb not null,

    derived_at timestamptz not null default now(),

    created_at timestamptz not null default now()

);

comment on table public.learning_records is 'LearningRecord derivados de Decision+Outcome+FinancialOutcomeObservation reais (D-072, efos/application/learning-derivation/). Registro imutavel — nunca atualizado apos inserido. evidence_classification nunca afirma causalidade. derived_by sempre um humano, nunca a IA.';

create index learning_records_primary_decision_id_idx on public.learning_records (primary_decision_id);
create index learning_records_company_id_idx on public.learning_records (company_id);

alter table public.learning_records enable row level security;

create policy "learning_records_select_own"
    on public.learning_records
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = learning_records.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "learning_records_insert_own"
    on public.learning_records
    for insert
    with check (
        derived_by = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = learning_records.company_id
              and c.user_id = auth.uid()
        )
        and exists (
            select 1 from public.decisions d
            where d.id = learning_records.primary_decision_id
              and d.company_id = learning_records.company_id
        )
    );

-- Nenhuma policy de update/delete: um LearningRecord persistido nunca
-- e alterado nem removido, mesma regra de toda tabela deste projeto.
