-- =========================================================
-- NEXO PLATFORM
-- Migration 001
-- Initial Schema
-- =========================================================

create extension if not exists "pgcrypto";

create extension if not exists "uuid-ossp";

-- =========================================================
-- COMPANIES
-- =========================================================

create table public.companies (

    id uuid primary key default gen_random_uuid(),

    legal_name text not null,

    trade_name text,

    document text not null unique,

    email text,

    phone text,

    status text not null default 'active',

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);

comment on table public.companies is 'Empresas cadastradas na plataforma NEXO.';