-- =========================================================
-- NEXO PLATFORM
-- Migration 012
-- Knowledge-Driven Continuous Improvement
-- (KnowledgeEvaluation — Mission 145, D-077)
-- =========================================================

-- =========================================================
-- KNOWLEDGE_EVALUATIONS
-- Uma linha por avaliação real de um Knowledge (public.knowledge_records)
-- contra LearningRecords observados (efos/application/knowledge-evaluation/,
-- ativado pela primeira vez para este proposito por esta missao).
-- Cada avaliacao e um EVENTO IMUTAVEL, nunca deduplicado por
-- conteudo (diferente de knowledge_records, cujo id e determinístico)
-- — mesmo padrao de financial_observations (D-071, Opcao B: persistir
-- imutavel a cada calculo, nunca recalcular silenciosamente): reavaliar
-- o mesmo Knowledge mais tarde, mesmo com os mesmos LearningRecords,
-- e uma observacao legitima e distinta no tempo, nunca uma duplicata
-- a ser descartada.
-- "outcome" e um vocabulario fechado (KnowledgeEvaluationOutcome,
-- D-077) que nunca afirma causalidade — REINFORCED/CONTRADICTED/MIXED/
-- INSUFFICIENT_EVIDENCE, sempre evidencial.
-- "supporting_learning_record_ids"/"contradicting_learning_record_ids"/
-- "insufficient_learning_record_ids" garantem rastreabilidade completa
-- ate LearningRecords reais — nenhuma avaliacao sem lineage.
-- "evaluated_by" e sempre um humano (nunca a IA) que acionou o calculo
-- deterministico; nunca aceito do client, sempre resolvido server-side
-- via auth.uid().
-- "record" armazena o KnowledgeEvaluationResult completo como jsonb,
-- sem normalizacao — mesmo padrao de knowledge_records.record/
-- learning_records.record (D-070/D-071/D-072/D-073).
-- Imutavel apos inserido: nenhuma policy de update/delete — o
-- historico de avaliacoes de um Knowledge nunca e reescrito
-- (Etapa 7 da missao: "Knowledge original + Evaluation historica",
-- avaliacoes anteriores permanecem preservadas).
-- =========================================================

create type public.knowledge_evaluation_outcome as enum (
    'REINFORCED',
    'CONTRADICTED',
    'MIXED',
    'INSUFFICIENT_EVIDENCE'
);

create table public.knowledge_evaluations (

    id uuid primary key default gen_random_uuid(),

    company_id uuid not null references public.companies (id),

    knowledge_id uuid not null references public.knowledge_records (id),

    evaluated_by uuid not null references auth.users (id),

    outcome public.knowledge_evaluation_outcome not null,

    supporting_learning_record_ids uuid[] not null default '{}',

    contradicting_learning_record_ids uuid[] not null default '{}',

    insufficient_learning_record_ids uuid[] not null default '{}',

    record jsonb not null,

    as_of timestamptz,

    evaluated_at timestamptz not null default now(),

    created_at timestamptz not null default now()

);

comment on table public.knowledge_evaluations is 'Avaliacoes reais de Knowledge (D-073) contra LearningRecords observados (D-077, efos/application/knowledge-evaluation/). Registro imutavel — nunca atualizado apos inserido, cada avaliacao e um evento historico distinto, nunca deduplicado. outcome nunca afirma causalidade. evaluated_by sempre um humano, nunca a IA.';

create index knowledge_evaluations_knowledge_id_idx on public.knowledge_evaluations (knowledge_id);
create index knowledge_evaluations_company_id_idx on public.knowledge_evaluations (company_id);

alter table public.knowledge_evaluations enable row level security;

create policy "knowledge_evaluations_select_own"
    on public.knowledge_evaluations
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = knowledge_evaluations.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "knowledge_evaluations_insert_own"
    on public.knowledge_evaluations
    for insert
    with check (
        evaluated_by = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = knowledge_evaluations.company_id
              and c.user_id = auth.uid()
        )
        and exists (
            select 1 from public.knowledge_records k
            where k.id = knowledge_evaluations.knowledge_id
              and k.company_id = knowledge_evaluations.company_id
        )
    );

-- Nenhuma policy de update/delete: uma avaliacao persistida nunca e
-- alterada nem removida, mesma regra de toda tabela deste projeto.
