-- =========================================================
-- Mission 202B — Governed Operator Offboarding Authority (D-131)
--
-- Prova em Postgres REAL (Supabase local descartável) da Migration
-- 018: autoridade explícita de offboarding do operador NEXO, restrita
-- ao ciclo de vida, sem posse da empresa e sem acesso a dados.
--
-- Como rodar (nunca contra o NEXO Pilot):
--   npx supabase start
--   npx supabase test db
--
-- Tudo roda numa transação que termina em ROLLBACK. Dados sintéticos.
-- `authenticated` e `auth.uid()` simulados como o PostgREST faz; a
-- remoção pela Storage API é simulada como o servidor do Storage faz
-- (`storage.operation` + `storage.allow_delete_query` por transação,
-- DELETE sob o papel do usuário). Resultados sob `authenticated` vão
-- para uma tabela temporária e são conferidos como `postgres`.
-- =========================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(65);

-- ---------------------------------------------------------
-- Fixtures
--   A  = dono de A1 (será encerrada e purgada PELO OPERADOR),
--        A2 (controle, aberta) e A3 (encerrada pelo dono; purgada PELO DONO)
--   B  = dono de B1 (controle de outro dono)
--   O  = operador de offboarding ativo
--   U  = usuário comum
--   R  = operador revogado
-- ---------------------------------------------------------

insert into auth.users (id, email, aud, role, instance_id) values
    ('00000000-0000-4000-8000-00000000000a', 'owner-a@m202b.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    ('00000000-0000-4000-8000-00000000000b', 'owner-b@m202b.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    ('00000000-0000-4000-8000-00000000000c', 'operator@m202b.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    ('00000000-0000-4000-8000-00000000000d', 'user@m202b.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    ('00000000-0000-4000-8000-00000000000e', 'revoked@m202b.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

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
        values (p_company, p_owner, 'SMOKE M202B ' || p_cnpj, p_cnpj);
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

select pg_temp.seed_company('a1a1a1a1-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', '11222333000181');
select pg_temp.seed_company('a2a2a2a2-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', '99888777000161');
select pg_temp.seed_company('a3a3a3a3-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a', '12345678000195');
select pg_temp.seed_company('b1b1b1b1-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000000b', '11222333000181');

-- Concessões (como dono do banco — o único caminho).
select public.grant_offboarding_operator('00000000-0000-4000-8000-00000000000c', 'TEST-GRANT-O');
select public.grant_offboarding_operator('00000000-0000-4000-8000-00000000000e', 'TEST-GRANT-R');
select public.revoke_offboarding_operator('00000000-0000-4000-8000-00000000000e', 'TEST-REVOKE-R');

create temp table t_results (k text primary key, v jsonb);
grant all on t_results to authenticated, anon;

-- Helper: executa um comando e grava 'allowed', o número de linhas ou o SQLSTATE.
create function pg_temp.probe(p_key text, p_sql text)
returns void
language plpgsql
as $$
declare
    v_rows bigint;
begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    insert into t_results values (p_key, to_jsonb(v_rows));
exception when others then
    insert into t_results values (p_key, to_jsonb(sqlstate));
end;
$$;
grant execute on function pg_temp.probe(text, text) to authenticated, anon;

-- ---------------------------------------------------------
-- 1. Dono A encerra A3 pela própria sessão (fluxo da 017)
-- ---------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
update public.companies set deleted_at = now() where id = 'a3a3a3a3-0000-4000-8000-000000000003';
reset role;

select is((select closed_authority from public.company_offboarding_records where company_id = 'a3a3a3a3-0000-4000-8000-000000000003'),
    'owner', 'registro: encerramento pelo dono gravado automaticamente com autoridade owner');

-- ---------------------------------------------------------
-- 2. Escopo do OPERADOR: nenhum acesso a dados nem escrita
-- ---------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

insert into t_results values ('op_is_operator', to_jsonb(public.is_offboarding_operator()));
insert into t_results values ('op_select_data', to_jsonb(
      (select count(*) from public.companies where id in ('a1a1a1a1-0000-4000-8000-000000000001', 'a3a3a3a3-0000-4000-8000-000000000003'))
    + (select count(*) from public.documents where company_id in ('a1a1a1a1-0000-4000-8000-000000000001', 'a3a3a3a3-0000-4000-8000-000000000003'))
    + (select count(*) from public.executions where company_id in ('a1a1a1a1-0000-4000-8000-000000000001', 'a3a3a3a3-0000-4000-8000-000000000003'))
    + (select count(*) from public.executive_diagnoses where company_id in ('a1a1a1a1-0000-4000-8000-000000000001', 'a3a3a3a3-0000-4000-8000-000000000003'))
    + (select count(*) from public.decisions where company_id in ('a1a1a1a1-0000-4000-8000-000000000001', 'a3a3a3a3-0000-4000-8000-000000000003'))
    + (select count(*) from public.financial_observations where company_id in ('a1a1a1a1-0000-4000-8000-000000000001', 'a3a3a3a3-0000-4000-8000-000000000003'))
    + (select count(*) from public.knowledge_records where company_id in ('a1a1a1a1-0000-4000-8000-000000000001', 'a3a3a3a3-0000-4000-8000-000000000003'))));
insert into t_results values ('op_select_storage_plain', to_jsonb(
    (select count(*) from storage.objects where bucket_id = 'documents'
       and (name like 'company/a1a1a1a1-0000-4000-8000-000000000001/%' or name like 'company/a3a3a3a3-0000-4000-8000-000000000003/%'))));

select pg_temp.probe('op_insert_document', $s$insert into public.documents (company_id, nome_original, nome_armazenado, categoria, tipo_arquivo, tamanho_bytes, storage_path, hash_arquivo) values ('a1a1a1a1-0000-4000-8000-000000000001', 'x.csv', 'x.csv', 'dre', 'text/csv', 1, 'company/a1a1a1a1-0000-4000-8000-000000000001/novo/x.csv', 'h')$s$);
select pg_temp.probe('op_insert_decision', $s$insert into public.decisions (company_id, human_actor_id, decision) values ('a1a1a1a1-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000c', '{}')$s$);
select pg_temp.probe('op_update_company', $s$update public.companies set razao_social = 'x' where id = 'a1a1a1a1-0000-4000-8000-000000000001'$s$);
select pg_temp.probe('op_close_via_rls', $s$update public.companies set deleted_at = now() where id = 'a2a2a2a2-0000-4000-8000-000000000002'$s$);
select pg_temp.probe('op_reopen_via_rls', $s$update public.companies set deleted_at = null where id = 'a3a3a3a3-0000-4000-8000-000000000003'$s$);
select pg_temp.probe('op_update_document', $s$update public.documents set categoria = 'outros' where company_id = 'a1a1a1a1-0000-4000-8000-000000000001'$s$);
select pg_temp.probe('op_storage_upload', $s$insert into storage.objects (bucket_id, name, owner_id) values ('documents', 'company/a1a1a1a1-0000-4000-8000-000000000001/novo/y.csv', '00000000-0000-4000-8000-00000000000c')$s$);
select pg_temp.probe('op_read_operators', $s$select * from public.offboarding_operators$s$);
select pg_temp.probe('op_read_records', $s$select * from public.company_offboarding_records$s$);
select pg_temp.probe('op_call_core', $s$select public.company_purge_execute('a1a1a1a1-0000-4000-8000-000000000001')$s$);
select pg_temp.probe('op_call_grant', $s$select public.grant_offboarding_operator('00000000-0000-4000-8000-00000000000d', 'X')$s$);
select pg_temp.probe('op_call_counts', $s$select public.company_purge_counts('a1a1a1a1-0000-4000-8000-000000000001')$s$);

-- ---------------------------------------------------------
-- 3. Operador: guards antes do registro
-- ---------------------------------------------------------

insert into t_results values ('op_preview_a1_open', public.operator_preview_company_purge('a1a1a1a1-0000-4000-8000-000000000001'));
insert into t_results values ('op_purge_a1_open', public.operator_purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-A1A1A1A1'));
insert into t_results values ('op_preview_random', public.operator_preview_company_purge('c0c0c0c0-0000-4000-8000-00000000000c'));
insert into t_results values ('op_purge_random', public.operator_purge_closed_company('c0c0c0c0-0000-4000-8000-00000000000c', 'EXCLUIR-C0C0C0C0'));
insert into t_results values ('op_purge_a3_unregistered', public.operator_purge_closed_company('a3a3a3a3-0000-4000-8000-000000000003', 'EXCLUIR-A3A3A3A3'));
insert into t_results values ('op_list_a3_unregistered', (select coalesce(jsonb_agg(n), '[]') from public.operator_list_offboarding_storage_objects('a3a3a3a3-0000-4000-8000-000000000003') n));
insert into t_results values ('op_register_bad_reference', public.operator_register_offboarding('a1a1a1a1-0000-4000-8000-000000000001', 'contato@empresa.com', 'ENCERRAR-A1A1A1A1'));
insert into t_results values ('op_register_bad_confirmation', public.operator_register_offboarding('a1a1a1a1-0000-4000-8000-000000000001', 'REG-2026-001', 'ENCERRAR-00000000'));

-- ---------------------------------------------------------
-- 4. Operador: registra a solicitação (A1 aberta → encerrada; A3 já encerrada)
-- ---------------------------------------------------------

insert into t_results values ('op_register_a1', public.operator_register_offboarding('a1a1a1a1-0000-4000-8000-000000000001', 'REG-2026-001', 'ENCERRAR-A1A1A1A1'));
insert into t_results values ('op_register_a1_again', public.operator_register_offboarding('a1a1a1a1-0000-4000-8000-000000000001', 'REG-2026-999', 'ENCERRAR-A1A1A1A1'));
insert into t_results values ('op_register_a3', public.operator_register_offboarding('a3a3a3a3-0000-4000-8000-000000000003', 'REG-2026-002', 'ENCERRAR-A3A3A3A3'));
insert into t_results values ('op_preview_a1_registered', public.operator_preview_company_purge('a1a1a1a1-0000-4000-8000-000000000001'));
insert into t_results values ('op_list_a1', (select coalesce(jsonb_agg(n), '[]') from public.operator_list_offboarding_storage_objects('a1a1a1a1-0000-4000-8000-000000000001') n));
insert into t_results values ('op_list_a2_open', (select coalesce(jsonb_agg(n), '[]') from public.operator_list_offboarding_storage_objects('a2a2a2a2-0000-4000-8000-000000000002') n));

-- Leitura de Storage fora da remoção em lote continua negada, mesmo registrada.
select set_config('storage.operation', 'storage.object.get_authenticated', true);
insert into t_results values ('op_storage_download_a1', to_jsonb((select count(*) from storage.objects where name like 'company/a1a1a1a1-0000-4000-8000-000000000001/%')));
select set_config('storage.operation', 'storage.object.list', true);
insert into t_results values ('op_storage_list_a1', to_jsonb((select count(*) from storage.objects where name like 'company/a1a1a1a1-0000-4000-8000-000000000001/%')));
select set_config('storage.operation', 'storage.object.delete_many', true);
insert into t_results values ('op_storage_removal_view_a1', to_jsonb((select count(*) from storage.objects where name like 'company/a1a1a1a1-0000-4000-8000-000000000001/%')));
insert into t_results values ('op_storage_removal_view_a2', to_jsonb((select count(*) from storage.objects where name like 'company/a2a2a2a2-0000-4000-8000-000000000002/%')));

-- Remoção como a Storage API faz, sob o papel do operador.
select set_config('storage.allow_delete_query', 'true', true);
select pg_temp.probe('op_storage_delete_a2_open', $s$delete from storage.objects where bucket_id = 'documents' and name like 'company/a2a2a2a2-0000-4000-8000-000000000002/%'$s$);
select pg_temp.probe('op_storage_delete_a1', $s$delete from storage.objects where bucket_id = 'documents' and name like 'company/a1a1a1a1-0000-4000-8000-000000000001/%'$s$);
select set_config('storage.allow_delete_query', 'false', true);
select set_config('storage.operation', '', true);

-- ---------------------------------------------------------
-- 5. Operador: purga de A1
-- ---------------------------------------------------------

insert into t_results values ('op_purge_a1_wrong', public.operator_purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-00000000'));
insert into t_results values ('op_purge_a1_ok', public.operator_purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-A1A1A1A1'));
insert into t_results values ('op_purge_a1_retry', public.operator_purge_closed_company('a1a1a1a1-0000-4000-8000-000000000001', 'EXCLUIR-A1A1A1A1'));
insert into t_results values ('op_preview_a1_after', public.operator_preview_company_purge('a1a1a1a1-0000-4000-8000-000000000001'));

-- ---------------------------------------------------------
-- 6. Usuário comum U: nenhuma capacidade nova
-- ---------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
insert into t_results values ('u_is_operator', to_jsonb(public.is_offboarding_operator()));
insert into t_results values ('u_preview_a3', public.operator_preview_company_purge('a3a3a3a3-0000-4000-8000-000000000003'));
insert into t_results values ('u_preview_random', public.operator_preview_company_purge('c0c0c0c0-0000-4000-8000-00000000000c'));
insert into t_results values ('u_register_a2', public.operator_register_offboarding('a2a2a2a2-0000-4000-8000-000000000002', 'REG-2026-003', 'ENCERRAR-A2A2A2A2'));
insert into t_results values ('u_purge_a3', public.operator_purge_closed_company('a3a3a3a3-0000-4000-8000-000000000003', 'EXCLUIR-A3A3A3A3'));
insert into t_results values ('u_can_remove_a3', to_jsonb(public.offboarding_operator_can_remove('a3a3a3a3-0000-4000-8000-000000000003')));
insert into t_results values ('u_list_a3', (select coalesce(jsonb_agg(n), '[]') from public.operator_list_offboarding_storage_objects('a3a3a3a3-0000-4000-8000-000000000003') n));
select set_config('storage.operation', 'storage.object.delete_many', true);
insert into t_results values ('u_storage_removal_view_a3', to_jsonb((select count(*) from storage.objects where name like 'company/a3a3a3a3-0000-4000-8000-000000000003/%')));
select set_config('storage.operation', '', true);

-- ---------------------------------------------------------
-- 7. Operador REVOGADO: perde tudo imediatamente
-- ---------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated"}', true);
insert into t_results values ('r_is_operator', to_jsonb(public.is_offboarding_operator()));
insert into t_results values ('r_preview_a3', public.operator_preview_company_purge('a3a3a3a3-0000-4000-8000-000000000003'));
insert into t_results values ('r_purge_a3', public.operator_purge_closed_company('a3a3a3a3-0000-4000-8000-000000000003', 'EXCLUIR-A3A3A3A3'));

-- ---------------------------------------------------------
-- 8. Dono: continua purgando a própria empresa; nunca a de outro dono
-- ---------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into t_results values ('a_purge_b1', public.purge_closed_company('b1b1b1b1-0000-4000-8000-000000000004', 'EXCLUIR-B1B1B1B1'));
-- Storage de A3 removido pela Storage API com a sessão do dono (policy da 017).
select set_config('storage.operation', 'storage.object.delete_many', true);
select set_config('storage.allow_delete_query', 'true', true);
select pg_temp.probe('a_storage_delete_a3', $s$delete from storage.objects where bucket_id = 'documents' and name like 'company/a3a3a3a3-0000-4000-8000-000000000003/%'$s$);
select set_config('storage.allow_delete_query', 'false', true);
select set_config('storage.operation', '', true);
insert into t_results values ('a_purge_a3', public.purge_closed_company('a3a3a3a3-0000-4000-8000-000000000003', 'EXCLUIR-A3A3A3A3'));

-- ---------------------------------------------------------
-- 9. anon
-- ---------------------------------------------------------

set local role anon;
select pg_temp.probe('anon_operator_preview', $s$select public.operator_preview_company_purge('a2a2a2a2-0000-4000-8000-000000000002')$s$);
select pg_temp.probe('anon_operator_purge', $s$select public.operator_purge_closed_company('a2a2a2a2-0000-4000-8000-000000000002', 'x')$s$);
select pg_temp.probe('anon_operator_register', $s$select public.operator_register_offboarding('a2a2a2a2-0000-4000-8000-000000000002', 'REG-1', 'x')$s$);
reset role;

-- =========================================================
-- Asserções
-- =========================================================

-- Escopo do operador
select is((select v from t_results where k = 'op_is_operator'), 'true'::jsonb, 'operador: autoridade reconhecida pelo banco');
select is((select v from t_results where k = 'op_select_data'), '0'::jsonb, 'operador: não lê empresas, documentos, análises, diagnósticos, decisões, observações nem conhecimento');
select is((select v from t_results where k = 'op_select_storage_plain'), '0'::jsonb, 'operador: não vê objetos de Storage fora da remoção');
select is((select v from t_results where k = 'op_insert_document'), '"42501"'::jsonb, 'operador: não insere documento');
select is((select v from t_results where k = 'op_insert_decision'), '"42501"'::jsonb, 'operador: não cria decisão');
select is((select v from t_results where k = 'op_update_company'), '0'::jsonb, 'operador: não edita empresa');
select is((select v from t_results where k = 'op_close_via_rls'), '0'::jsonb, 'operador: não encerra empresa pelo caminho comum (só pelo registro governado)');
select is((select v from t_results where k = 'op_reopen_via_rls'), '0'::jsonb, 'operador: não reabre empresa');
select is((select v from t_results where k = 'op_update_document'), '0'::jsonb, 'operador: não altera documento');
select is((select v from t_results where k = 'op_storage_upload'), '"42501"'::jsonb, 'operador: não envia arquivo');
select is((select v from t_results where k = 'op_read_operators'), '"42501"'::jsonb, 'operador: não lê o registro de autoridade');
select is((select v from t_results where k = 'op_read_records'), '"42501"'::jsonb, 'operador: não lê o registro de offboarding diretamente');
select is((select v from t_results where k = 'op_call_core'), '"42501"'::jsonb, 'operador: não chama o núcleo da purga sem os guards');
select is((select v from t_results where k = 'op_call_grant'), '"42501"'::jsonb, 'operador: não concede autoridade');
select is((select v from t_results where k = 'op_call_counts'), '"42501"'::jsonb, 'operador: não chama a contagem interna sem os guards');

-- Guards antes do registro
select is((select v->>'found' from t_results where k = 'op_preview_a1_open'), 'true', 'operador: prévia encontra a empresa');
select is((select v->>'closed' from t_results where k = 'op_preview_a1_open'), 'false', 'operador: prévia reporta empresa aberta');
select is((select v->>'registered' from t_results where k = 'op_preview_a1_open'), 'false', 'operador: prévia reporta sem registro');
select ok((select v ?& array['found', 'closed', 'registered', 'confirmation', 'closure_confirmation', 'counts'] and not (v ?| array['razao_social', 'cnpj', 'user_id']) from t_results where k = 'op_preview_a1_open'),
    'operador: prévia só com estado, frases e contagens — sem razão social, CNPJ nem dono');
select is((select v->>'reason' from t_results where k = 'op_purge_a1_open'), 'not_closed', 'operador: empresa ATIVA não é purgada');
select is((select v from t_results where k = 'op_preview_random'), '{"found":false}'::jsonb, 'operador: inexistente → found false');
select is((select v->>'reason' from t_results where k = 'op_purge_random'), 'not_found', 'operador: purga de inexistente → not_found');
select is((select v->>'reason' from t_results where k = 'op_purge_a3_unregistered'), 'not_registered', 'operador: encerrada SEM solicitação registrada não é purgada');
select is((select v from t_results where k = 'op_list_a3_unregistered'), '[]'::jsonb, 'operador: sem registro, nenhum objeto listável');
select is((select v->>'reason' from t_results where k = 'op_register_bad_reference'), 'invalid_reference', 'operador: referência fora do formato (ex.: e-mail) é recusada');
select is((select v->>'reason' from t_results where k = 'op_register_bad_confirmation'), 'confirmation_mismatch', 'operador: registro exige a frase ENCERRAR vinculada à empresa');

-- Registro
select is((select v from t_results where k = 'op_register_a1'), '{"ok":true,"closed_now":true,"already_registered":false}'::jsonb, 'operador: registra a solicitação e encerra a empresa aberta');
select is((select v->>'closed' from t_results where k = 'op_preview_a1_registered'), 'true', 'registro: A1 encerrada logo depois do registro (monotônico)');
select is((select v->>'already_registered' from t_results where k = 'op_register_a1_again'), 'true', 'registro: repetir é idempotente');
select is((select v from t_results where k = 'op_register_a3'), '{"ok":true,"closed_now":false,"already_registered":false}'::jsonb, 'operador: registra a solicitação de empresa já encerrada pelo dono');
select is((select v->>'registered' from t_results where k = 'op_preview_a1_registered'), 'true', 'operador: prévia reporta o registro');
select is((select v->>'closure_confirmation' from t_results where k = 'op_preview_a1_registered'), 'ENCERRAR-A1A1A1A1', 'operador: frase de encerramento vinculada à empresa');
select is(jsonb_array_length((select v from t_results where k = 'op_list_a1')), 1, 'operador: lista só os nomes dos objetos da empresa registrada');
select is((select v from t_results where k = 'op_list_a2_open'), '[]'::jsonb, 'operador: nada listável de empresa aberta');

-- Storage
select is((select v from t_results where k = 'op_storage_download_a1'), '0'::jsonb, 'Storage: operador não baixa (get_authenticated)');
select is((select v from t_results where k = 'op_storage_list_a1'), '0'::jsonb, 'Storage: operador não lista (list)');
select is((select v from t_results where k = 'op_storage_removal_view_a1'), '1'::jsonb, 'Storage: dentro da remoção em lote, o operador alcança o objeto da empresa registrada');
select is((select v from t_results where k = 'op_storage_removal_view_a2'), '0'::jsonb, 'Storage: nem na remoção alcança empresa aberta');
select is((select v from t_results where k = 'op_storage_delete_a2_open'), '0'::jsonb, 'Storage: operador não apaga objeto de empresa aberta');
select is((select v from t_results where k = 'op_storage_delete_a1'), '1'::jsonb, 'Storage: operador remove o objeto da empresa encerrada e registrada');

-- Purga pelo operador
select is((select v->>'reason' from t_results where k = 'op_purge_a1_wrong'), 'confirmation_mismatch', 'operador: frase de exclusão errada é recusada');
select is((select v->>'ok' from t_results where k = 'op_purge_a1_ok'), 'true', 'operador: purga a empresa encerrada e registrada');
select is((select v->'deleted' from t_results where k = 'op_purge_a1_ok'),
    '{"companies":1,"documents":1,"executions":2,"executive_diagnoses":1,"diagnosis_reviews":1,"decisions":1,"decision_execution_events":1,"decision_outcomes":1,"financial_observations":1,"learning_records":2,"knowledge_records":1,"knowledge_evaluations":1}'::jsonb,
    'operador: núcleo único limpa as 12 tabelas com contagens exatas');
select is(pg_temp.company_rows('a1a1a1a1-0000-4000-8000-000000000001'), 0::bigint, 'operador: zero linhas restantes de A1');
select is((select v->>'reason' from t_results where k = 'op_purge_a1_retry'), 'not_found', 'operador: repetir depois do sucesso é inofensivo');
select is((select v from t_results where k = 'op_preview_a1_after'), '{"found":false}'::jsonb, 'operador: prévia depois da purga não encontra a empresa');

-- Registro de offboarding (auditoria)
select ok((select closed_authority = 'operator' and closed_by = '00000000-0000-4000-8000-00000000000c' and request_reference = 'REG-2026-001'
               and purge_authority = 'operator' and purged_by = '00000000-0000-4000-8000-00000000000c' and purged_at is not null
               and purge_result = (select v->'deleted' from t_results where k = 'op_purge_a1_ok')
           from public.company_offboarding_records where company_id = 'a1a1a1a1-0000-4000-8000-000000000001'),
    'auditoria: A1 com encerramento e purga do operador, referência e contagens — o registro sobrevive à purga');

-- Usuário comum e operador revogado
select is((select v from t_results where k = 'u_is_operator'), 'false'::jsonb, 'usuário comum: não é operador');
select is((select v from t_results where k = 'u_preview_a3'), (select v from t_results where k = 'u_preview_random'), 'usuário comum: prévia de empresa real idêntica à de inexistente');
select is((select v->>'reason' from t_results where k = 'u_register_a2'), 'not_found', 'usuário comum: não registra nem encerra');
select is((select deleted_at from public.companies where id = 'a2a2a2a2-0000-4000-8000-000000000002'), null, 'usuário comum: A2 continua aberta');
select is((select v->>'reason' from t_results where k = 'u_purge_a3'), 'not_found', 'usuário comum: não purga');
select ok((select v = 'false'::jsonb from t_results where k = 'u_can_remove_a3')
      and (select v = '[]'::jsonb from t_results where k = 'u_list_a3')
      and (select v = '0'::jsonb from t_results where k = 'u_storage_removal_view_a3'), 'usuário comum: nenhum alcance de Storage de outra empresa, nem na remoção');
select ok((select v = 'false'::jsonb from t_results where k = 'r_is_operator')
      and (select v = '{"found":false}'::jsonb from t_results where k = 'r_preview_a3')
      and (select v->>'reason' = 'not_found' from t_results where k = 'r_purge_a3'), 'operador revogado: perde a autoridade imediatamente');

-- Dono
select is((select v->>'reason' from t_results where k = 'a_purge_b1'), 'not_found', 'dono: não purga empresa de outro dono');
select is((select v from t_results where k = 'a_storage_delete_a3'), '1'::jsonb, 'dono: continua removendo o Storage da própria empresa encerrada');
select is((select v->>'ok' from t_results where k = 'a_purge_a3'), 'true', 'dono: continua purgando a própria empresa encerrada (fluxo da 017)');
select ok((select closed_authority = 'owner' and request_reference = 'REG-2026-002' and purge_authority = 'owner' and purged_by = '00000000-0000-4000-8000-00000000000a'
           from public.company_offboarding_records where company_id = 'a3a3a3a3-0000-4000-8000-000000000003'),
    'auditoria: A3 encerrada e purgada pelo dono, com a solicitação registrada pelo operador');

-- Isolamento e conta
select ok(pg_temp.company_rows('a2a2a2a2-0000-4000-8000-000000000002') = 14 and pg_temp.storage_rows('a2a2a2a2-0000-4000-8000-000000000002') = 1
      and pg_temp.company_rows('b1b1b1b1-0000-4000-8000-000000000004') = 14 and pg_temp.storage_rows('b1b1b1b1-0000-4000-8000-000000000004') = 1,
    'isolamento: A2 (mesmo dono) e B1 (outro dono) intactas no banco e no Storage');
select ok((select count(*) from auth.users where id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000c')) = 3
      and (select count(*) from public.users where id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000c')) = 3,
    'contas preservadas (dono, outro dono e operador)');
select ok((select v = '"42501"'::jsonb from t_results where k = 'anon_operator_preview')
      and (select v = '"42501"'::jsonb from t_results where k = 'anon_operator_purge')
      and (select v = '"42501"'::jsonb from t_results where k = 'anon_operator_register'), 'anon: não executa nenhuma função do operador');

-- Metadados de segurança
select ok(
    (select bool_and(p.prosecdef and array_to_string(p.proconfig, ',') = 'search_path=""')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('operator_preview_company_purge', 'operator_register_offboarding', 'operator_purge_closed_company',
                                                   'operator_list_offboarding_storage_objects', 'offboarding_operator_can_remove', 'is_offboarding_operator',
                                                   'purge_closed_company', 'grant_offboarding_operator', 'revoke_offboarding_operator'))
    and not has_function_privilege('authenticated', 'public.company_purge_execute(uuid)', 'execute')
    and not has_function_privilege('service_role', 'public.company_purge_execute(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.grant_offboarding_operator(uuid, text)', 'execute')
    and not has_function_privilege('service_role', 'public.grant_offboarding_operator(uuid, text)', 'execute')
    and not has_function_privilege('service_role', 'public.revoke_offboarding_operator(uuid, text)', 'execute'),
    'segurança: funções do operador DEFINER com search_path vazio; núcleo e concessão fora do alcance de authenticated e service_role');
select ok(
    (select relrowsecurity from pg_class where oid = 'public.offboarding_operators'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.company_offboarding_records'::regclass)
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('offboarding_operators', 'company_offboarding_records')),
    'segurança: registros com RLS habilitada e nenhuma policy (ninguém lê diretamente)');
select is(
    (select array_agg(column_name::text order by column_name::text) from information_schema.columns
     where table_schema = 'public' and table_name = 'company_offboarding_records'),
    array['closed_at', 'closed_authority', 'closed_by', 'company_id', 'created_at', 'purge_authority', 'purge_result',
          'purged_at', 'purged_by', 'request_reference', 'request_registered_at', 'request_registered_by'],
    'auditoria mínima: só ids técnicos, instantes, autoridade, referência e contagens — nenhuma coluna de dado da empresa');

select finish();
rollback;
