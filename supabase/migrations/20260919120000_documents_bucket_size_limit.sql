-- =========================================================
-- NEXO PLATFORM
-- Migration 014
-- Documents Storage bucket — limite de tamanho no próprio Storage
-- (Mission 195 — Founding Company Production Onboarding & First
-- Executive Value, Seção 11)
-- =========================================================

-- =========================================================
-- CONTEXTO
--
-- `MAX_FILE_SIZE_BYTES` (20MB, `modules/documents/constants.ts`) e a
-- extensão permitida (`ALLOWED_FILE_EXTENSIONS`) sempre foram
-- verificados apenas no CLIENTE, antes do upload direto do navegador
-- para o Storage (`UploadDocumentSheet.tsx`, D-030/Mission 042) — o
-- bucket em si (Migration 004) nunca teve `file_size_limit` configurado,
-- então um upload direto ao Storage (contornando o formulário) nunca
-- era limitado por tamanho em lugar NENHUM além do JavaScript do
-- cliente. Esta migration fecha essa lacuna no nível mais barato e
-- confiável possível: o PRÓPRIO Storage passa a rejeitar, de forma
-- atômica, qualquer objeto acima de 20MB no bucket `documents` —
-- nenhuma mudança de aplicação necessária, nenhum código novo.
--
-- `allowed_mime_types` DELIBERADAMENTE não é configurado aqui: o
-- `Content-Type` de um upload é declarado pelo NAVEGADOR (`File.type`),
-- não confiável e, em várias combinações reais de sistema operacional/
-- navegador, um CSV genuíno chega como `application/octet-stream`
-- (nenhum tipo detectado) em vez de `text/csv` — restringir por MIME
-- no bucket arriscaria rejeitar uploads legítimos de PDF/CSV reais,
-- um efeito colateral pior que o problema que resolveria (Seção 11 da
-- missão: "narrow... without building a general file security
-- subsystem" — um filtro que quebra o caminho feliz não é estreito, é
-- frágil). A extensão do NOME do arquivo (`nomeOriginal`, determinística,
-- nunca inferida por sniffing) já é validada tanto no cliente
-- (`isAllowedFileExtension()`) quanto agora no servidor
-- (`createDocumentAction()`, mesma missão) — sinal mais confiável que
-- MIME declarado pelo navegador para decidir se um documento vira um
-- registro válido em `public.documents`.
-- =========================================================

update storage.buckets
set file_size_limit = 20971520 -- 20MB, mesmo valor de MAX_FILE_SIZE_BYTES
where id = 'documents';
