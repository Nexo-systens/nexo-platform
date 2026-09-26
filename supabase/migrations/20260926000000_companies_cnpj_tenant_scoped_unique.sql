-- =========================================================
-- NEXO PLATFORM
-- Migration 016
-- companies.cnpj — unicidade escopada ao tenant (Mission 199B Security
-- Closure — CNPJ Cross-Tenant Enumeration, D-126)
-- =========================================================

-- =========================================================
-- CONTEXTO
--
-- Migration 001 (`20260715151336_initial_schema.sql`) criou
-- `document text not null unique` em `public.companies`; a Migration 003
-- (`20260719195739_companies_core.sql`) renomeou a coluna para `cnpj` e
-- adicionou `user_id` (único elo de propriedade — D-066), mas a
-- unicidade continuou GLOBAL (constraint `companies_document_key`,
-- nome herdado da coluna original).
--
-- A matriz adversarial da Mission 199B mostrou que isso é um side
-- channel cross-tenant: a checagem de índice único do Postgres
-- enxerga todas as linhas, independentemente de RLS. Um usuário que
-- cadastra (ou edita) a PRÓPRIA empresa com o CNPJ de uma empresa de
-- outro tenant passa pelo WITH CHECK de `companies_insert_own`/
-- `companies_update_own` (a linha é dele) e falha só no índice único
-- (SQLSTATE 23505) — revelando que aquele CNPJ, dado público de baixa
-- entropia, já existe na NEXO em outro tenant.
--
-- Decisão (D-126): o CNPJ é um atributo tenant-scoped do registro da
-- empresa dentro da NEXO, nunca uma identidade global. A unicidade
-- passa a ser `(user_id, cnpj)`: o mesmo dono nunca tem duas empresas
-- com o mesmo CNPJ; donos diferentes nunca descobrem um ao outro.
-- =========================================================

-- =========================================================
-- 1. REMOVER A UNICIDADE GLOBAL DE cnpj
--
-- Localizada pelo catálogo, nunca por nome fixo: no projeto histórico
-- o schema de `companies` já divergiu por edição manual (ver
-- docs/HANDOFF.md, Riscos), então o nome da constraint/índice não é
-- garantido. Remove toda constraint UNIQUE e todo índice UNIQUE avulso
-- cuja chave é EXATAMENTE a coluna `cnpj` sozinha — nunca uma chave
-- composta, nunca a PK. Em banco vazio (cadeia 001-015) remove
-- exatamente `companies_document_key`.
--
-- Relaxar uma constraint nunca apaga nem altera dado; nenhuma FK
-- referencia `companies(cnpj)`.
-- =========================================================

do $$
declare
    cnpj_attnum smallint;
    target record;
begin
    select a.attnum into cnpj_attnum
    from pg_attribute a
    where a.attrelid = 'public.companies'::regclass
      and a.attname = 'cnpj'
      and not a.attisdropped;

    for target in
        select con.conname
        from pg_constraint con
        where con.conrelid = 'public.companies'::regclass
          and con.contype = 'u'
          and con.conkey = array[cnpj_attnum]
    loop
        execute format('alter table public.companies drop constraint %I', target.conname);
    end loop;

    for target in
        select idx.relname
        from pg_index i
        join pg_class idx on idx.oid = i.indexrelid
        where i.indrelid = 'public.companies'::regclass
          and i.indisunique
          and not i.indisprimary
          and i.indnatts = 1
          and i.indkey[0] = cnpj_attnum
          and not exists (
              select 1 from pg_constraint con where con.conindid = i.indexrelid
          )
    loop
        execute format('drop index public.%I', target.relname);
    end loop;
end $$;

-- =========================================================
-- 2. UNICIDADE ESCOPADA AO DONO
--
-- Toda linha que satisfazia a unicidade global satisfaz esta — a
-- criação nunca falha sobre dado existente. `user_id` é NOT NULL
-- (Migration 003), então nenhuma linha escapa da constraint por NULL.
-- O índice também atende buscas por CNPJ dentro do tenant.
-- =========================================================

alter table public.companies
    add constraint companies_user_id_cnpj_key unique (user_id, cnpj);

comment on constraint companies_user_id_cnpj_key on public.companies is
    'Mission 199B Security Closure (D-126). CNPJ único POR DONO (user_id, único elo de propriedade — D-066), nunca global: uma unicidade global enxerga linhas de outros tenants por cima do RLS e transforma o erro 23505 em oráculo de existência de CNPJ entre tenants.';
