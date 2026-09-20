-- =========================================================
-- NEXO PLATFORM
-- Migration 002
-- Users profile (extends Supabase Auth identity)
-- Ref: docs/03_DATABASE.md secao 3.1 e 6 (RLS obrigatorio)
-- =========================================================

-- =========================================================
-- USERS
-- =========================================================

create table public.users (

    id uuid primary key references auth.users (id) on delete cascade,

    full_name text,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);

comment on table public.users is 'Perfil de negocio do usuario autenticado, estendendo a identidade do Supabase Auth.';

-- =========================================================
-- RLS
-- =========================================================

alter table public.users enable row level security;

create policy "users_select_own"
    on public.users
    for select
    using (auth.uid() = id);

create policy "users_update_own"
    on public.users
    for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Nenhuma policy de insert/delete: a linha e criada exclusivamente pelo
-- trigger handle_new_user (security definer) e nunca diretamente pelo
-- usuario final.

-- =========================================================
-- SYNC COM auth.users
-- =========================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.users (id, full_name)
    values (new.id, new.raw_user_meta_data ->> 'full_name');

    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

create function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_users_updated_at
    before update on public.users
    for each row
    execute function public.handle_updated_at();
