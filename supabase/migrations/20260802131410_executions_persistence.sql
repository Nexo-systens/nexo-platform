-- =========================================================
-- NEXO PLATFORM
-- Migration 006
-- Executions persistence (EFOS Core — ExecutionSnapshot,
-- efos/application/persistence/ExecutionSnapshot.ts, Mission 027)
-- =========================================================

-- =========================================================
-- EXECUTIONS
-- Uma linha por ExecutionSnapshot salvo via
-- SupabaseExecutionRepository.save() (Mission 033) —
-- PersistenceClient.insert({ collection: "executions", data: snapshot }).
-- "metadata"/"execution"/"report" armazenam exatamente os campos de
-- mesmo nome de ExecutionSnapshot (PipelineMetadata/PipelineExecution/
-- ExecutiveReport, todos já JSON-serializáveis), sem nenhum campo
-- extra e sem nenhuma normalização/coluna própria por dentro deles —
-- o contrato da Application Layer permanece a única fonte da verdade
-- de sua forma interna.
-- =========================================================

create table public.executions (

    id uuid primary key default gen_random_uuid(),

    execution_id uuid not null unique,

    company_id uuid not null references public.companies (id),

    metadata jsonb not null,

    execution jsonb not null,

    report jsonb,

    created_at timestamptz not null default now()

);

comment on table public.executions is 'Execuções completas do EFOS persistidas (ExecutionSnapshot, efos/application/persistence/ExecutionSnapshot.ts, Mission 027). Registro imutável — nunca atualizado após inserido.';

-- =========================================================
-- INDICES
-- =========================================================

create unique index executions_execution_id_idx on public.executions (execution_id);

create index executions_company_id_idx on public.executions (company_id);

-- =========================================================
-- RLS
-- Mesmo padrão de documents/financial_metrics: executions não tem
-- user_id direto, pertence a uma empresa, que pertence a um usuário —
-- isolamento verificado via subquery em companies.
-- =========================================================

alter table public.executions enable row level security;

create policy "executions_select_own"
    on public.executions
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = executions.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "executions_insert_own"
    on public.executions
    for insert
    with check (
        exists (
            select 1 from public.companies c
            where c.id = executions.company_id
              and c.user_id = auth.uid()
        )
    );

-- Nenhuma policy de update: uma execução persistida nunca é alterada
-- (ExecutionRepository.save(), Mission 033, sempre insere; nenhum
-- método de atualização existe no contrato).
--
-- Nenhuma policy de delete: exclusão física nunca é permitida, mesmo
-- diante de bug de aplicação (mesma regra estrutural de
-- companies/documents/financial_metrics).
