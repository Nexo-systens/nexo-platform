-- =========================================================
-- NEXO PLATFORM
-- Migration 015
-- Documents Storage bucket — policy de DELETE (Mission 197 — Production
-- Surface & Deployment Closure Gate, Seção 6/7/8)
-- =========================================================

-- =========================================================
-- CONTEXTO
--
-- Migration 004 (`20260719205643_documents_core.sql`) criou o bucket
-- `documents` com policies de SELECT/INSERT em `storage.objects`, mas
-- deliberadamente SEM policy de UPDATE/DELETE — o comentário original
-- dizia "nesta fase o arquivo físico nunca é sobrescrito nem removido
-- (soft delete é só a linha em public.documents)".
--
-- A Mission 195/195 Closure introduziu `removeStorageObject()`
-- (`modules/documents/services/document.service.ts`) — limpeza em
-- "melhor esforço" de um objeto do Storage quando `createDocumentAction()`
-- rejeita um upload (extensão não permitida, conteúdo inválido, ou
-- falha ao inserir `public.documents`) DEPOIS que os bytes já chegaram
-- ao bucket (upload direto do cliente, D-030/Mission 042). Sem uma
-- policy de DELETE, essa chamada é um no-op silencioso sob RLS — a
-- Mission 196 confirmou isso lendo todas as migrations e encontrou
-- nenhuma policy de DELETE em `storage.objects` em lugar nenhum.
--
-- Esta migration fecha exatamente essa lacuna — nunca mais, nunca
-- menos.
-- =========================================================

-- =========================================================
-- MODELO DE MENOR PRIVILÉGIO (Seção 6 da missão)
--
-- Convenção de path já estabelecida pela Migration 004 e já usada
-- pelas policies de SELECT/INSERT existentes:
--   company/{companyId}/{documentId}/{arquivo}
-- `(storage.foldername(name))` é 1-indexado: [1]='company',
-- [2]=companyId, [3]=documentId.
--
-- Autoridade de empresa (condição 1) reaproveita EXATAMENTE o mesmo
-- predicado já usado por `documents_storage_select_own`/
-- `documents_storage_insert_own` — nunca uma nova convenção: um objeto
-- só pode ser removido por quem tem uma `company` própria
-- (`c.user_id = auth.uid()`) cujo `id` bate com o segmento [2] do
-- path. Isso prova:
--   (A) o dono de uma empresa pode limpar seu próprio upload rejeitado;
--   (B) um usuário nunca pode remover o objeto de outro usuário — o
--       path dele nunca resolve para uma empresa cujo user_id seja o
--       chamador;
--   (C) um path de empresa alheia nunca pode ser usado para remover o
--       objeto de outra empresa, pelo mesmo motivo de (B).
--
-- ÓRFÃO, NUNCA ACEITO (condição 2, adicionada após revisão própria
-- desta missão — Seção 6: "if current object paths cannot safely
-- express ownership, do not invent a weak policy"). A condição 1
-- sozinha provaria autoridade de EMPRESA, mas não distinguiria "objeto
-- órfão que nunca virou um `public.documents`" de "objeto de um
-- documento já aceito/persistido da própria empresa" — permitindo, em
-- tese, que o dono de uma empresa apagasse fisicamente os bytes de um
-- documento já aceito chamando a API de Storage diretamente (fora do
-- fluxo de `removeStorageObject()`), o que violaria o invariante já
-- documentado pela Migration 004: "exclusão física nunca é permitida,
-- mesmo diante de bug de aplicação — 'Excluir' na interface é sempre
-- um update em deleted_at". `and not exists (select 1 from
-- public.documents d where d.storage_path = name)` fecha exatamente
-- essa lacuna: só é deletável um objeto cujo path NÃO corresponde a
-- nenhuma linha de `public.documents` — ou seja, estruturalmente
-- IMPOSSÍVEL deletar os bytes de um documento aceito, mesmo pelo
-- próprio dono, mesmo chamando a API de Storage diretamente. Um
-- documento soft-deleted (`deleted_at` preenchido) AINDA tem uma linha
-- em `public.documents` — permanece protegido pela mesma condição,
-- deliberadamente (soft delete nunca autoriza exclusão física).
--
-- Nenhuma policy `using (true)`/`for delete to authenticated` genérica
-- foi cogitada — as duas condições já provam, juntas, autoria de
-- empresa E natureza de órfão, sem depender de nada além do que já
-- existe em produção desde a Migration 004/documents_core.
-- =========================================================

create policy "documents_storage_delete_own"
    on storage.objects
    for delete
    using (
        bucket_id = 'documents'
        and exists (
            select 1 from public.companies c
            where c.id::text = (storage.foldername(name))[2]
              and c.user_id = auth.uid()
        )
        and not exists (
            select 1 from public.documents d
            where d.storage_path = name
        )
    );

comment on policy "documents_storage_delete_own" on storage.objects is
    'Mission 197. Least-privilege, duas condições: (1) segmento [2] do path (company/{companyId}/...) resolve a uma empresa do próprio auth.uid(); (2) nenhuma linha de public.documents referencia este path (nunca um documento aceito/persistido, mesmo soft-deleted). Existe exclusivamente para que removeStorageObject() (limpeza de upload rejeitado, Mission 195/195 Closure) deixe de ser um no-op silencioso sob RLS. Estruturalmente incapaz de apagar os bytes de um documento já aceito — mesmo pelo próprio dono, mesmo via API de Storage direta — preservando o invariante de imutabilidade física já documentado pela Migration 004.';
