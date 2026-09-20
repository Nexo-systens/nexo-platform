-- =========================================================
-- NEXO PLATFORM
-- Migration 013
-- Document processing attempt authority (Mission 193 Closure B —
-- Database-Authoritative Processing Attempt Ordering)
-- =========================================================

-- =========================================================
-- CONTEXTO
--
-- Mission 193 Closure introduziu `ProcessingAttempt` (attemptId +
-- startedAt, ambos gerados pela aplicação) como a unidade de posse de
-- uma análise sobre um conjunto de documentos. A ordem "mais recente
-- vence" era decidida comparando `attemptStartedAt` (relógio de
-- aplicação) e a POSSE (`metadata.activeAttempt`) era conquistada por
-- um ciclo ler-metadata-em-TypeScript → escrever-metadata-inteiro —
-- dois round-trips separados, não uma única instrução atômica.
--
-- Isso permite exatamente a corrida que esta missão pede para provar
-- (ver tests/financial-ingestion/document-governance/
-- revision-authority.test.ts, "Seção 1"): uma tentativa T1, criada
-- primeiro mas cujo begin() é atrasado por I/O/agendamento, pode ler
-- `metadata` ANTES de T2 já ter escrito sua posse, e escrever por
-- cima de T2 depois — porque a escrita de T1 nunca soube que T2
-- existia. Nenhuma quantidade de comparação em TypeScript resolve
-- isso: o problema é a AUSÊNCIA de uma única instrução atômica no
-- próprio Postgres.
--
-- SOLUÇÃO (menor mecanismo possível — Seção 2/32 da missão: nenhuma
-- fila, nenhum scheduler, nenhuma trava distribuída, nenhum motor de
-- workflow):
--
-- 1. Uma SEQUENCE do Postgres (`document_processing_attempt_seq`) é a
--    única autoridade de ORDEM — `nextval()` é atômico e
--    estritamente crescente sob qualquer concorrência, por definição
--    do próprio Postgres, sem exigir nenhuma lógica adicional.
-- 2. Uma função (`acquire_processing_attempt_revision()`) expõe esse
--    `nextval()` via RPC — chamada UMA VEZ, no início de cada
--    handler de rota, ANTES de qualquer I/O (download/parse/pipeline),
--    exatamente como `beginProcessingAttempt()` já fazia para
--    `attemptId`/`startedAt` (Mission 193 Closure) — a diferença é que
--    agora o número retornado (`revision`) é a autoridade real, não
--    mais o relógio da aplicação (`attemptStartedAt` continua existindo
--    apenas como metadado de diagnóstico, nunca mais comparado).
-- 3. Toda escrita condicional subsequente (posse técnica, finalização,
--    governança) passa a ser UMA ÚNICA instrução `UPDATE ... WHERE
--    <coluna de revisão> < $minhaRevisao` (ou `= $minhaRevisao` para
--    finalização) — nunca ler-decidir-escrever em dois passos. Como a
--    revisão de cada tentativa foi fixada ANTES do atraso (passo 2,
--    antes de qualquer I/O lento), uma tentativa mais antiga nunca
--    pode, mesmo que sua escrita física aconteça por último, obter uma
--    revisão maior que uma tentativa criada depois dela — a condição
--    do próprio UPDATE rejeita a escrita atrasada (0 linhas afetadas,
--    nunca um erro, nunca uma sobrescrita).
--
-- COLUNAS ESTRUTURADAS, NÃO jsonb (Seção 17 da missão): o estado de
-- concorrência agora decide se um documento inteiro é sobrescrito ou
-- não — esconder isso dentro de `metadata` (jsonb, sem schema, sem
-- tipo numérico real) exigiria comparação textual de números
-- (`metadata->>'x' < 'y'`), que é INCORRETA para inteiros de tamanhos
-- diferentes ("9" > "10" como texto) e não pode ser indexada/validada
-- pelo Postgres. `processing_revision`/`governance_revision` como
-- `bigint` reais permitem comparação numérica verdadeira e correta em
-- filtros simples do PostgREST (`.lt()`, `.eq()`, `.or()`), sem
-- necessidade de nenhuma outra função além da já criada.
--
-- `active_attempt_id`/`active_attempt_started_at` continuam existindo
-- apenas como DIAGNÓSTICO (Seção 3: "attemptStartedAt may remain
-- diagnostic metadata. It must not be the canonical distributed
-- ordering primitive") — nunca comparados por nenhuma escrita
-- condicional; apenas `processing_revision`/`governance_revision`
-- decidem posse.
-- =========================================================

-- =========================================================
-- SEQUENCE + RPC
--
-- Nenhuma tabela é lida/escrita por esta função — apenas o contador
-- global da sequence. Por isso não há nenhuma preocupação de
-- isolamento por empresa/RLS aqui (Seção 19/20): o número devolvido,
-- por si só, não concede acesso a nenhum documento de nenhuma empresa
-- — a autorização real continua inteiramente nas policies já
-- existentes de `public.documents` (inalteradas por esta migration),
-- aplicadas no momento em que esse número é USADO para tentar
-- atualizar uma linha. `security definer` apenas para não precisar
-- conceder `usage` na sequence diretamente a `authenticated` (mesmo
-- padrão de `search_path` fixo já usado por `handle_new_user()`,
-- Migration 002).
-- =========================================================

create sequence public.document_processing_attempt_seq;

create function public.acquire_processing_attempt_revision()
returns bigint
language sql
security definer
set search_path = public
as $$
    select nextval('public.document_processing_attempt_seq');
$$;

revoke all on function public.acquire_processing_attempt_revision() from public;
revoke all on function public.acquire_processing_attempt_revision() from anon;
grant execute on function public.acquire_processing_attempt_revision() to authenticated;

comment on function public.acquire_processing_attempt_revision() is
    'Mission 193 Closure B. Única autoridade de ordem entre tentativas de processamento de documentos concorrentes — nextval() é atômico e estritamente crescente por definição do Postgres. Chamada uma vez, no início de cada rota de análise, antes de qualquer I/O.';

-- =========================================================
-- public.documents — novas colunas
--
-- Aditivo, sem reescrita destrutiva: `processing_revision` recebe
-- `default 0`, que o Postgres aplica a todas as linhas existentes sem
-- reescrever a tabela (default constante em coluna nova, mesmo
-- comportamento desde o Postgres 11). `0` é seguro porque a sequence
-- sempre começa em 1 — qualquer tentativa real (`revision >= 1`)
-- supera o valor de qualquer linha pré-existente, então o primeiro
-- `begin()` real sobre um documento antigo sempre consegue tomar posse
-- normalmente. As demais colunas são nullable (nenhum valor ainda
-- existe para linhas antigas) — lidas como "nenhuma tentativa/
-- governança conhecida ainda", nunca um erro.
-- =========================================================

alter table public.documents
    add column processing_revision bigint not null default 0,
    add column active_attempt_id uuid,
    add column active_attempt_started_at timestamptz,
    add column governance_revision bigint;

comment on column public.documents.processing_revision is
    'Mission 193 Closure B. Autoridade de posse do status TÉCNICO (uploaded/processing/processed/failed) — a tentativa que fixou o maior valor aqui é a única autorizada a finalizar (processed/failed). Nunca comparado por igualdade textual/jsonb; sempre bigint real.';

comment on column public.documents.active_attempt_id is
    'Mission 193 Closure B. Diagnóstico apenas (correlação em logs) — identifica qual ProcessingAttempt.attemptId é dono de processing_revision. Nunca usado como autoridade de ordem.';

comment on column public.documents.active_attempt_started_at is
    'Mission 193 Closure B. Diagnóstico apenas — quando a tentativa dona de processing_revision foi criada. Nunca usado como autoridade de ordem (Seção 3 da missão: relógio de aplicação nunca é autoridade canônica).';

comment on column public.documents.governance_revision is
    'Mission 193 Closure B. Autoridade de ordem do desfecho de governança em metadata.governance (D-116) — substitui metadata.governance.attemptStartedAt (relógio de aplicação) como critério de "mais recente". Uma escrita de governança só é aplicada quando sua revisão supera (ou este valor é NULL).';
