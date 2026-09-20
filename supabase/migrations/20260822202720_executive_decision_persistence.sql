-- =========================================================
-- NEXO PLATFORM
-- Migration 007
-- Executive Decision Persistence (ExecutiveDiagnosis,
-- DiagnosisReview, Decision humana — Mission 126, D-063/D-064/D-065)
-- =========================================================

-- =========================================================
-- EXECUTIVE_DIAGNOSES
-- Uma linha por ExecutiveDiagnosis real (D-059,
-- efos/application/executive-diagnosis/ExecutiveDiagnosis.ts).
-- "diagnosis" armazena o objeto completo, sem normalizacao —
-- ExecutiveDiagnosis nao e um DomainEntity, nao tem provenance/audit
-- proprios; a Application Layer permanece a unica fonte de verdade da
-- sua forma interna (mesmo precedente de public.executions, D-023).
-- Imutavel apos inserido: nenhuma policy de update/delete.
-- =========================================================

create table public.executive_diagnoses (

    id uuid primary key default gen_random_uuid(),

    company_id uuid not null references public.companies (id),

    execution_id uuid,

    diagnosis jsonb not null,

    provider_name text,

    created_at timestamptz not null default now()

);

comment on table public.executive_diagnoses is 'ExecutiveDiagnosis persistidos (D-059, efos/application/executive-diagnosis/). Registro imutavel — nunca atualizado apos inserido.';

create index executive_diagnoses_company_id_idx on public.executive_diagnoses (company_id);

alter table public.executive_diagnoses enable row level security;

create policy "executive_diagnoses_select_own"
    on public.executive_diagnoses
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = executive_diagnoses.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "executive_diagnoses_insert_own"
    on public.executive_diagnoses
    for insert
    with check (
        exists (
            select 1 from public.companies c
            where c.id = executive_diagnoses.company_id
              and c.user_id = auth.uid()
        )
    );

-- Nenhuma policy de update/delete: um ExecutiveDiagnosis persistido
-- nunca e alterado nem removido (Etapa 10 da missao — "Imutavel apos
-- criacao").

-- =========================================================
-- DIAGNOSIS_REVIEWS
-- Uma linha por DiagnosisReview real (D-063,
-- efos/application/diagnosis-review/DiagnosisReview.ts). "company_id"
-- e denormalizado a partir de executive_diagnoses.company_id (mesmo
-- padrao de public.executions, D-027) — evita join de dois niveis em
-- toda policy de RLS. "status" exclui "PENDING": o proprio contrato
-- (DiagnosisReview.ts) documenta que PENDING nunca e um registro real
-- — representa a AUSENCIA de revisao, nunca uma linha persistida.
-- Multiplas revisoes por diagnostico sao permitidas (cardinalidade N)
-- — nenhuma delas e fisicamente mutada quando uma nova e criada; a
-- revisao mais recente (por created_at) e a autoritativa para
-- qualquer consumidor. Imutavel apos inserido: nenhuma policy de
-- update/delete.
-- =========================================================

create type public.diagnosis_review_status as enum (
    'ACCEPTED',
    'PARTIALLY_ACCEPTED',
    'REJECTED',
    'SUPERSEDED'
);

create table public.diagnosis_reviews (

    id uuid primary key default gen_random_uuid(),

    diagnosis_id uuid not null references public.executive_diagnoses (id),

    company_id uuid not null references public.companies (id),

    reviewer_user_id uuid not null references auth.users (id),

    status public.diagnosis_review_status not null,

    review jsonb not null,

    created_at timestamptz not null default now()

);

comment on table public.diagnosis_reviews is 'DiagnosisReview persistidos (D-063, efos/application/diagnosis-review/). Registro imutavel — nunca atualizado apos inserido. reviewer_user_id nunca aceito do client (D-065) — sempre resolvido server-side via auth.uid().';

create index diagnosis_reviews_diagnosis_id_idx on public.diagnosis_reviews (diagnosis_id);
create index diagnosis_reviews_company_id_idx on public.diagnosis_reviews (company_id);

alter table public.diagnosis_reviews enable row level security;

create policy "diagnosis_reviews_select_own"
    on public.diagnosis_reviews
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = diagnosis_reviews.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "diagnosis_reviews_insert_own"
    on public.diagnosis_reviews
    for insert
    with check (
        reviewer_user_id = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = diagnosis_reviews.company_id
              and c.user_id = auth.uid()
        )
        and exists (
            select 1 from public.executive_diagnoses d
            where d.id = diagnosis_reviews.diagnosis_id
              and d.company_id = diagnosis_reviews.company_id
        )
    );

-- Nenhuma policy de update/delete: uma revisao persistida nunca e
-- alterada nem removida — mesma imutabilidade ja documentada no
-- proprio contrato (DiagnosisReview.ts, "SUPERSEDED... nunca editado
-- in-place").

-- =========================================================
-- DECISIONS
-- Uma linha por Decision real (D-011/D-063/D-064,
-- efos/domain/entities/Decision.ts). Tabela unica, capaz de
-- representar tanto uma Decision deterministica (Decision Engine,
-- human_actor_id null) quanto uma Decision humana (D-064,
-- human_actor_id not null) — nenhuma tabela paralela foi criada,
-- por instrucao explicita da missao ("nao duplicar tabelas sem
-- necessidade"). Esta migration so e populada, na pratica, por
-- Decisions humanas (Mission 126 nao altera o Decision Engine
-- deterministico nem cria persistencia automatica para ele).
-- "diagnosis_id"/"review_id" sao nullable — uma Decision humana pode
-- existir independentemente da IA (Cenario F/K, Missions 124/125).
-- Imutavel apos inserida: nenhuma policy de update/delete — "nunca
-- permitir alteracao silenciosa de autoria" (Etapa 10).
-- =========================================================

create table public.decisions (

    id uuid primary key default gen_random_uuid(),

    company_id uuid not null references public.companies (id),

    diagnosis_id uuid references public.executive_diagnoses (id),

    review_id uuid references public.diagnosis_reviews (id),

    human_actor_id uuid references auth.users (id),

    decision jsonb not null,

    created_at timestamptz not null default now()

);

comment on table public.decisions is 'Decision persistidas (D-011/D-063/D-064). human_actor_id not null identifica uma Decision humana (D-065, sempre server-resolved); null identificaria uma Decision deterministica do Decision Engine (nao populada por esta migration). Registro imutavel — nunca atualizado apos inserido.';

create index decisions_company_id_idx on public.decisions (company_id);
create index decisions_diagnosis_id_idx on public.decisions (diagnosis_id);
create index decisions_review_id_idx on public.decisions (review_id);

alter table public.decisions enable row level security;

create policy "decisions_select_own"
    on public.decisions
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = decisions.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "decisions_insert_own"
    on public.decisions
    for insert
    with check (
        (human_actor_id is null or human_actor_id = auth.uid())
        and exists (
            select 1 from public.companies c
            where c.id = decisions.company_id
              and c.user_id = auth.uid()
        )
        and (
            decisions.diagnosis_id is null
            or exists (
                select 1 from public.executive_diagnoses d
                where d.id = decisions.diagnosis_id
                  and d.company_id = decisions.company_id
            )
        )
        and (
            decisions.review_id is null
            or exists (
                select 1 from public.diagnosis_reviews r
                where r.id = decisions.review_id
                  and r.company_id = decisions.company_id
            )
        )
    );

-- Nenhuma policy de update/delete: uma Decision persistida nunca e
-- alterada nem removida, mesma regra de public.executions/documents
-- (nenhuma excecao para "corrigir" autoria).
