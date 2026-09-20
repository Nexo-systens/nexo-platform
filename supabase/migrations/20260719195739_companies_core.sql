-- =========================================================
-- NEXO PLATFORM
-- Migration 003
-- Companies core (razao_social, cnpj, user_id, RLS, soft delete)
-- Ref: docs/03_DATABASE.md
-- =========================================================

-- =========================================================
-- LIMPEZA
-- Remove dados de teste inseridos manualmente (fora de qualquer migration
-- versionada) e colunas experimentais que nao fazem parte do escopo desta
-- missao (state, city, website, responsible), confirmado com o usuario
-- antes desta migration ser criada.
-- =========================================================

delete from public.companies;

alter table public.companies
    drop column if exists state,
    drop column if exists city,
    drop column if exists website,
    drop column if exists responsible,
    drop column if exists regime,
    drop column if exists segment,
    drop column if exists size,
    drop column if exists founded_at,
    drop column if exists cnae,
    drop column if exists email,
    drop column if exists phone;

-- =========================================================
-- ENUMS
-- =========================================================

create type public.company_status as enum ('active', 'archived');

create type public.company_tax_regime as enum (
    'mei',
    'simples_nacional',
    'lucro_presumido',
    'lucro_real'
);

create type public.company_size as enum (
    'mei',
    'micro',
    'pequena',
    'media',
    'grande'
);

-- =========================================================
-- COMPANIES: alinhar ao escopo da Missao 4
-- =========================================================

alter table public.companies
    rename column legal_name to razao_social;

alter table public.companies
    rename column trade_name to nome_fantasia;

alter table public.companies
    rename column document to cnpj;

alter table public.companies
    add column user_id uuid not null references auth.users (id),
    add column regime_tributario public.company_tax_regime,
    add column cnae text,
    add column segmento text,
    add column porte public.company_size,
    add column data_abertura date,
    add column observacoes text,
    add column deleted_at timestamptz;

-- status ja existia como text; migrar para o enum fechado.
alter table public.companies
    alter column status drop default;

alter table public.companies
    alter column status type public.company_status
    using status::public.company_status;

alter table public.companies
    alter column status set default 'active';

comment on table public.companies is 'Empresas cadastradas na plataforma NEXO. Entidade central do sistema (docs/03_DATABASE.md).';

-- =========================================================
-- INDICES
-- =========================================================

create index companies_user_id_idx on public.companies (user_id);

create index companies_active_idx on public.companies (user_id, status)
    where deleted_at is null;

-- =========================================================
-- RLS
-- =========================================================

alter table public.companies enable row level security;

create policy "companies_select_own"
    on public.companies
    for select
    using (auth.uid() = user_id);

create policy "companies_insert_own"
    on public.companies
    for insert
    with check (auth.uid() = user_id);

create policy "companies_update_own"
    on public.companies
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Nenhuma policy de delete: exclusao fisica nunca e permitida, mesmo diante
-- de um bug de aplicacao (docs/03_DATABASE.md, Regra Imutavel #4). Toda
-- "exclusao" feita pela interface e, na pratica, um update em deleted_at.

-- =========================================================
-- updated_at automatico (reaproveita a function criada na migration
-- 20260719185615_users_profile.sql)
-- =========================================================

create trigger set_companies_updated_at
    before update on public.companies
    for each row
    execute function public.handle_updated_at();
