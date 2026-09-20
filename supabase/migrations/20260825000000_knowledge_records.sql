-- =========================================================
-- NEXO PLATFORM
-- Migration 011
-- Knowledge Formation & Cross-Decision Learning
-- (Knowledge — Mission 141, D-073)
-- =========================================================

-- =========================================================
-- KNOWLEDGE_RECORDS
-- Uma linha por Knowledge formado a partir de multiplos
-- LearningRecords reais, recorrentes, de Decisions independentes
-- (efos/domain/entities/Knowledge.ts, D-011/D-013, ativado pela
-- primeira vez para este proposito por esta missao).
-- "id" e SEMPRE derivado deterministicamente (deriveKnowledgeId(),
-- efos/application/knowledge-formation/) a partir do conteudo —
-- nunca gen_random_uuid() — garantindo idempotencia: reexecutar a
-- formacao com o mesmo conjunto de LearningRecords produz o mesmo id,
-- uma colisao de insert e tratada como "ja existe", nunca como uma
-- duplicata silenciosa.
-- "category" e um vocabulario fechado (KnowledgeCategory, D-073) que
-- nunca afirma causalidade — apenas descreve a NATUREZA da
-- recorrencia observada.
-- "derived_from_learning_record_ids" nunca pode ter menos de 2
-- elementos: nenhum Knowledge single-record e persistido (mesma regra
-- estrutural de MINIMUM_DISTINCT_DECISIONS_FOR_KNOWLEDGE = 2,
-- reforcada aqui como defesa em profundidade).
-- "formed_by" e sempre um humano (nunca a IA) que acionou o calculo
-- deterministico; nunca aceito do client, sempre resolvido
-- server-side via auth.uid().
-- "record" armazena o Knowledge completo como jsonb, sem
-- normalizacao — mesmo padrao de learning_records.record/
-- financial_observations.metrics (D-070/D-071/D-072).
-- Imutavel apos inserido: nenhuma policy de update/delete.
-- =========================================================

create type public.knowledge_category as enum (
    'historical_pattern',
    'recurring_observation',
    'accumulated_learning'
);

create table public.knowledge_records (

    id uuid primary key,

    company_id uuid not null references public.companies (id),

    formed_by uuid not null references auth.users (id),

    category public.knowledge_category not null,

    derived_from_learning_record_ids uuid[] not null
        constraint knowledge_records_min_learning_records
        check (array_length(derived_from_learning_record_ids, 1) >= 2),

    derived_from_outcome_ids uuid[] not null default '{}',

    record jsonb not null,

    formed_at timestamptz not null default now(),

    created_at timestamptz not null default now()

);

comment on table public.knowledge_records is 'Knowledge formado a partir de multiplos LearningRecords reais e recorrentes (D-073, efos/application/knowledge-formation/). Registro imutavel — nunca atualizado apos inserido. category nunca afirma causalidade. id sempre deterministico (idempotente). formed_by sempre um humano, nunca a IA.';

create index knowledge_records_company_id_idx on public.knowledge_records (company_id);

alter table public.knowledge_records enable row level security;

create policy "knowledge_records_select_own"
    on public.knowledge_records
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = knowledge_records.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "knowledge_records_insert_own"
    on public.knowledge_records
    for insert
    with check (
        formed_by = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = knowledge_records.company_id
              and c.user_id = auth.uid()
        )
    );

-- Nenhuma policy de update/delete: um Knowledge persistido nunca e
-- alterado nem removido, mesma regra de toda tabela deste projeto.
