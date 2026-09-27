-- =========================================================
-- Mission 202 — Tenant-Safe Company Offboarding & Data Purge (D-130)
--
-- Prova em Postgres REAL (Supabase local descartável) da Migration
-- 017: encerramento monotônico, bloqueio de novos dados em empresa
-- encerrada, prévia, listagem de Storage e purga definitiva.
--
-- Como rodar (nunca contra o NEXO Pilot):
--   npx supabase start
--   npx supabase test db
--
-- Tudo roda numa transação que termina em ROLLBACK: nenhuma linha
-- sobra. Os dados são sintéticos. O papel `authenticated` e o
-- `auth.uid()` são simulados exatamente como o PostgREST faz
-- (`role` + `request.jwt.claims`). Resultados obtidos sob
-- `authenticated` são gravados numa tabela temporária e conferidos
-- depois como `postgres` (o pgTAP não roda sob `authenticated`).
-- =========================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(51);

-- ---------------------------------------------------------
-- Fixtures (como postgres: dono das tabelas, ignora RLS)
-- ---------------------------------------------------------

insert into auth.users (id, email, aud, role, instance_id) values
    ('00000000-0000-4000-8000-00000000000a', 'owner-a@m202.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    ('00000000-0000-4000-8000-00000000000b', 'owner-b@m202.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

create function pg_temp.seed_company(p_company uuid, p_owner uuid, p_cnpj text)
returns void
language plpgsql
as $$
declare
    v_diagnosis uuid;
    v_review uuid;
    v_decision uuid;
    v_outcome uuid;
    v_exec_1 uuid := gen_random_uuid();
    v_exec_2 uuid := gen_random_uuid();
    v_learning_1 uuid;
    v_learning_2 uuid;
    v_knowledge uuid := gen_random_uuid();
begin
    insert into public.companies (id, user_id, razao_social, cnpj)
        values (p_company, p_owner, 'SMOKE M202 ' || p_cnpj, p_cnpj);
    insert into public.documents (company_id, nome_original, nome_armazenado, categoria, tipo_arquivo, tamanho_bytes, storage_path, hash_arquivo)
        values (p_company, 'dre.csv', 'dre.csv', 'dre', 'text/csv', 10,
                'company/' || p_company || '/' || gen_random_uuid() || '/dre.csv', 'hash');
    insert into public.executions (execution_id, company_id, metadata, execution)
        values (v_exec_1, p_company, '{}', '{}'), (v_exec_2, p_company, '{}', '{}');
    insert into public.executive_diagnoses (company_id, execution_id, diagnosis)
        values (p_company, v_exec_2, '{}') returning id into v_diagnosis;
    insert into public.diagnosis_reviews (diagnosis_id, company_id, reviewer_user_id, status, review)
        values (v_diagnosis, p_company, p_owner, 'ACCEPTED', '{}') returning id into v_review;
    insert into public.decisions (company_id, diagnosis_id, review_id, human_actor_id, decision)
        values (p_company, v_diagnosis, v_review, p_owner, '{}') returning id into v_decision;
    insert into public.decision_execution_events (decision_id, company_id, actor_id, status)
        values (v_decision, p_company, p_owner, 'IN_PROGRESS');
    insert into public.decision_outcomes (decision_id, company_id, recorded_by, status, observed_at, description)
        values (v_decision, p_company, p_owner, 'positive', now(), 'sintético') returning id into v_outcome;
    insert into public.financial_observations (decision_id, company_id, human_outcome_id, computed_by, classification,
            baseline_execution_id, baseline_executed_at, observation_execution_id, observation_executed_at, metrics)
        values (v_decision, p_company, v_outcome, p_owner, 'TEMPORAL_ASSOCIATION', v_exec_1, now(), v_exec_2, now(), '{}');
    insert into public.learning_records (company_id, primary_decision_id, derived_by, evidence_classification, record)
        values (p_company, v_decision, p_owner, 'INCONCLUSIVE', '{}') returning id into v_learning_1;
    insert into public.learning_records (company_id, primary_decision_id, derived_by, evidence_classification, record)
        values (p_company, v_decision, p_owner, 'INCONCLUSIVE', '{}') returning id into v_learning_2;
    insert into public.knowledge_records (id, company_id, formed_by, category, derived_from_learning_record_ids, record)
        values (v_knowledge, p_company, p_owner, 'accumulated_learning', array[v_learning_1, v_learning_2], '{}');
    insert into public.knowledge_evaluations (company_id, knowledge_id, evaluated_by, outcome, record)
        values (p_company, v_knowledge, p_owner, 'MIXED', '{}');
    insert into storage.objects (bucket_id, name, owner_id)
        values ('documents', 'company/' || p_company || '/' || gen_random_uuid() || '/dre.csv', p_owner::text);
end;
$$;

-- Linhas da empresa nas 12 tabelas company-scoped (inclui a própria empresa).
create function pg_temp.company_rows(p_company uuid)
returns bigint
language sql
as $$
    select
        (select count(*) from public.companies where id = p_company)
      + (select count(*) from public.documents where company_id = p_company)
      + (select count(*) from public.executions where company_id = p_company)
      + (select count(*) from public.executive_diagnoses where company_id = p_company)
      + (select count(*) from public.diagnosis_reviews where company_id = p_company)
      + (select count(*) from public.decisions where company_id = p_company)
      + (select count(*) from public.decision_execution_events where company_id = p_company)
      + (select count(*) from public.decision_outcomes where company_id = p_company)
      + (select count(*) from public.financial_observations where company_id = p_company)
      + (select count(*) from public.learning_records where company_id = p_company)
      + (select count(*) from public.knowledge_records where company_id = p_company)
      + (select count(*) from public.knowledge_evaluations where company_id = p_company);
$$;

create function pg_temp.storage_rows(p_company uuid)
returns bigint
language sql
as $$
    select count(*) from storage.objects
    where bucket_id = 'documents' and name like 'company/' || p_company || '/%';
$$;

-- A1 (a purgar) e A2 (mesmo dono, deve sobreviver) pertencem a A; B1 pertence a B.
select pg_temp.seed_company('a1a1a1a1-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', '11222333000181');
select pg_temp.seed_company('a2a2a2a2-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', '99888777000161');
select pg_temp.seed_company('b1b1b1b1-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000b', '11222333000181');

select is(pg_temp.company_rows('a1a1a1a1-0000-4000-8000-000000000001'), 14::bigint, 'fixture: A1 com o grafo completo (14 linhas em 12 tabelas)');
select is(pg_temp.storage_rows('a1a1a1a1-0000-4000-8000-000000000001'), 1::bigint, 'fixture: A1 com 1 objeto de Storage');

create temp table t_results (k text primary key, v jsonb);
grant all on t_results to authenticated, anon;

-- ---------------------------------------------------------
-- 1. Encerramento monotônico (como owner A)
-- ---------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

-- Prévia de A1 ainda aberta.
insert into t_results values ('preview_a1_open', public.preview_company_purge('a1a1a1a1-0000-4000-8000-000000000001'));
-- Purga de empresa ATIVA é recusada.
insert into t_results values ('purge_a1_open', public.purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-A1A1A1A1'));

update public.companies set deleted_at = now() where id = 'a1a1a1a1-0000-4000-8000-000000000001';
-- Tentativas de reabrir e de editar a empresa encerrada.
update public.companies set deleted_at = null where id = 'a1a1a1a1-0000-4000-8000-000000000001';
update public.companies set razao_social = 'reaberta' where id = 'a1a1a1a1-0000-4000-8000-000000000001';

-- ---------------------------------------------------------
-- 2. Empresa encerrada não recebe novos dados (API direta, sob RLS)
-- ---------------------------------------------------------

do $$
declare
    v_company uuid := 'a1a1a1a1-0000-4000-8000-000000000001';
    v_owner uuid := '00000000-0000-4000-8000-00000000000a';
    v_decision uuid := (select id from public.decisions where company_id = v_company limit 1);
    v_diagnosis uuid := (select id from public.executive_diagnoses where company_id = v_company limit 1);
    v_knowledge uuid := (select id from public.knowledge_records where company_id = v_company limit 1);
    v_exec_1 uuid := (select execution_id from public.executions where company_id = v_company order by created_at, execution_id limit 1);
    v_exec_2 uuid := (select execution_id from public.executions where company_id = v_company order by created_at, execution_id offset 1 limit 1);
    v_statement text;
    v_statements text[] := array[
        format($s$insert into public.documents (company_id, nome_original, nome_armazenado, categoria, tipo_arquivo, tamanho_bytes, storage_path, hash_arquivo) values (%L, 'x.csv', 'x.csv', 'dre', 'text/csv', 1, %L, 'h')$s$, v_company, 'company/' || v_company || '/novo/x.csv'),
        format($s$insert into public.executions (execution_id, company_id, metadata, execution) values (gen_random_uuid(), %L, '{}', '{}')$s$, v_company),
        format($s$insert into public.executive_diagnoses (company_id, diagnosis) values (%L, '{}')$s$, v_company),
        format($s$insert into public.diagnosis_reviews (diagnosis_id, company_id, reviewer_user_id, status, review) values (%L, %L, %L, 'ACCEPTED', '{}')$s$, v_diagnosis, v_company, v_owner),
        format($s$insert into public.decisions (company_id, human_actor_id, decision) values (%L, %L, '{}')$s$, v_company, v_owner),
        format($s$insert into public.decision_execution_events (decision_id, company_id, actor_id, status) values (%L, %L, %L, 'COMPLETED')$s$, v_decision, v_company, v_owner),
        format($s$insert into public.decision_outcomes (decision_id, company_id, recorded_by, status, observed_at, description) values (%L, %L, %L, 'neutral', now(), 'x')$s$, v_decision, v_company, v_owner),
        format($s$insert into public.financial_observations (decision_id, company_id, computed_by, classification, baseline_execution_id, baseline_executed_at, observation_execution_id, observation_executed_at, metrics) values (%L, %L, %L, 'TEMPORAL_ASSOCIATION', %L, now(), %L, now(), '{}')$s$, v_decision, v_company, v_owner, v_exec_1, v_exec_2),
        format($s$insert into public.learning_records (company_id, primary_decision_id, derived_by, evidence_classification, record) values (%L, %L, %L, 'INCONCLUSIVE', '{}')$s$, v_company, v_decision, v_owner),
        format($s$insert into public.knowledge_records (id, company_id, formed_by, category, derived_from_learning_record_ids, record) values (gen_random_uuid(), %L, %L, 'accumulated_learning', array[gen_random_uuid(), gen_random_uuid()], '{}')$s$, v_company, v_owner),
        format($s$insert into public.knowledge_evaluations (company_id, knowledge_id, evaluated_by, outcome, record) values (%L, %L, %L, 'MIXED', '{}')$s$, v_company, v_knowledge, v_owner),
        format($s$insert into storage.objects (bucket_id, name, owner_id) values ('documents', %L, %L)$s$, 'company/' || v_company || '/novo/y.csv', v_owner::text)
    ];
    v_index int := 0;
begin
    foreach v_statement in array v_statements loop
        v_index := v_index + 1;
        begin
            execute v_statement;
            insert into t_results values ('closed_insert_' || v_index, '"allowed"');
        exception when others then
            insert into t_results values ('closed_insert_' || v_index, to_jsonb(sqlstate));
        end;
    end loop;

    -- Controle: a empresa ATIVA A2 do mesmo dono continua aceitando dados.
    begin
        insert into public.documents (company_id, nome_original, nome_armazenado, categoria, tipo_arquivo, tamanho_bytes, storage_path, hash_arquivo)
            values ('a2a2a2a2-0000-4000-8000-000000000002', 'z.csv', 'z.csv', 'dre', 'text/csv', 1, 'company/a2a2a2a2-0000-4000-8000-000000000002/novo/z.csv', 'h');
        insert into t_results values ('open_insert_a2', '"allowed"');
    exception when others then
        insert into t_results values ('open_insert_a2', to_jsonb(sqlstate));
    end;
end;
$$;

-- ---------------------------------------------------------
-- 3. Prévia e listagem de Storage (dono A)
-- ---------------------------------------------------------

insert into t_results values ('preview_a1_closed', public.preview_company_purge('a1a1a1a1-0000-4000-8000-000000000001'));
insert into t_results values ('preview_b1_by_a', public.preview_company_purge('b1b1b1b1-0000-4000-8000-000000000003'));
insert into t_results values ('preview_random_by_a', public.preview_company_purge('c0c0c0c0-0000-4000-8000-00000000000c'));
insert into t_results values ('storage_list_a1', (select coalesce(jsonb_agg(n), '[]') from public.list_closed_company_storage_objects('a1a1a1a1-0000-4000-8000-000000000001') n));
insert into t_results values ('storage_list_a2_open', (select coalesce(jsonb_agg(n), '[]') from public.list_closed_company_storage_objects('a2a2a2a2-0000-4000-8000-000000000002') n));

-- Pré-condições da purga.
insert into t_results values ('purge_a1_wrong_confirmation', public.purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-00000000'));
insert into t_results values ('purge_a1_storage_not_empty', public.purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-A1A1A1A1'));
insert into t_results values ('purge_random_by_a', public.purge_closed_company('c0c0c0c0-0000-4000-8000-00000000000c', 'EXCLUIR-C0C0C0C0'));

-- ---------------------------------------------------------
-- 4. Owner B nunca alcança A1
-- ---------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into t_results values ('preview_a1_by_b', public.preview_company_purge('a1a1a1a1-0000-4000-8000-000000000001'));
insert into t_results values ('purge_a1_by_b', public.purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-A1A1A1A1'));
insert into t_results values ('storage_list_a1_by_b', (select coalesce(jsonb_agg(n), '[]') from public.list_closed_company_storage_objects('a1a1a1a1-0000-4000-8000-000000000001') n));

-- Observação financeira de B1 referenciando execuções de OUTRA empresa (A2) é recusada.
do $$
begin
    insert into public.financial_observations (decision_id, company_id, computed_by, classification,
            baseline_execution_id, baseline_executed_at, observation_execution_id, observation_executed_at, metrics)
        values (
            (select id from public.decisions where company_id = 'b1b1b1b1-0000-4000-8000-000000000003' limit 1),
            'b1b1b1b1-0000-4000-8000-000000000003',
            '00000000-0000-4000-8000-00000000000b',
            'TEMPORAL_ASSOCIATION',
            (select execution_id from public.executions where company_id = 'a2a2a2a2-0000-4000-8000-000000000002' order by execution_id limit 1), now(),
            (select execution_id from public.executions where company_id = 'a2a2a2a2-0000-4000-8000-000000000002' order by execution_id offset 1 limit 1), now(),
            '{}');
    insert into t_results values ('cross_company_observation', '"allowed"');
exception when others then
    insert into t_results values ('cross_company_observation', to_jsonb(sqlstate));
end;
$$;

-- ---------------------------------------------------------
-- 5. anon não executa nenhuma função de offboarding
-- ---------------------------------------------------------

set local role anon;
do $$
begin
    perform public.preview_company_purge('a1a1a1a1-0000-4000-8000-000000000001');
    insert into t_results values ('anon_preview', '"allowed"');
exception when others then
    insert into t_results values ('anon_preview', to_jsonb(sqlstate));
end;
$$;
do $$
begin
    perform public.purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-A1A1A1A1');
    insert into t_results values ('anon_purge', '"allowed"');
exception when others then
    insert into t_results values ('anon_purge', to_jsonb(sqlstate));
end;
$$;

reset role;

-- ---------------------------------------------------------
-- Asserções do bloco 1–5
-- ---------------------------------------------------------

select is((select v->>'found' from t_results where k = 'preview_a1_open'), 'true', 'prévia: dono vê a própria empresa aberta');
select is((select v->>'closed' from t_results where k = 'preview_a1_open'), 'false', 'prévia: empresa aberta reportada como não encerrada');
select is((select v->>'reason' from t_results where k = 'purge_a1_open'), 'not_closed', 'purga: empresa ATIVA é recusada (not_closed)');

select isnt((select deleted_at from public.companies where id = 'a1a1a1a1-0000-4000-8000-000000000001'), null, 'encerramento: dono encerra a própria empresa (active → closed)');
select is((select razao_social from public.companies where id = 'a1a1a1a1-0000-4000-8000-000000000001'), 'SMOKE M202 11222333000181', 'encerramento: empresa encerrada não é editável nem reaberta (closed → active bloqueado)');

select is((select v from t_results where k = 'closed_insert_1'), '"42501"', 'encerrada: documents recusa insert');
select is((select v from t_results where k = 'closed_insert_2'), '"42501"', 'encerrada: executions recusa insert');
select is((select v from t_results where k = 'closed_insert_3'), '"42501"', 'encerrada: executive_diagnoses recusa insert');
select is((select v from t_results where k = 'closed_insert_4'), '"42501"', 'encerrada: diagnosis_reviews recusa insert');
select is((select v from t_results where k = 'closed_insert_5'), '"42501"', 'encerrada: decisions recusa insert');
select is((select v from t_results where k = 'closed_insert_6'), '"42501"', 'encerrada: decision_execution_events recusa insert');
select is((select v from t_results where k = 'closed_insert_7'), '"42501"', 'encerrada: decision_outcomes recusa insert');
select is((select v from t_results where k = 'closed_insert_8'), '"42501"', 'encerrada: financial_observations recusa insert');
select is((select v from t_results where k = 'closed_insert_9'), '"42501"', 'encerrada: learning_records recusa insert');
select is((select v from t_results where k = 'closed_insert_10'), '"42501"', 'encerrada: knowledge_records recusa insert');
select is((select v from t_results where k = 'closed_insert_11'), '"42501"', 'encerrada: knowledge_evaluations recusa insert');
select is((select v from t_results where k = 'closed_insert_12'), '"42501"', 'encerrada: Storage recusa upload no prefixo da empresa');
select is((select v from t_results where k = 'open_insert_a2'), '"allowed"', 'controle: empresa ATIVA do mesmo dono continua aceitando dados');

select is((select v->>'found' from t_results where k = 'preview_a1_closed'), 'true', 'prévia: dono vê a empresa encerrada');
select is((select v->>'closed' from t_results where k = 'preview_a1_closed'), 'true', 'prévia: encerrada reportada como encerrada');
select is((select v->>'confirmation' from t_results where k = 'preview_a1_closed'), 'EXCLUIR-A1A1A1A1', 'prévia: frase de confirmação vinculada à empresa');
select is((select v->'counts' from t_results where k = 'preview_a1_closed'),
    '{"storage_objects":1,"documents":1,"executions":2,"executive_diagnoses":1,"diagnosis_reviews":1,"decisions":1,"decision_execution_events":1,"decision_outcomes":1,"financial_observations":1,"learning_records":2,"knowledge_records":1,"knowledge_evaluations":1}'::jsonb,
    'prévia: contagens exatas por recurso, sem nenhum dado financeiro');
select is((select v from t_results where k = 'preview_b1_by_a'), '{"found":false}'::jsonb, 'prévia: empresa de outro dono → {"found": false}');
select is((select v from t_results where k = 'preview_random_by_a'), (select v from t_results where k = 'preview_b1_by_a'), 'prévia: inexistente é idêntica a não autorizada (sem enumeração)');
select is((select v from t_results where k = 'preview_a1_by_b'), '{"found":false}'::jsonb, 'prévia: owner B não vê A1');

select is(jsonb_array_length((select v from t_results where k = 'storage_list_a1')), 1, 'Storage: lista só o objeto da empresa encerrada');
select ok((select v->>0 from t_results where k = 'storage_list_a1') like 'company/a1a1a1a1-0000-4000-8000-000000000001/%', 'Storage: nome dentro do prefixo exato da empresa');
select is((select v from t_results where k = 'storage_list_a2_open'), '[]'::jsonb, 'Storage: empresa ABERTA não é listável para purga');
select is((select v from t_results where k = 'storage_list_a1_by_b'), '[]'::jsonb, 'Storage: owner B não lista objetos de A1');

select is((select v->>'reason' from t_results where k = 'purge_a1_wrong_confirmation'), 'confirmation_mismatch', 'purga: confirmação errada é recusada');
select is((select v->>'reason' from t_results where k = 'purge_a1_storage_not_empty'), 'storage_not_empty', 'purga: recusada enquanto houver objeto de Storage da empresa');
select is((select v->>'reason' from t_results where k = 'purge_random_by_a'), 'not_found', 'purga: UUID inexistente → not_found');
select is((select v from t_results where k = 'purge_a1_by_b'), (select v from t_results where k = 'purge_random_by_a'), 'purga: owner B em A1 é idêntico a inexistente (sem enumeração)');
select is(pg_temp.company_rows('a1a1a1a1-0000-4000-8000-000000000001'), 14::bigint, 'purgas recusadas não apagaram nada de A1');

select is((select v from t_results where k = 'cross_company_observation'), '"42501"', 'observação financeira com execuções de OUTRA empresa é recusada');
select is((select v from t_results where k = 'anon_preview'), '"42501"', 'anon não executa a prévia');
select is((select v from t_results where k = 'anon_purge'), '"42501"', 'anon não executa a purga');

-- ---------------------------------------------------------
-- 6. Storage esvaziado (fixture — em produção isso é a Storage API)
-- ---------------------------------------------------------

set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'documents' and name like 'company/a1a1a1a1-0000-4000-8000-000000000001/%';
set local storage.allow_delete_query = 'false';

-- Linha LEGADA de outra empresa referenciando uma execução de A1 (possível antes
-- da Migration 017) — a purga de A1 deve falhar inteira, sem tocar em B1.
insert into public.financial_observations (decision_id, company_id, computed_by, classification,
        baseline_execution_id, baseline_executed_at, observation_execution_id, observation_executed_at, metrics)
    values (
        (select id from public.decisions where company_id = 'b1b1b1b1-0000-4000-8000-000000000003' limit 1),
        'b1b1b1b1-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-00000000000b',
        'TEMPORAL_ASSOCIATION',
        (select execution_id from public.executions where company_id = 'a1a1a1a1-0000-4000-8000-000000000001' order by execution_id limit 1), now(),
        (select execution_id from public.executions where company_id = 'b1b1b1b1-0000-4000-8000-000000000003' order by execution_id limit 1), now(),
        '{}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into t_results values ('purge_a1_blocked', public.purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-A1A1A1A1'));
reset role;

select is((select v->>'reason' from t_results where k = 'purge_a1_blocked'), 'blocked_by_external_reference', 'purga: referência de outra empresa bloqueia (sem cascata)');
select is(pg_temp.company_rows('a1a1a1a1-0000-4000-8000-000000000001'), 14::bigint, 'purga bloqueada foi desfeita INTEIRA (nenhuma linha de A1 apagada)');
select is(pg_temp.company_rows('b1b1b1b1-0000-4000-8000-000000000003'), 15::bigint, 'purga bloqueada não tocou em B1');

delete from public.financial_observations
where company_id = 'b1b1b1b1-0000-4000-8000-000000000003'
  and baseline_execution_id in (select execution_id from public.executions where company_id = 'a1a1a1a1-0000-4000-8000-000000000001');

-- ---------------------------------------------------------
-- 7. Purga bem-sucedida e nova tentativa
-- ---------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into t_results values ('purge_a1_ok', public.purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-A1A1A1A1'));
insert into t_results values ('purge_a1_retry', public.purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-A1A1A1A1'));
insert into t_results values ('preview_a1_after', public.preview_company_purge('a1a1a1a1-0000-4000-8000-000000000001'));
reset role;

select is((select v->>'ok' from t_results where k = 'purge_a1_ok'), 'true', 'purga: empresa encerrada do próprio dono é purgada');
select is((select v->'deleted' from t_results where k = 'purge_a1_ok'),
    '{"companies":1,"documents":1,"executions":2,"executive_diagnoses":1,"diagnosis_reviews":1,"decisions":1,"decision_execution_events":1,"decision_outcomes":1,"financial_observations":1,"learning_records":2,"knowledge_records":1,"knowledge_evaluations":1}'::jsonb,
    'purga: todas as 12 tabelas limpas, contagens exatas');
select is(pg_temp.company_rows('a1a1a1a1-0000-4000-8000-000000000001'), 0::bigint, 'purga: zero linhas restantes de A1');
select is(pg_temp.company_rows('a2a2a2a2-0000-4000-8000-000000000002'), 15::bigint, 'purga: outra empresa do MESMO dono intacta');
select is(pg_temp.company_rows('b1b1b1b1-0000-4000-8000-000000000003'), 14::bigint, 'purga: empresa de OUTRO dono intacta');
select ok(exists(select 1 from auth.users where id = '00000000-0000-4000-8000-00000000000a')
      and exists(select 1 from public.users where id = '00000000-0000-4000-8000-00000000000a'), 'purga: conta (auth.users e public.users) preservada');
select is((select v->>'reason' from t_results where k = 'purge_a1_retry'), 'not_found', 'nova tentativa depois do sucesso é inofensiva (not_found)');
select is((select v from t_results where k = 'preview_a1_after'), '{"found":false}'::jsonb, 'prévia depois da purga: empresa não existe mais');

-- ---------------------------------------------------------
-- 8. Metadados de segurança
-- ---------------------------------------------------------

select ok((select prosecdef from pg_proc where oid = 'public.purge_closed_company(uuid, text)'::regprocedure)
      and not (select prosecdef from pg_proc where oid = 'public.preview_company_purge(uuid)'::regprocedure)
      and not (select prosecdef from pg_proc where oid = 'public.list_closed_company_storage_objects(uuid)'::regprocedure),
    'segurança: só a purga é SECURITY DEFINER; prévia e listagem ficam sob RLS');

select finish();
rollback;
