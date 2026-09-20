-- =========================================================
-- NEXO PLATFORM
-- Migration 004
-- Document Engine (Fase 1) — tabela, RLS, bucket de Storage
-- Ref: docs/03_DATABASE.md
-- =========================================================

-- =========================================================
-- ENUM
-- =========================================================

-- "categoria" e text (nao enum) de proposito: novas categorias de
-- documento nao podem exigir migration (validadas em
-- modules/documents/constants.ts). "status" e um conjunto tecnico fechado
-- (processamento futuro por IA), por isso continua enum, no mesmo espirito
-- de company_status.
create type public.document_status as enum (
    'uploaded',
    'processing',
    'processed',
    'failed'
);

-- =========================================================
-- DOCUMENTS
-- =========================================================

create table public.documents (

    id uuid primary key default gen_random_uuid(),

    company_id uuid not null references public.companies (id),

    nome_original text not null,

    nome_armazenado text not null,

    categoria text not null,

    tipo_arquivo text not null,

    tamanho_bytes bigint not null,

    status public.document_status not null default 'uploaded',

    versao integer not null default 1,

    storage_path text not null unique,

    hash_arquivo text not null,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    deleted_at timestamptz

);

comment on table public.documents is 'Documentos financeiros enviados por empresa (docs/03_DATABASE.md). Base para IA Financeira, Diagnosticos e Relatorios.';

-- =========================================================
-- INDICES
-- =========================================================

create index documents_company_id_idx on public.documents (company_id);

create index documents_active_idx on public.documents (company_id)
    where deleted_at is null;

-- =========================================================
-- RLS
-- Documents nao tem user_id direto: pertence a uma empresa, que pertence
-- a um usuario. Isolamento verificado via subquery em companies.
-- =========================================================

alter table public.documents enable row level security;

create policy "documents_select_own"
    on public.documents
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = documents.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "documents_insert_own"
    on public.documents
    for insert
    with check (
        exists (
            select 1 from public.companies c
            where c.id = documents.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "documents_update_own"
    on public.documents
    for update
    using (
        exists (
            select 1 from public.companies c
            where c.id = documents.company_id
              and c.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.companies c
            where c.id = documents.company_id
              and c.user_id = auth.uid()
        )
    );

-- Nenhuma policy de delete: exclusao fisica nunca e permitida, mesmo
-- diante de bug de aplicacao (docs/03_DATABASE.md, Regra Imutavel #4).
-- "Excluir" na interface e sempre um update em deleted_at.

create trigger set_documents_updated_at
    before update on public.documents
    for each row
    execute function public.handle_updated_at();

-- =========================================================
-- STORAGE
-- Bucket privado. Caminho: company/{companyId}/{documentId}/{arquivo}.
-- (storage.foldername(name)) e 1-indexado: [1]='company', [2]=companyId,
-- [3]=documentId.
-- =========================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_storage_select_own"
    on storage.objects
    for select
    using (
        bucket_id = 'documents'
        and exists (
            select 1 from public.companies c
            where c.id::text = (storage.foldername(name))[2]
              and c.user_id = auth.uid()
        )
    );

create policy "documents_storage_insert_own"
    on storage.objects
    for insert
    with check (
        bucket_id = 'documents'
        and exists (
            select 1 from public.companies c
            where c.id::text = (storage.foldername(name))[2]
              and c.user_id = auth.uid()
        )
    );

-- Sem policy de update/delete em storage.objects: nesta fase o arquivo
-- fisico nunca e sobrescrito nem removido (soft delete e so a linha em
-- public.documents).
