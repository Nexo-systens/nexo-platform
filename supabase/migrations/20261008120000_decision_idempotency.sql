-- =========================================================
-- NEXO PLATFORM
-- Migration 019
-- Idempotência governada da criação de Decision humana
-- (Mission 214 — Governed Decision Idempotency Implementation, D-137;
-- desenho da Mission 213)
-- =========================================================

-- =========================================================
-- CONTEXTO
--
-- Até aqui cada confirmação de decisão gravava uma linha nova com id
-- aleatório, sem nenhuma identidade de pedido. A Mission 213 reproduziu
-- no Supabase local, nos quatro fluxos (Recomendação, Manual, Cenário e
-- Executive Chat), que 2 envios simultâneos do mesmo pedido gravavam 2
-- Decisions e 10 envios gravavam 10 — mesmo conteúdo, ids diferentes.
--
-- D-137: cada confirmação carrega uma chave de submissão (UUID gerado
-- pelo formulário para aquela intenção) e o servidor grava junto a
-- impressão canônica e versionada do pedido. Mesma chave + mesmo pedido
-- devolve a mesma Decision; mesma chave + outro pedido é recusada;
-- chave diferente é uma nova decisão. A garantia contra concorrência é
-- o índice único abaixo — nunca um SELECT seguido de INSERT.
-- =========================================================


-- =========================================================
-- 1. COLUNAS — nullable, sem default, sem backfill
--
-- Linhas existentes ficam com as duas colunas nulas: nenhuma chave é
-- inventada para o histórico. Coluna nullable sem default é só
-- metadado (não reescreve a tabela).
-- =========================================================

alter table public.decisions
    add column idempotency_key uuid,
    add column request_fingerprint text;

comment on column public.decisions.idempotency_key is
    'D-137 (Mission 214). Chave de submissão da confirmação que criou esta Decision: UUID gerado pelo formulário para uma intenção, estável nos reenvios do mesmo pedido. Reivindicação do cliente, nunca autoridade — sessão, empresa e conteúdo continuam validados pelo servidor. Nula nas linhas anteriores à Migration 019.';

comment on column public.decisions.request_fingerprint is
    'D-137 (Mission 214). Impressão canônica do pedido, calculada pelo servidor no momento da gravação: "decision-request:v<versão>:" + SHA-256 hex. Liga a chave ao conteúdo: a mesma chave com outra impressão é recusada, nunca devolve esta Decision.';


-- =========================================================
-- 2. INVARIANTES
--
-- Valem também para escrita direta pela API: chave e impressão andam
-- juntas, só existem em Decision humana (ator presente) e a impressão
-- tem formato versionado fixo. Todas são verdadeiras para as linhas
-- existentes (colunas nulas).
-- =========================================================

alter table public.decisions
    add constraint decisions_idempotency_pair_check
        check ((idempotency_key is null) = (request_fingerprint is null)),
    add constraint decisions_idempotency_human_actor_check
        check (idempotency_key is null or human_actor_id is not null),
    add constraint decisions_request_fingerprint_format_check
        check (request_fingerprint is null or request_fingerprint ~ '^decision-request:v[1-9][0-9]*:[0-9a-f]{64}$');


-- =========================================================
-- 3. UNICIDADE ESCOPADA — empresa + ator + chave
--
-- `company_id` primeiro: a chave nunca atravessa empresa (lição de
-- D-126 — um índice único enxerga linhas de todos os tenants por cima
-- do RLS; aqui o escopo começa pela empresa, e a policy de INSERT, que
-- o Postgres avalia ANTES da checagem de unicidade, já exige empresa do
-- próprio usuário). `human_actor_id`: a chave de um ator nunca devolve
-- a Decision de outro. Parcial: linhas sem chave ficam fora do índice.
--
-- O NOME é contrato: a aplicação só trata como reenvio o 23505 deste
-- índice (`isDecisionIdempotencyViolation`), nunca qualquer 23505.
--
-- Sem `concurrently`: a migration roda em transação e a tabela é
-- pequena.
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
--   (D-130/D-131) apaga a linha inteira, como antes.
-- - Grants: as colunas herdam os da tabela.
-- - Nenhuma RPC e nenhum SECURITY DEFINER: um INSERT simples já é
--   atômico, e o índice único decide sozinho quem vence a corrida.
--
-- Reversão (migration corretiva futura, nunca nesta): primeiro publicar
-- o app que não grava as colunas; depois `drop index
-- decisions_idempotency_key_unique`, `drop constraint` dos três checks
-- e `drop column` das duas colunas. Perde só os metadados de
-- idempotência; nenhuma Decision é alterada ou removida.
-- =========================================================
