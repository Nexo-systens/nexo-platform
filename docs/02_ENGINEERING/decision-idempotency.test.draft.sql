-- =========================================================
-- RASCUNHO — Mission 213 (D-137, PROPOSTA — NÃO ATIVADA)
--
-- Teste pgTAP da migration PROPOSTA em
-- `docs/02_ENGINEERING/decision-idempotency.proposed.sql`.
-- Não está em `supabase/tests/database/` de propósito: sem a migration
-- aplicada ele falharia. A Mission 214 o move para lá junto com a
-- migration.
--
-- Na Mission 213 ele rodou num Postgres DESCARTÁVEL (container próprio,
-- mesma imagem do Supabase local, schema `public` copiado do banco
-- local + a migration proposta) — nunca no banco do projeto, nunca no
-- NEXO Pilot.
--
-- Mesmo padrão de `supabase/tests/database/company_offboarding.test.sql`:
-- transação com ROLLBACK, dados sintéticos, `authenticated` e
-- `auth.uid()` simulados como o PostgREST faz, resultados gravados numa
-- tabela temporária e conferidos como `postgres`.
--
-- Concorrência não cabe numa sessão só: a prova de 10 pedidos
-- simultâneos está descrita no desenho (seção "Prova local").
-- =========================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

-- ---------------------------------------------------------
-- Fixtures (como postgres)
-- ---------------------------------------------------------

insert into auth.users (id, email, aud, role, instance_id) values
    ('00000000-0000-4000-8000-0000000000a1', 'owner-a@m213.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    ('00000000-0000-4000-8000-0000000000b1', 'owner-b@m213.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

-- A1 e A2 são do dono A (A2 será encerrada); B1 é do dono B.
insert into public.companies (id, user_id, razao_social, cnpj) values
    ('a1a1a1a1-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000000a1', 'SMOKE M213 A1', '11222333000181'),
    ('a2a2a2a2-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000000a1', 'SMOKE M213 A2', '99888777000161'),
    ('b1b1b1b1-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000000b1', 'SMOKE M213 B1', '11222333000181');

-- Histórico sem chave: duas Decisions iguais de A1, como as que existem hoje.
insert into public.decisions (company_id, human_actor_id, decision) values
    ('a1a1a1a1-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000000a1', '{"title":"legado"}'),
    ('a1a1a1a1-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000000a1', '{"title":"legado"}');

create temp table t_results (k text primary key, v jsonb);
grant all on t_results to authenticated, anon;

-- ---------------------------------------------------------
-- 1. Schema (como postgres)
-- ---------------------------------------------------------

select has_column('public', 'decisions', 'idempotency_key', 'coluna idempotency_key existe');
select col_type_is('public', 'decisions', 'idempotency_key', 'uuid', 'idempotency_key é uuid');
select col_is_null('public', 'decisions', 'idempotency_key', 'idempotency_key é nullable (histórico sem chave)');
select has_column('public', 'decisions', 'request_fingerprint', 'coluna request_fingerprint existe');
select col_type_is('public', 'decisions', 'request_fingerprint', 'text', 'request_fingerprint é text');
select col_is_null('public', 'decisions', 'request_fingerprint', 'request_fingerprint é nullable');
select is(
    (select i.indisunique from pg_index i where i.indexrelid = 'public.decisions_idempotency_key_unique'::regclass),
    true,
    'decisions_idempotency_key_unique é único'
);
select matches(
    pg_get_indexdef('public.decisions_idempotency_key_unique'::regclass),
    '\(company_id, human_actor_id, idempotency_key\) WHERE \(idempotency_key IS NOT NULL\)$',
    'escopo empresa + ator + chave, parcial (histórico fora do índice)'
);
select is(
    (select count(*) from public.decisions where company_id = 'a1a1a1a1-0000-4000-8000-000000000213' and idempotency_key is null),
    2::bigint,
    'histórico: Decisions sem chave continuam válidas e coexistem'
);
select is(
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'decisions'),
    2::bigint,
    'RLS inalterada: só decisions_select_own e decisions_insert_own'
);

-- ---------------------------------------------------------
-- 2. Dono B grava primeiro com a chave K1
-- ---------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

do $$
begin
    insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint)
        values ('b1b1b1b1-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000000b1', '{}',
                'c0ffee00-0000-4000-8000-0000000000c1', repeat('b', 64));
    insert into t_results values ('b_first', '"allowed"');
exception when others then
    insert into t_results values ('b_first', to_jsonb(sqlstate));
end;
$$;

-- ---------------------------------------------------------
-- 3. Dono A
-- ---------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

do $$
declare
    v_a1 uuid := 'a1a1a1a1-0000-4000-8000-000000000213';
    v_a2 uuid := 'a2a2a2a2-0000-4000-8000-000000000213';
    v_b1 uuid := 'b1b1b1b1-0000-4000-8000-000000000213';
    v_a uuid := '00000000-0000-4000-8000-0000000000a1';
    v_b uuid := '00000000-0000-4000-8000-0000000000b1';
    v_k1 uuid := 'c0ffee00-0000-4000-8000-0000000000c1';
    v_f1 text := repeat('a', 64);
    v_f2 text := repeat('f', 64);
    v_cases text[][] := array[
        -- mesma chave K1 que B usou, em outra empresa: namespaces independentes
        array['a_first',                 format($s$insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint) values (%L, %L, '{}', %L, %L)$s$, v_a1, v_a, v_k1, v_f1)],
        array['a_same_key_same_payload', format($s$insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint) values (%L, %L, '{}', %L, %L)$s$, v_a1, v_a, v_k1, v_f1)],
        array['a_same_key_other_payload',format($s$insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint) values (%L, %L, '{}', %L, %L)$s$, v_a1, v_a, v_k1, v_f2)],
        array['a_other_key_same_payload',format($s$insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint) values (%L, %L, '{}', gen_random_uuid(), %L)$s$, v_a1, v_a, v_f1)],
        array['a_same_key_other_company',format($s$insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint) values (%L, %L, '{}', %L, %L)$s$, v_a2, v_a, v_k1, v_f1)],
        array['a_key_without_fingerprint',format($s$insert into public.decisions (company_id, human_actor_id, decision, idempotency_key) values (%L, %L, '{}', gen_random_uuid())$s$, v_a1, v_a)],
        array['a_fingerprint_without_key',format($s$insert into public.decisions (company_id, human_actor_id, decision, request_fingerprint) values (%L, %L, '{}', %L)$s$, v_a1, v_a, v_f1)],
        array['a_malformed_fingerprint', format($s$insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint) values (%L, %L, '{}', gen_random_uuid(), 'abc')$s$, v_a1, v_a)],
        array['a_key_without_actor',     format($s$insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint) values (%L, null, '{}', gen_random_uuid(), %L)$s$, v_a1, v_f1)],
        array['a_forged_actor',          format($s$insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint) values (%L, %L, '{}', gen_random_uuid(), %L)$s$, v_a1, v_b, v_f1)],
        -- linha que COLIDIRIA exatamente com a de B: a policy de INSERT recusa antes do índice (nenhum oráculo 23505)
        array['a_collide_into_b',        format($s$insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint) values (%L, %L, '{}', %L, %L)$s$, v_b1, v_b, v_k1, repeat('b', 64))]
    ];
    v_i int;
    v_rows int;
begin
    for v_i in 1 .. array_length(v_cases, 1) loop
        begin
            execute v_cases[v_i][2];
            insert into t_results values (v_cases[v_i][1], '"allowed"');
        exception when others then
            insert into t_results values (v_cases[v_i][1], to_jsonb(sqlstate));
        end;
    end loop;

    -- Chave e impressão são imutáveis: não há policy de UPDATE.
    update public.decisions set idempotency_key = gen_random_uuid() where company_id = v_a1 and idempotency_key = v_k1;
    get diagnostics v_rows = row_count;
    insert into t_results values ('a_update_key_rows', to_jsonb(v_rows));

    -- Busca da própria chave enxerga a própria Decision; a de B, nunca.
    insert into t_results values ('a_lookup_own', to_jsonb((select count(*) from public.decisions where company_id = v_a1 and human_actor_id = v_a and idempotency_key = v_k1)));
    insert into t_results values ('a_lookup_any_k1', to_jsonb((select count(*) from public.decisions where idempotency_key = v_k1)));
    insert into t_results values ('a_lookup_b_company', to_jsonb((select count(*) from public.decisions where company_id = v_b1)));

    -- Empresa encerrada não recebe nova Decision, nem com chave nova.
    update public.companies set deleted_at = now() where id = v_a2;
    begin
        insert into public.decisions (company_id, human_actor_id, decision, idempotency_key, request_fingerprint)
            values (v_a2, v_a, '{}', gen_random_uuid(), v_f1);
        insert into t_results values ('a_closed_company', '"allowed"');
    exception when others then
        insert into t_results values ('a_closed_company', to_jsonb(sqlstate));
    end;
end;
$$;

reset role;

-- ---------------------------------------------------------
-- 4. Conferência (como postgres)
-- ---------------------------------------------------------

select is((select v from t_results where k = 'b_first'), '"allowed"'::jsonb, 'B grava com K1');
select is((select v from t_results where k = 'a_first'), '"allowed"'::jsonb, 'A grava com a MESMA K1 em outra empresa: a chave nunca atravessa empresa');
select is((select v from t_results where k = 'a_same_key_same_payload'), '"23505"'::jsonb, 'mesma chave + mesmo pedido: o índice recusa a 2ª linha (o app relê e devolve a 1ª)');
select is((select v from t_results where k = 'a_same_key_other_payload'), '"23505"'::jsonb, 'mesma chave + outro pedido: também recusada (o app compara a impressão e recusa)');
select is((select v from t_results where k = 'a_other_key_same_payload'), '"allowed"'::jsonb, 'outra chave + mesmo pedido: nova decisão legítima');
select is((select v from t_results where k = 'a_same_key_other_company'), '"allowed"'::jsonb, 'mesma chave do mesmo dono em outra empresa: independente');
select is((select v from t_results where k = 'a_key_without_fingerprint'), '"23514"'::jsonb, 'chave sem impressão: recusada');
select is((select v from t_results where k = 'a_fingerprint_without_key'), '"23514"'::jsonb, 'impressão sem chave: recusada');
select is((select v from t_results where k = 'a_malformed_fingerprint'), '"23514"'::jsonb, 'impressão fora do formato: recusada');
select is((select v from t_results where k = 'a_key_without_actor'), '"23514"'::jsonb, 'chave só em Decision humana (ator nulo recusado)');
select is((select v from t_results where k = 'a_forged_actor'), '"42501"'::jsonb, 'ator forjado: RLS recusa');
select is((select v from t_results where k = 'a_collide_into_b'), '"42501"'::jsonb, 'colisão exata com a linha de B: RLS recusa antes do índice — sem oráculo entre tenants');
select is((select v from t_results where k = 'a_update_key_rows'), '0'::jsonb, 'chave imutável: UPDATE não alcança nenhuma linha');
select is((select v from t_results where k = 'a_lookup_own'), '1'::jsonb, 'busca pela própria chave encontra exatamente a própria Decision');
select is((select v from t_results where k = 'a_lookup_any_k1'), '2'::jsonb, 'busca por K1 sem filtro de empresa só enxerga as 2 linhas de A (nunca a de B)');
select is((select v from t_results where k = 'a_lookup_b_company'), '0'::jsonb, 'A não enxerga nenhuma Decision de B');
select is((select v from t_results where k = 'a_closed_company'), '"42501"'::jsonb, 'empresa encerrada: nenhuma Decision nova');
select is(
    (select count(*) from public.decisions where idempotency_key = 'c0ffee00-0000-4000-8000-0000000000c1'),
    3::bigint,
    'K1 existe 3 vezes, uma por (empresa, ator): A1, A2 e B1'
);
select is(
    (select count(*) from public.decisions where company_id = 'a1a1a1a1-0000-4000-8000-000000000213' and idempotency_key = 'c0ffee00-0000-4000-8000-0000000000c1'),
    1::bigint,
    'em A1, K1 gravou exatamente 1 Decision'
);
select is(
    (select count(*) from public.decisions where company_id = 'a1a1a1a1-0000-4000-8000-000000000213'),
    4::bigint,
    'A1: 2 do histórico + 1 com K1 + 1 com outra chave'
);

select * from finish();

rollback;
