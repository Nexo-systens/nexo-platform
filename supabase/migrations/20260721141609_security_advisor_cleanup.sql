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
-- public.financial_metrics — NAO E LEGADO NO PROJETO HISTORICO, MAS
-- NUNCA CRIADA POR NENHUMA MIGRATION (Mission 199P Closure A)
--
-- Ja existia com uma FK real e valida para public.companies(id), mas
-- criada fora de qualquer migration (mesmo padrao de drift ja visto na
-- Missao 4). Correspondia a entidade ja documentada em
-- docs/03_DATABASE.md (Motor Financeiro, uso futuro — documento que
-- nao existe mais no repositorio atual) — nao foi removida quando esta
-- migration rodou pela primeira vez, apenas trazida para controle de
-- versao e fechada com RLS, sem alterar sua estrutura.
--
-- Mission 199P Closure A — auditoria completa da cadeia de 15
-- migrations (cross-check sistematico entre todo CREATE TABLE e toda
-- referencia por ALTER TABLE/CREATE POLICY/CREATE TRIGGER) confirmou
-- que public.financial_metrics e a UNICA tabela desta natureza em
-- toda a cadeia: nunca criada por nenhuma migration, nunca referenciada
-- por nenhum codigo de aplicacao atual (grep completo em app/, modules/,
-- efos/, e ausente de types/database.ts). Corresponde ao que
-- docs/ARCHITECTURE_AUDIT.md (auditoria pre-Engine) chamava de destino
-- futuro para `Indicador` — mas a persistencia real de Financial Truth,
-- desde a Mission 027-036 (D-017/D-027/D-028), e
-- public.executions.execution (jsonb, IndicatorsAggregate incluido),
-- nunca esta tabela. Classificacao: LEGACY_DEAD — nunca
-- CANONICAL_REQUIRED (nenhuma decisao arquitetural nova: nenhum
-- comportamento de runtime muda, D-0XX nao registrada).
--
-- Os 5 statements abaixo permanecem exatamente os mesmos que ja
-- rodaram no projeto Supabase historico em Julho/2026 (editar este
-- arquivo agora nao re-executa nada la — uma migration ja aplicada
-- nao e re-rodada) — apenas passam a ser CONDICIONAIS a tabela
-- genuinamente existir, para que um banco novo (onde ela nunca existiu
-- por nenhuma migration) nao falhe tentando fechar com RLS algo que
-- nunca foi criado. Nenhum banco novo passa a ter esta tabela por
-- causa desta migration — ela continua nunca sendo criada por nenhuma
-- migration, deliberadamente (LEGACY_DEAD, nunca recriar schema morto).
-- =========================================================

do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'financial_metrics'
    ) then
        execute 'alter table public.financial_metrics enable row level security';

        execute 'create policy "financial_metrics_select_own"
            on public.financial_metrics
            for select
            using (
                exists (
                    select 1 from public.companies c
                    where c.id = financial_metrics.company_id
                      and c.user_id = auth.uid()
                )
            )';

        execute 'create policy "financial_metrics_insert_own"
            on public.financial_metrics
            for insert
            with check (
                exists (
                    select 1 from public.companies c
                    where c.id = financial_metrics.company_id
                      and c.user_id = auth.uid()
                )
            )';

        execute 'create policy "financial_metrics_update_own"
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
            )';

        -- Nenhuma policy de delete: mesma regra estrutural de
        -- companies/documents — nunca exclusao fisica.

        -- A tabela ja tinha updated_at mas nenhum trigger para
        -- mante-lo; alinhando com o mesmo padrao de
        -- companies/documents/users (reaproveita a function ja
        -- existente, nao recria).
        execute 'create trigger set_financial_metrics_updated_at
            before update on public.financial_metrics
            for each row
            execute function public.handle_updated_at()';
    end if;
end $$;
