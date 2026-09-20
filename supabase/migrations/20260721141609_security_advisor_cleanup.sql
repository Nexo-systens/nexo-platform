-- =========================================================
-- NEXO PLATFORM
-- Migration 005
-- Security Advisor cleanup: public.empresas (legado) e
-- public.financial_metrics (RLS ausente)
-- =========================================================

-- =========================================================
-- public.empresas — LEGADO, REMOVIDO
--
-- Investigacao (confirmada com o usuario antes desta migration):
--   - 0 linhas.
--   - Nenhuma FK de/para outras tabelas.
--   - Nenhuma view dependente.
--   - Nenhuma referencia no codigo da aplicacao.
--   - Nenhuma migration anterior a criou (drift manual via Studio).
--   - Estrutura (corporate_name/trade_name/cnpj/segment/tax_regime/status)
--     e um prototipo anterior do que hoje e public.companies (Missao 4).
-- =========================================================

drop table if exists public.empresas;

-- =========================================================
-- public.financial_metrics — NAO E LEGADO, FORMALIZADO AQUI
--
-- Ja existia com uma FK real e valida para public.companies(id), mas
-- criada fora de qualquer migration (mesmo padrao de drift ja visto na
-- Missao 4). Corresponde a entidade ja documentada em docs/03_DATABASE.md
-- (Motor Financeiro, uso futuro) — nao foi removida, apenas trazida para
-- controle de versao e fechada com RLS, sem alterar sua estrutura.
-- =========================================================

alter table public.financial_metrics enable row level security;

create policy "financial_metrics_select_own"
    on public.financial_metrics
    for select
    using (
        exists (
            select 1 from public.companies c
            where c.id = financial_metrics.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "financial_metrics_insert_own"
    on public.financial_metrics
    for insert
    with check (
        exists (
            select 1 from public.companies c
            where c.id = financial_metrics.company_id
              and c.user_id = auth.uid()
        )
    );

create policy "financial_metrics_update_own"
    on public.financial_metrics
    for update
    using (
        exists (
            select 1 from public.companies c
            where c.id = financial_metrics.company_id
              and c.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.companies c
            where c.id = financial_metrics.company_id
              and c.user_id = auth.uid()
        )
    );

-- Nenhuma policy de delete: mesma regra estrutural de companies/documents
-- (docs/03_DATABASE.md, Regra Imutavel #4) — nunca exclusao fisica.

-- A tabela ja tinha updated_at mas nenhum trigger para mante-lo; alinhando
-- com o mesmo padrao de companies/documents/users (reaproveita a function
-- ja existente, nao recria).
create trigger set_financial_metrics_updated_at
    before update on public.financial_metrics
    for each row
    execute function public.handle_updated_at();
