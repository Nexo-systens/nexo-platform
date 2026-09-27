-- =========================================================
-- NEXO PLATFORM
-- Migration 017
-- Company offboarding — encerramento monotônico, bloqueio de novos
-- dados em empresa encerrada e purga definitiva governada
-- (Mission 202 — Tenant-Safe Company Offboarding & Data Purge, D-130)
-- =========================================================

-- =========================================================
-- CONTEXTO
--
-- A auditoria de offboarding da Mission 201 mostrou que a NEXO só faz
-- exclusão LÓGICA de uma empresa (`companies.deleted_at`): nenhuma
-- tabela tem policy de DELETE, todas as FKs para `companies(id)` são
-- NO ACTION, e os bytes de documentos aceitos são fisicamente
-- imutáveis para o usuário (D-123). Além disso, o RLS ignorava
-- `deleted_at`: o dono de uma empresa encerrada ainda podia gravar
-- dados nela e até reabri-la por API direta.
--
-- D-130: a imutabilidade continua sendo a regra da operação normal.
-- A purga definitiva é uma EXCEÇÃO de ciclo de vida, só para empresa
-- já encerrada, só pelo dono, com confirmação vinculada à empresa,
-- sempre restrita por `company_id`, com Storage tratado ANTES do
-- banco. Nenhum ON DELETE CASCADE é introduzido.
-- =========================================================


-- =========================================================
-- 1. ENCERRAMENTO MONOTÔNICO: active → closed, nunca closed → active
--
-- USING passa a exigir `deleted_at is null`: uma empresa encerrada não
-- aceita mais nenhum UPDATE do usuário comum (nem reabrir, nem editar).
-- WITH CHECK continua só com a posse — é o que permite o próprio
-- encerramento (`softDeleteCompany()` grava `deleted_at` numa linha
-- ainda aberta).
-- =========================================================

alter policy "companies_update_own"
    on public.companies
    using (auth.uid() = user_id and deleted_at is null)
    with check (auth.uid() = user_id);


-- =========================================================
-- 2. EMPRESA ENCERRADA NÃO RECEBE NOVOS DADOS (nem por API direta)
--
-- Cada policy de escrita company-scoped recebe `c.deleted_at is null`
-- na mesma subquery de posse que já existia — nenhuma outra condição
-- é alterada, exceto em `financial_observations` (abaixo).
-- =========================================================

alter policy "documents_insert_own"
    on public.documents
    with check (
        exists (
            select 1 from public.companies c
            where c.id = documents.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
    );

alter policy "documents_update_own"
    on public.documents
    using (
        exists (
            select 1 from public.companies c
            where c.id = documents.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
    )
    with check (
        exists (
            select 1 from public.companies c
            where c.id = documents.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
    );

alter policy "documents_storage_insert_own"
    on storage.objects
    with check (
        bucket_id = 'documents'
        and exists (
            select 1 from public.companies c
            where c.id::text = (storage.foldername(name))[2]
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
    );

alter policy "executions_insert_own"
    on public.executions
    with check (
        exists (
            select 1 from public.companies c
            where c.id = executions.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
    );

alter policy "executive_diagnoses_insert_own"
    on public.executive_diagnoses
    with check (
        exists (
            select 1 from public.companies c
            where c.id = executive_diagnoses.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
    );

alter policy "diagnosis_reviews_insert_own"
    on public.diagnosis_reviews
    with check (
        reviewer_user_id = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = diagnosis_reviews.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
        and exists (
            select 1 from public.executive_diagnoses d
            where d.id = diagnosis_reviews.diagnosis_id
              and d.company_id = diagnosis_reviews.company_id
        )
    );

alter policy "decisions_insert_own"
    on public.decisions
    with check (
        (human_actor_id is null or human_actor_id = auth.uid())
        and exists (
            select 1 from public.companies c
            where c.id = decisions.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
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

alter policy "decision_execution_events_insert_own"
    on public.decision_execution_events
    with check (
        actor_id = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = decision_execution_events.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
        and exists (
            select 1 from public.decisions d
            where d.id = decision_execution_events.decision_id
              and d.company_id = decision_execution_events.company_id
        )
    );

alter policy "decision_outcomes_insert_own"
    on public.decision_outcomes
    with check (
        recorded_by = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = decision_outcomes.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
        and exists (
            select 1 from public.decisions d
            where d.id = decision_outcomes.decision_id
              and d.company_id = decision_outcomes.company_id
        )
    );

-- `financial_observations` era a única tabela cuja policy não exigia
-- que as linhas referenciadas pertencessem à mesma empresa (execuções
-- de baseline/observação e o desfecho humano) — uma referência de
-- outra empresa poderia bloquear a purga desta (FK NO ACTION). Passa a
-- exigir a mesma empresa em todas as referências.
alter policy "financial_observations_insert_own"
    on public.financial_observations
    with check (
        computed_by = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = financial_observations.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
        and exists (
            select 1 from public.decisions d
            where d.id = financial_observations.decision_id
              and d.company_id = financial_observations.company_id
        )
        and exists (
            select 1 from public.executions e
            where e.execution_id = financial_observations.baseline_execution_id
              and e.company_id = financial_observations.company_id
        )
        and exists (
            select 1 from public.executions e
            where e.execution_id = financial_observations.observation_execution_id
              and e.company_id = financial_observations.company_id
        )
        and (
            financial_observations.human_outcome_id is null
            or exists (
                select 1 from public.decision_outcomes o
                where o.id = financial_observations.human_outcome_id
                  and o.company_id = financial_observations.company_id
            )
        )
    );

alter policy "learning_records_insert_own"
    on public.learning_records
    with check (
        derived_by = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = learning_records.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
        and exists (
            select 1 from public.decisions d
            where d.id = learning_records.primary_decision_id
              and d.company_id = learning_records.company_id
        )
    );

alter policy "knowledge_records_insert_own"
    on public.knowledge_records
    with check (
        formed_by = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = knowledge_records.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
    );

alter policy "knowledge_evaluations_insert_own"
    on public.knowledge_evaluations
    with check (
        evaluated_by = auth.uid()
        and exists (
            select 1 from public.companies c
            where c.id = knowledge_evaluations.company_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
        )
        and exists (
            select 1 from public.knowledge_records k
            where k.id = knowledge_evaluations.knowledge_id
              and k.company_id = knowledge_evaluations.company_id
        )
    );


-- =========================================================
-- 3. STORAGE: o dono pode apagar os arquivos de uma empresa ENCERRADA
--
-- Usado pela Storage API com a sessão do próprio usuário (nunca
-- `service_role`). Só o bucket `documents`, só o prefixo exato
-- `company/{companyId}/`, só empresa do próprio `auth.uid()` e só
-- depois do encerramento. Para empresas abertas, a regra de D-123
-- continua: bytes de documento aceito são imutáveis para o usuário.
-- =========================================================

create policy "documents_storage_delete_closed_company"
    on storage.objects
    for delete
    using (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] = 'company'
        and exists (
            select 1 from public.companies c
            where c.id::text = (storage.foldername(name))[2]
              and c.user_id = auth.uid()
              and c.deleted_at is not null
        )
    );


-- =========================================================
-- 4. CONFIRMAÇÃO VINCULADA À EMPRESA
--
-- A purga exige esta frase exata. Não é segredo (a prévia a devolve
-- ao dono): existe para impossibilitar uma chamada acidental simples.
-- =========================================================

create function public.company_purge_confirmation(p_company_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
    select 'EXCLUIR-' || upper(left(p_company_id::text, 8));
$$;


-- =========================================================
-- 5. PRÉVIA (dry-run) — SECURITY INVOKER, sujeita ao RLS
--
-- Só contagens e a frase de confirmação; nenhum dado financeiro.
-- Empresa inexistente e empresa de outro dono devolvem exatamente o
-- mesmo `{"found": false}` — nenhum canal de enumeração.
-- =========================================================

create function public.preview_company_purge(p_company_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
    v_deleted_at timestamptz;
begin
    select c.deleted_at into v_deleted_at
    from public.companies c
    where c.id = p_company_id
      and c.user_id = auth.uid();

    if not found then
        return jsonb_build_object('found', false);
    end if;

    return jsonb_build_object(
        'found', true,
        'closed', v_deleted_at is not null,
        'confirmation', public.company_purge_confirmation(p_company_id),
        'counts', jsonb_build_object(
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
        )
    );
end;
$$;


-- =========================================================
-- 6. OBJETOS DE STORAGE A REMOVER — SECURITY INVOKER, sujeita ao RLS
--
-- Nomes exatos sob `company/{companyId}/`, só para empresa encerrada
-- do próprio dono. A remoção é feita depois pela Storage API (que
-- apaga os bytes físicos) — nunca por DELETE direto em
-- `storage.objects`.
-- =========================================================

create function public.list_closed_company_storage_objects(p_company_id uuid)
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
    select o.name
    from storage.objects o
    where o.bucket_id = 'documents'
      and (storage.foldername(o.name))[1] = 'company'
      and (storage.foldername(o.name))[2] = p_company_id::text
      and exists (
          select 1 from public.companies c
          where c.id = p_company_id
            and c.user_id = auth.uid()
            and c.deleted_at is not null
      )
    order by o.name;
$$;


-- =========================================================
-- 7. PURGA DEFINITIVA — SECURITY DEFINER, transacional
--
-- DEFINER é necessário porque nenhuma tabela tem (nem deve ter)
-- policy de DELETE para usuários: a imutabilidade normal continua. A
-- função valida a posse com `auth.uid()` dentro da fronteira
-- privilegiada, exige empresa encerrada, confirmação exata e Storage
-- já vazio, apaga na ordem das FKs sempre por `company_id`, apaga a
-- empresa por último e nunca toca em `auth.users`/`public.users`.
--
-- Pré-condições não atendidas devolvem `{"ok": false, "reason": ...}`
-- sem apagar nada. Uma referência de OUTRA empresa a dados desta
-- (FK NO ACTION) desfaz o bloco inteiro e devolve
-- `blocked_by_external_reference` — nunca apaga dado alheio. Qualquer
-- outra falha aborta a transação inteira.
-- =========================================================

create function public.purge_closed_company(p_company_id uuid, p_confirmation text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
    v_deleted_at timestamptz;
    v_count bigint;
    v_deleted jsonb := '{}'::jsonb;
    v_remaining bigint;
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

        delete from public.companies where id = p_company_id and user_id = v_uid;
        get diagnostics v_count = row_count;
        v_deleted := v_deleted || jsonb_build_object('companies', v_count);
    exception
        when foreign_key_violation then
            return jsonb_build_object('ok', false, 'reason', 'blocked_by_external_reference');
    end;

    -- Verificação dentro da mesma transação: nada da empresa pode restar.
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


-- =========================================================
-- 8. PRIVILÉGIOS
--
-- Nunca `public`/`anon`. Só `authenticated` — a posse é validada
-- dentro de cada função (e pelo RLS nas SECURITY INVOKER).
-- =========================================================

revoke all on function public.company_purge_confirmation(uuid) from public;
revoke all on function public.company_purge_confirmation(uuid) from anon;
grant execute on function public.company_purge_confirmation(uuid) to authenticated;

revoke all on function public.preview_company_purge(uuid) from public;
revoke all on function public.preview_company_purge(uuid) from anon;
grant execute on function public.preview_company_purge(uuid) to authenticated;

revoke all on function public.list_closed_company_storage_objects(uuid) from public;
revoke all on function public.list_closed_company_storage_objects(uuid) from anon;
grant execute on function public.list_closed_company_storage_objects(uuid) to authenticated;

revoke all on function public.purge_closed_company(uuid, text) from public;
revoke all on function public.purge_closed_company(uuid, text) from anon;
grant execute on function public.purge_closed_company(uuid, text) to authenticated;

comment on function public.purge_closed_company(uuid, text) is
    'Mission 202 (D-130). Purga definitiva de uma empresa JÁ ENCERRADA, só pelo dono, com confirmação exata e Storage já vazio. Apaga na ordem das FKs, sempre por company_id, a empresa por último; nunca apaga auth.users/public.users. Exceção de ciclo de vida à imutabilidade normal — não é operação corrente.';
