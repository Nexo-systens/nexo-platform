-- =========================================================
-- NEXO PLATFORM
-- PROPOSTA DE MIGRATION — NÃO APLICAR
-- Idempotência governada da criação de Decision humana
-- (Mission 213 — Decision Idempotency Architecture & Migration
-- Design; D-137, PROPOSTA — NÃO ATIVADA)
--
-- Este arquivo NÃO está em `supabase/migrations/` de propósito: o
-- CLI do Supabase só aplica o que está lá, então este texto nunca é
-- aplicado por `db push`/`db reset`. Depois da aprovação humana, a
-- Mission 214 copia este conteúdo, sem mudar a semântica, para
-- `supabase/migrations/<timestamp>_decision_idempotency.sql`.
--
-- Desenho completo: `docs/02_ENGINEERING/DECISION_IDEMPOTENCY_DESIGN.md`.
-- =========================================================

-- =========================================================
-- CONTEXTO
--
-- Hoje cada confirmação de decisão grava uma linha nova com id
-- aleatório (`randomUUID()`), sem nenhuma chave de pedido. A Mission
-- 213 reproduziu no Supabase local, nos quatro fluxos (Recomendação,
-- Manual, Cenário e Executive Chat), que 2 envios simultâneos do
-- mesmo pedido gravam 2 Decisions e 10 envios gravam 10, todas com o
-- mesmo conteúdo e ids diferentes. Só o bloqueio de duplo clique no
-- navegador (`submittingRef`) reduz o risco.
--
-- Decisão (D-137, proposta): cada confirmação carrega uma chave de
-- submissão (UUID gerado pelo formulário, estável entre reenvios)
-- e o servidor grava junto a impressão canônica do pedido. A mesma
-- chave com o mesmo pedido devolve a mesma Decision; a mesma chave com
-- pedido diferente é recusada; chave diferente é uma nova decisão.
-- A garantia contra concorrência é o índice único abaixo, nunca um
-- SELECT seguido de INSERT.
-- =========================================================


-- =========================================================
-- 1. COLUNAS — nullable, sem default, sem backfill
--
-- Linhas existentes ficam com as duas colunas nulas: nenhuma chave é
-- inventada para o histórico. Adicionar coluna nullable sem default é
-- só metadado (não reescreve a tabela).
-- =========================================================

alter table public.decisions
    add column idempotency_key uuid,
    add column request_fingerprint text;

comment on column public.decisions.idempotency_key is
    'D-137 (Mission 213/214). Chave de submissão da confirmação que criou esta Decision: UUID gerado pelo formulário, estável entre reenvios do mesmo pedido. É uma reivindicação do cliente, nunca autoridade — sessão, empresa e conteúdo continuam validados pelo servidor. Nula nas linhas anteriores à ativação.';

comment on column public.decisions.request_fingerprint is
    'D-137 (Mission 213/214). SHA-256 (hex) do pedido canônico calculado pelo servidor no momento da gravação. Liga a chave ao conteúdo: a mesma chave com outra impressão é recusada, nunca devolve esta Decision.';


-- =========================================================
-- 2. INVARIANTES
--
-- Valem também para escrita direta pela API (fora da Server Action):
-- chave e impressão andam juntas, só existem em Decision humana e a
-- impressão tem formato fixo. Todas são verdadeiras para as linhas
-- existentes (colunas nulas), então a validação não falha.
-- =========================================================

alter table public.decisions
    add constraint decisions_idempotency_pair_check
        check ((idempotency_key is null) = (request_fingerprint is null)),
    add constraint decisions_idempotency_human_actor_check
        check (idempotency_key is null or human_actor_id is not null),
    add constraint decisions_request_fingerprint_format_check
        check (request_fingerprint is null or request_fingerprint ~ '^[0-9a-f]{64}$');


-- =========================================================
-- 3. UNICIDADE ESCOPADA — empresa + ator + chave
--
-- `company_id` primeiro: a chave nunca atravessa empresa (lição de
-- D-126 — um índice único enxerga linhas de todos os tenants por cima
-- do RLS; aqui o escopo começa pela empresa, e a policy de INSERT, que
-- o Postgres avalia ANTES da checagem de unicidade, já exige que a
-- empresa seja do próprio usuário). `human_actor_id`: a chave de um
-- ator nunca devolve a Decision de outro, inclusive se um dia houver
-- mais de uma pessoa por empresa. Parcial: linhas sem chave (todo o
-- histórico) ficam fora do índice.
--
-- Sem `concurrently`: a migration roda em transação e a tabela é
-- pequena (o Pilot não tem nenhuma Decision na Mission 212).
-- =========================================================

create unique index decisions_idempotency_key_unique
    on public.decisions (company_id, human_actor_id, idempotency_key)
    where idempotency_key is not null;


-- =========================================================
-- 4. RLS, GRANTS E FUNÇÕES — nenhuma mudança
--
-- - INSERT: `decisions_insert_own` (Migration 017) continua exigindo
--   `human_actor_id = auth.uid()` (ou nulo), empresa do próprio
--   usuário e ainda aberta, diagnóstico e revisão da mesma empresa.
-- - SELECT: `decisions_select_own` continua restrita às empresas do
--   usuário — a busca por chave só enxerga as próprias linhas.
-- - UPDATE/DELETE: continuam sem policy. Chave e impressão são
--   imutáveis como o resto da linha; a purga de empresa encerrada
--   (D-130/D-131) apaga a linha inteira, como hoje.
-- - Grants: as colunas herdam os da tabela; nada novo.
-- - Nenhuma RPC e nenhum SECURITY DEFINER: um INSERT simples já é
--   atômico, e o índice único decide sozinho quem vence a corrida.
-- =========================================================


-- =========================================================
-- REVERSÃO (não faz parte da migration — referência para uma
-- migration corretiva futura, se um dia for preciso)
--
-- Ordem: primeiro publicar a versão do app que não grava as colunas;
-- só depois:
--
--   drop index if exists public.decisions_idempotency_key_unique;
--   alter table public.decisions
--       drop constraint if exists decisions_request_fingerprint_format_check,
--       drop constraint if exists decisions_idempotency_human_actor_check,
--       drop constraint if exists decisions_idempotency_pair_check,
--       drop column if exists request_fingerprint,
--       drop column if exists idempotency_key;
--
-- Perde só os metadados de idempotência; nenhuma Decision é alterada
-- ou removida.
-- =========================================================
