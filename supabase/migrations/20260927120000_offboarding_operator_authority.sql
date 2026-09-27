-- =========================================================
-- NEXO PLATFORM
-- Migration 018
-- Autoridade governada de offboarding do operador NEXO
-- (Mission 202B — Governed Operator Offboarding Authority, D-131)
-- =========================================================

-- =========================================================
-- CONTEXTO
--
-- A Migration 017 (D-130) só permite a purga definitiva pela sessão do
-- DONO da empresa. Uma promessa operacional de prazo (dados ativos
-- removidos em até 30 dias após o encerramento) não pode depender de o
-- dono voltar a entrar no produto.
--
-- D-131: uma segunda autoridade, explícita e restrita ao ciclo de vida
-- de offboarding — o operador NEXO registrado em
-- `public.offboarding_operators` — pode registrar o encerramento
-- solicitado pelo canal acordado e concluir a purga de uma empresa JÁ
-- encerrada e registrada. Não é posse da empresa: nenhuma policy de
-- leitura ou escrita de dados financeiros muda; o operador só recebe
-- contagens, nomes de objetos a remover e o resultado.
--
-- A lógica de purga passa a ter um NÚCLEO único
-- (`company_purge_execute`), usado pelas duas autoridades. O fluxo do
-- dono mantém exatamente os mesmos guards e respostas da 017.
-- Nenhum ON DELETE CASCADE é introduzido.
-- =========================================================


-- =========================================================
-- 1. REGISTRO DE AUTORIDADE DO OPERADOR
--
-- Append-only: conceder cria uma linha; revogar preenche `revoked_at`.
-- No máximo uma concessão ativa por conta. RLS habilitada SEM policy e
-- sem privilégio para `anon`/`authenticated`: nenhum usuário lê nem
-- grava esta tabela. Só o dono do banco (migration ou CLI, com
-- autorização humana registrada) concede ou revoga, pelas funções da
-- seção 7. A referência aponta para o registro privado do operador —
-- nunca e-mail, nome ou texto livre.
-- =========================================================

create table public.offboarding_operators (

    id uuid primary key default gen_random_uuid(),

    user_id uuid not null references auth.users (id),

    grant_reference text not null
        check (grant_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$'),

    granted_at timestamptz not null default now(),

    revoked_at timestamptz,

    revoke_reference text
        check (revoke_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$'),

    constraint offboarding_operators_revocation_complete
        check ((revoked_at is null) = (revoke_reference is null)),

    constraint offboarding_operators_revocation_after_grant
        check (revoked_at is null or revoked_at >= granted_at)

);

create unique index offboarding_operators_one_active_grant
    on public.offboarding_operators (user_id)
    where revoked_at is null;

comment on table public.offboarding_operators is
    'Mission 202B (D-131). Contas com autoridade de offboarding (só ciclo de vida: registrar encerramento solicitado e concluir a purga de empresa encerrada). Não concede leitura nem escrita de dados de empresas. Gerida só pelo dono do banco.';

alter table public.offboarding_operators enable row level security;

revoke all on table public.offboarding_operators from anon, authenticated;


-- =========================================================
-- 2. REGISTRO DE OFFBOARDING (trilha de auditoria mínima)
--
-- Uma linha por empresa encerrada, SEM FK para `companies`: sobrevive à
-- purga e serve para comprovar a operação, montar o inventário de
-- backups e reaplicar a purga depois de uma restauração. Só
-- identificadores técnicos, instantes, autoridade, referência ao
-- registro privado e as CONTAGENS apagadas — nunca razão social, CNPJ,
-- documento, demonstração, indicador, diagnóstico ou valor financeiro.
-- Sem policy: ninguém lê nem grava diretamente; só as funções abaixo.
-- =========================================================

create table public.company_offboarding_records (

    company_id uuid primary key,

    closed_at timestamptz not null,

    closed_by uuid,

    closed_authority text not null
        check (closed_authority in ('owner', 'operator', 'unattributed')),

    request_reference text
        check (request_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$'),

    request_registered_at timestamptz,

    request_registered_by uuid,

    purged_at timestamptz,

    purged_by uuid,

    purge_authority text
        check (purge_authority in ('owner', 'operator')),

    purge_result jsonb,

    created_at timestamptz not null default now(),

    constraint company_offboarding_records_request_complete
        check (
            (request_reference is null) = (request_registered_at is null)
            and (request_reference is null) = (request_registered_by is null)
        ),

    constraint company_offboarding_records_purge_complete
        check (
            (purged_at is null) = (purge_authority is null)
            and (purged_at is null) = (purged_by is null)
            and (purged_at is null) = (purge_result is null)
        )

);

comment on table public.company_offboarding_records is
    'Mission 202B (D-131). Evidência mínima do offboarding de cada empresa: id técnico, encerramento, registro da solicitação, purga, autoridade e contagens apagadas. Sem dado financeiro, sem FK (sobrevive à purga).';

alter table public.company_offboarding_records enable row level security;

revoke all on table public.company_offboarding_records from anon, authenticated;

-- Empresas já encerradas antes desta migration: só o dono podia
-- encerrar (RLS da 017), então a autoridade é a do dono.
insert into public.company_offboarding_records (company_id, closed_at, closed_by, closed_authority)
select c.id, c.deleted_at, c.user_id, 'owner'
from public.companies c
where c.deleted_at is not null
on conflict (company_id) do nothing;


-- =========================================================
-- 3. ENCERRAMENTO REGISTRADO AUTOMATICAMENTE
--
-- Todo encerramento (deleted_at: null → valor) gera o registro. O dono
-- encerrando pela própria sessão → 'owner'. O operador já grava o
-- registro antes de encerrar (seção 6) → nada muda aqui. Qualquer outro
-- caminho (manutenção manual, proibida na operação normal) fica
-- visível como 'unattributed'.
-- =========================================================

create function public.record_company_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.company_offboarding_records (company_id, closed_at, closed_by, closed_authority)
    values (
        new.id,
        new.deleted_at,
        auth.uid(),
        case when auth.uid() is not null and auth.uid() = new.user_id then 'owner' else 'unattributed' end
    )
    on conflict (company_id) do nothing;

    return new;
end;
$$;

revoke all on function public.record_company_closure() from public, anon, authenticated;

create trigger record_company_closure
    after update of deleted_at on public.companies
    for each row
    when (old.deleted_at is null and new.deleted_at is not null)
    execute function public.record_company_closure();


-- =========================================================
-- 4. NÚCLEO ÚNICO DA PURGA
--
-- Extraído de `purge_closed_company` (017), sem mudança de ordem nem de
-- escopo: apaga as 11 tabelas dependentes na ordem das FKs, sempre por
-- `company_id`, a empresa por último, e verifica zero restante na mesma
-- transação. Uma referência de OUTRA empresa (FK NO ACTION) desfaz o
-- bloco inteiro. NÃO valida autoridade — por isso não é executável por
-- nenhum papel de cliente: só pelas funções SECURITY DEFINER (dono do
-- banco) que já validaram a autoridade e travaram a linha da empresa.
-- =========================================================

create function public.company_purge_execute(p_company_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
    v_count bigint;
    v_deleted jsonb := '{}'::jsonb;
    v_remaining bigint;
begin
    begin
        delete from public.knowledge_evaluations where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('knowledge_evaluations', v_count);

        delete from public.financial_observations where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('financial_observations', v_count);

        delete from public.learning_records where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('learning_records', v_count);

        delete from public.knowledge_records where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('knowledge_records', v_count);

        delete from public.decision_outcomes where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('decision_outcomes', v_count);

        delete from public.decision_execution_events where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('decision_execution_events', v_count);

        delete from public.decisions where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('decisions', v_count);

        delete from public.diagnosis_reviews where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('diagnosis_reviews', v_count);

        delete from public.executive_diagnoses where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('executive_diagnoses', v_count);

        delete from public.executions where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('executions', v_count);

        delete from public.documents where company_id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('documents', v_count);

        delete from public.companies where id = p_company_id;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('companies', v_count);
    exception
        when foreign_key_violation then
            return jsonb_build_object('ok', false, 'reason', 'blocked_by_external_reference');
    end;

    select
        (select count(*) from public.companies where id = p_company_id)
      + (select count(*) from public.documents where company_id = p_company_id)
      + (select count(*) from public.executions where company_id = p_company_id)
      + (select count(*) from public.executive_diagnoses where company_id = p_company_id)
      + (select count(*) from public.diagnosis_reviews where company_id = p_company_id)
      + (select count(*) from public.decisions where company_id = p_company_id)
      + (select count(*) from public.decision_execution_events where company_id = p_company_id)
      + (select count(*) from public.decision_outcomes where company_id = p_company_id)
      + (select count(*) from public.financial_observations where company_id = p_company_id)
      + (select count(*) from public.learning_records where company_id = p_company_id)
      + (select count(*) from public.knowledge_records where company_id = p_company_id)
      + (select count(*) from public.knowledge_evaluations where company_id = p_company_id)
    into v_remaining;

    if v_remaining <> 0 then
        raise exception 'company purge verification failed';
    end if;

    return jsonb_build_object('ok', true, 'deleted', v_deleted);
end;
$$;

revoke all on function public.company_purge_execute(uuid) from public, anon, authenticated, service_role;

comment on function public.company_purge_execute(uuid) is
    'Mission 202B (D-131). Núcleo único da purga (ordem das FKs, sempre por company_id, empresa por último, verificação de zero restante). Não valida autoridade: só é chamado por purge_closed_company (dono) e operator_purge_closed_company (operador).';


-- =========================================================
-- 5. FLUXO DO DONO — mesmos guards e respostas da 017
--
-- Só muda o que acontece DEPOIS dos guards: o núcleo único apaga, e o
-- registro de offboarding recebe a purga (autoridade 'owner').
-- =========================================================

create or replace function public.purge_closed_company(p_company_id uuid, p_confirmation text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
    v_deleted_at timestamptz;
    v_result jsonb;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    -- Posse + trava da linha: inexistente e de outro dono são idênticos.
    select c.deleted_at into v_deleted_at
    from public.companies c
    where c.id = p_company_id
      and c.user_id = v_uid
    for update;

    if not found then
        return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    if v_deleted_at is null then
        return jsonb_build_object('ok', false, 'reason', 'not_closed');
    end if;

    if p_confirmation is distinct from public.company_purge_confirmation(p_company_id) then
        return jsonb_build_object('ok', false, 'reason', 'confirmation_mismatch');
    end if;

    if exists (
        select 1 from storage.objects o
        where o.bucket_id = 'documents'
          and (storage.foldername(o.name))[1] = 'company'
          and (storage.foldername(o.name))[2] = p_company_id::text
    ) then
        return jsonb_build_object('ok', false, 'reason', 'storage_not_empty');
    end if;

    v_result := public.company_purge_execute(p_company_id);

    if (v_result->>'ok')::boolean then
        insert into public.company_offboarding_records as r
            (company_id, closed_at, closed_by, closed_authority, purged_at, purged_by, purge_authority, purge_result)
        values
            (p_company_id, v_deleted_at, v_uid, 'owner', now(), v_uid, 'owner', v_result->'deleted')
        on conflict (company_id) do update
            set purged_at = excluded.purged_at,
                purged_by = excluded.purged_by,
                purge_authority = excluded.purge_authority,
                purge_result = excluded.purge_result;
    end if;

    return v_result;
end;
$$;


-- =========================================================
-- 6. FLUXO DO OPERADOR — só ciclo de vida
--
-- Todas SECURITY DEFINER, `search_path` vazio, sem SQL dinâmico. Quem
-- não é operador ativo recebe exatamente a mesma resposta de uma
-- empresa inexistente. O operador nunca recebe razão social, CNPJ,
-- documentos, análises nem valores: só existência, estado, contagens,
-- frases de confirmação e nomes de objetos a remover.
-- =========================================================

create function public.is_offboarding_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select auth.uid() is not null
       and exists (
           select 1 from public.offboarding_operators o
           where o.user_id = auth.uid()
             and o.revoked_at is null
       );
$$;

create function public.company_closure_confirmation(p_company_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
    select 'ENCERRAR-' || upper(left(p_company_id::text, 8));
$$;

-- Contagens por recurso (mesmo formato da prévia do dono). Interna.
create function public.company_purge_counts(p_company_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
    select jsonb_build_object(
        'storage_objects', (
            select count(*) from storage.objects o
            where o.bucket_id = 'documents'
              and (storage.foldername(o.name))[1] = 'company'
              and (storage.foldername(o.name))[2] = p_company_id::text
        ),
        'documents', (select count(*) from public.documents t where t.company_id = p_company_id),
        'executions', (select count(*) from public.executions t where t.company_id = p_company_id),
        'executive_diagnoses', (select count(*) from public.executive_diagnoses t where t.company_id = p_company_id),
        'diagnosis_reviews', (select count(*) from public.diagnosis_reviews t where t.company_id = p_company_id),
        'decisions', (select count(*) from public.decisions t where t.company_id = p_company_id),
        'decision_execution_events', (select count(*) from public.decision_execution_events t where t.company_id = p_company_id),
        'decision_outcomes', (select count(*) from public.decision_outcomes t where t.company_id = p_company_id),
        'financial_observations', (select count(*) from public.financial_observations t where t.company_id = p_company_id),
        'learning_records', (select count(*) from public.learning_records t where t.company_id = p_company_id),
        'knowledge_records', (select count(*) from public.knowledge_records t where t.company_id = p_company_id),
        'knowledge_evaluations', (select count(*) from public.knowledge_evaluations t where t.company_id = p_company_id)
    );
$$;

revoke all on function public.company_purge_counts(uuid) from public, anon, authenticated, service_role;

-- Prévia do operador: existência, estado, registro, frases e contagens.
create function public.operator_preview_company_purge(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_deleted_at timestamptz;
    v_reference text;
begin
    if not public.is_offboarding_operator() then
        return jsonb_build_object('found', false);
    end if;

    select c.deleted_at into v_deleted_at
    from public.companies c
    where c.id = p_company_id;

    if not found then
        return jsonb_build_object('found', false);
    end if;

    select r.request_reference into v_reference
    from public.company_offboarding_records r
    where r.company_id = p_company_id;

    return jsonb_build_object(
        'found', true,
        'closed', v_deleted_at is not null,
        'registered', v_reference is not null,
        'confirmation', public.company_purge_confirmation(p_company_id),
        'closure_confirmation', public.company_closure_confirmation(p_company_id),
        'counts', public.company_purge_counts(p_company_id)
    );
end;
$$;

-- Registro da solicitação de encerramento (recebida pelo canal acordado)
-- e, se a empresa ainda estiver aberta, o encerramento em nome da
-- empresa. Monotônico: nunca reabre. Não apaga nada.
create function public.operator_register_offboarding(
    p_company_id uuid,
    p_reference text,
    p_confirmation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
    v_deleted_at timestamptz;
    v_existing_reference text;
    v_record_exists boolean;
begin
    if not public.is_offboarding_operator() then
        return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    select c.deleted_at into v_deleted_at
    from public.companies c
    where c.id = p_company_id
    for update;

    if not found then
        return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    if p_reference is null or p_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$' then
        return jsonb_build_object('ok', false, 'reason', 'invalid_reference');
    end if;

    if p_confirmation is distinct from public.company_closure_confirmation(p_company_id) then
        return jsonb_build_object('ok', false, 'reason', 'confirmation_mismatch');
    end if;

    select true, r.request_reference into v_record_exists, v_existing_reference
    from public.company_offboarding_records r
    where r.company_id = p_company_id
    for update;

    if v_existing_reference is not null then
        return jsonb_build_object('ok', true, 'closed_now', false, 'already_registered', true);
    end if;

    if v_deleted_at is null then
        -- Encerramento em nome da empresa: o registro nasce com a
        -- autoridade do operador antes do gatilho de encerramento.
        insert into public.company_offboarding_records
            (company_id, closed_at, closed_by, closed_authority,
             request_reference, request_registered_at, request_registered_by)
        values
            (p_company_id, now(), v_uid, 'operator', p_reference, now(), v_uid);

        update public.companies set deleted_at = now() where id = p_company_id;

        return jsonb_build_object('ok', true, 'closed_now', true, 'already_registered', false);
    end if;

    if coalesce(v_record_exists, false) then
        update public.company_offboarding_records
        set request_reference = p_reference,
            request_registered_at = now(),
            request_registered_by = v_uid
        where company_id = p_company_id;
    else
        insert into public.company_offboarding_records
            (company_id, closed_at, closed_by, closed_authority,
             request_reference, request_registered_at, request_registered_by)
        values
            (p_company_id, v_deleted_at, null, 'unattributed', p_reference, now(), v_uid);
    end if;

    return jsonb_build_object('ok', true, 'closed_now', false, 'already_registered', false);
end;
$$;

-- O operador pode remover os objetos de uma empresa encerrada E
-- registrada? (usada pelas policies de Storage e pela listagem)
create function public.offboarding_operator_can_remove(p_company_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.is_offboarding_operator()
       and exists (
           select 1
           from public.companies c
           join public.company_offboarding_records r on r.company_id = c.id
           where c.id::text = p_company_folder
             and c.deleted_at is not null
             and r.request_reference is not null
       );
$$;

-- Nomes dos objetos a remover (nunca conteúdo), só para empresa
-- encerrada e registrada, só para operador ativo.
create function public.operator_list_offboarding_storage_objects(p_company_id uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
    select o.name
    from storage.objects o
    where o.bucket_id = 'documents'
      and (storage.foldername(o.name))[1] = 'company'
      and (storage.foldername(o.name))[2] = p_company_id::text
      and public.offboarding_operator_can_remove(p_company_id::text)
    order by o.name;
$$;

-- Purga pelo operador: mesmos invariantes do dono + registro exigido.
create function public.operator_purge_closed_company(p_company_id uuid, p_confirmation text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
    v_deleted_at timestamptz;
    v_reference text;
    v_result jsonb;
begin
    if not public.is_offboarding_operator() then
        return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    select c.deleted_at into v_deleted_at
    from public.companies c
    where c.id = p_company_id
    for update;

    if not found then
        return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    if v_deleted_at is null then
        return jsonb_build_object('ok', false, 'reason', 'not_closed');
    end if;

    select r.request_reference into v_reference
    from public.company_offboarding_records r
    where r.company_id = p_company_id
    for update;

    if v_reference is null then
        return jsonb_build_object('ok', false, 'reason', 'not_registered');
    end if;

    if p_confirmation is distinct from public.company_purge_confirmation(p_company_id) then
        return jsonb_build_object('ok', false, 'reason', 'confirmation_mismatch');
    end if;

    if exists (
        select 1 from storage.objects o
        where o.bucket_id = 'documents'
          and (storage.foldername(o.name))[1] = 'company'
          and (storage.foldername(o.name))[2] = p_company_id::text
    ) then
        return jsonb_build_object('ok', false, 'reason', 'storage_not_empty');
    end if;

    v_result := public.company_purge_execute(p_company_id);

    if (v_result->>'ok')::boolean then
        update public.company_offboarding_records
        set purged_at = now(),
            purged_by = v_uid,
            purge_authority = 'operator',
            purge_result = v_result->'deleted'
        where company_id = p_company_id;
    end if;

    return v_result;
end;
$$;


-- =========================================================
-- 7. CONCESSÃO E REVOGAÇÃO (só o dono do banco)
--
-- Nunca executáveis por `anon`, `authenticated` ou `service_role`: a
-- autoridade não pode ser concedida pelo produto nem por uma chave de
-- API. Uso documentado no runbook, com autorização humana registrada.
-- =========================================================

create function public.grant_offboarding_operator(p_user_id uuid, p_reference text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
    if not exists (select 1 from auth.users u where u.id = p_user_id) then
        raise exception 'offboarding operator grant: unknown account';
    end if;

    insert into public.offboarding_operators (user_id, grant_reference)
    values (p_user_id, p_reference);
end;
$$;

create function public.revoke_offboarding_operator(p_user_id uuid, p_reference text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
    update public.offboarding_operators
    set revoked_at = now(),
        revoke_reference = p_reference
    where user_id = p_user_id
      and revoked_at is null;

    if not found then
        raise exception 'offboarding operator revoke: no active grant';
    end if;
end;
$$;

revoke all on function public.grant_offboarding_operator(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.revoke_offboarding_operator(uuid, text) from public, anon, authenticated, service_role;


-- =========================================================
-- 8. STORAGE — o operador REMOVE, nunca lê
--
-- A Storage API remove objetos com `DELETE … WHERE … RETURNING`, que
-- exige passar também numa policy de SELECT. A policy de SELECT do
-- operador vale SOMENTE dentro da operação de remoção em lote da
-- Storage API (`storage.operation()` = 'storage.object.delete_many',
-- gravado pelo servidor do Storage por requisição): download, listagem,
-- URL assinada e cópia continuam negados. Ambas exigem empresa
-- encerrada E registrada e operador ativo. As policies do dono
-- continuam iguais.
-- =========================================================

create policy "documents_storage_delete_offboarding_operator"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] = 'company'
        and public.offboarding_operator_can_remove((storage.foldername(name))[2])
    );

create policy "documents_storage_select_offboarding_operator_removal"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'documents'
        and storage.operation() = 'storage.object.delete_many'
        and (storage.foldername(name))[1] = 'company'
        and public.offboarding_operator_can_remove((storage.foldername(name))[2])
    );


-- =========================================================
-- 9. PRIVILÉGIOS DAS FUNÇÕES DE CLIENTE
--
-- Só `authenticated`; cada função valida a autoridade por dentro.
-- =========================================================

revoke all on function public.is_offboarding_operator() from public, anon;
grant execute on function public.is_offboarding_operator() to authenticated;

revoke all on function public.company_closure_confirmation(uuid) from public, anon;
grant execute on function public.company_closure_confirmation(uuid) to authenticated;

revoke all on function public.operator_preview_company_purge(uuid) from public, anon;
grant execute on function public.operator_preview_company_purge(uuid) to authenticated;

revoke all on function public.operator_register_offboarding(uuid, text, text) from public, anon;
grant execute on function public.operator_register_offboarding(uuid, text, text) to authenticated;

revoke all on function public.offboarding_operator_can_remove(text) from public, anon;
grant execute on function public.offboarding_operator_can_remove(text) to authenticated;

revoke all on function public.operator_list_offboarding_storage_objects(uuid) from public, anon;
grant execute on function public.operator_list_offboarding_storage_objects(uuid) to authenticated;

revoke all on function public.operator_purge_closed_company(uuid, text) from public, anon;
grant execute on function public.operator_purge_closed_company(uuid, text) to authenticated;

comment on function public.operator_purge_closed_company(uuid, text) is
    'Mission 202B (D-131). Purga pelo operador NEXO de uma empresa JÁ encerrada e com solicitação registrada: mesmos invariantes do dono (encerrada, frase exata, Storage vazio, núcleo único). Não é posse: não concede leitura nem escrita de dados.';
