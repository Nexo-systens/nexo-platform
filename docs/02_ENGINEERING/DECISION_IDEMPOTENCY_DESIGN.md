# Idempotência governada da criação de Decision — desenho

> **Status: SCHEMA ATIVO NO NEXO PILOT — DEPLOY DO APP PENDENTE (`PILOT_SCHEMA_ACTIVE / APP_DEPLOY_PENDING`).** Desenho da Mission 213 (D-137), implementado na Mission 214 (D-138). Migration 019 aplicada no NEXO Pilot na Mission 215 (2026-10-09, autorização humana explícita; 19/19). O código de `develop` grava as colunas novas: só pode ser implantado contra um banco com a Migration 019 — o Pilot agora a tem. Nenhuma Decision real ou sintética foi criada no Pilot.

Arquivos oficiais (a proposta e o rascunho da Mission 213 foram promovidos a eles e removidos de `docs/`):

- `supabase/migrations/20261008120000_decision_idempotency.sql` — Migration 019;
- `supabase/tests/database/decision_idempotency.test.sql` — pgTAP (34 asserções);
- `modules/decisions/lib/decisionRequest.ts`, `decisionRequestFingerprint.ts`, `decisionIdempotency.ts`, `useDecisionIdempotencyKey.ts`;
- `modules/decisions/services/decision-persistence.service.ts` (`saveHumanDecision`, `findDecisionBySubmission`);
- `tests/production-surface/mission-214-decision-idempotency.test.ts` (CI) e `tests/decisions-local/` (Supabase local).

**Refinamentos da Mission 214 sobre este desenho** (D-138; a semântica não muda):

- a impressão grava a própria versão: `decision-request:v1:<64 hex>` (check `^decision-request:v[1-9][0-9]*:[0-9a-f]{64}$`), em vez de 64 hex com a versão só dentro do hash;
- a chave do formulário é **renovada quando o pedido canônico muda** (§8 abaixo dizia "estável na edição"); o servidor continua recusando mesma chave + outra impressão;
- empresa encerrada: o reenvio responde como empresa inexistente (regra vigente de D-130), confirmado na implementação.

---

## 1. Problema

Toda confirmação de decisão grava uma linha nova em `public.decisions` com id aleatório (`randomUUID()`), e nada no pedido identifica a confirmação. O servidor não distingue "a mesma confirmação chegando de novo" de "uma decisão nova".

O que reduz o risco hoje é só o bloqueio síncrono de duplo clique no formulário (`submittingRef`, Mission 153; paridade registrada em D-096 e D-135). Ele não cobre:

- reenvio do mesmo pedido quando a resposta se perde: os dois formulários respondem a uma exceção com "Erro inesperado ao registrar a decisão. Tente novamente.", então o próprio produto convida a reenviar;
- qualquer camada que repita o pedido HTTP;
- um cliente que não seja a interface.

### Reprodução (Supabase local, dados sintéticos)

A interface real montou o pedido em cada fluxo. No clique de confirmação, um interceptador repetiu o mesmo pedido de Server Action N vezes ao mesmo tempo.

| Fluxo (ação) | Envios simultâneos | Respostas de sucesso | Decisions gravadas | Ids distintos | Conteúdo distinto |
|---|---|---|---|---|---|
| Recomendação (`createHumanDecisionAction`) | 2 / 10 | 2 / 10 | 2 / 10 | 2 / 10 | 1 / 1 |
| Manual (`createHumanDecisionAction`, sem vínculo) | 2 / 10 | 2 / 10 | 2 / 10 | 2 / 10 | 1 / 1 |
| Cenário — Scenario Lab (`createScenarioDecisionAction`) | 2 / 10 | 2 / 10 | 2 / 10 | 2 / 10 | 1 / 1 |
| Executive Chat (`createScenarioDecisionAction`, `proposedBy`) | 2 / 10 | 2 / 10 | 2 / 10 | 2 / 10 | 1 / 1 |

- **Mesmo ator, mesma origem:** em todos os casos, as linhas têm o mesmo ator e a origem estrutural correta (com diagnóstico e recomendação, sem vínculo, cenário, ou cenário com `proposedBy: "executive-chat"`).
- **Controle:** um envio normal, sem interceptador, gravou 1 linha.
- **Erro no console do navegador:** apareceu só com o interceptador. O cliente React lê uma resposta clonada, então é artefato do roteiro, não do servidor.

**Efeito a jusante.** Cada duplicata é uma Decision válida e independente. Execução, resultado humano, observação financeira e aprendizado são presos a `decision_id`, com ids aleatórios e sem unicidade. Por isso cada duplicata pode ganhar sua própria cadeia. Também inflaria:

- a contagem de decisões do padrão de recomendação (D-083);
- a evidência do Knowledge, que conta learning records distintos (D-073).

---

## 2. Premissas auditadas

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Entrypoints de servidor que criam Decision | **2**: `createHumanDecisionAction()` (Recomendação, decisão ligada ao diagnóstico e Manual) e `createScenarioDecisionAction()` (Scenario Lab, comparação e os dois cartões do Executive Chat). Nenhuma rota de API grava decisão; o Decision Engine determinístico e a validação sintética não persistem. |
| 2 | Mesma composição? | Sim: `createHumanDecision()`. O cenário passa por `composeScenarioDecision()`. |
| 3 | Mesma persistência? | Sim: `saveHumanDecision()`, um único INSERT. |
| 4 | Transação? | Só o próprio INSERT, que é atômico; não há transação de vários passos nem RPC. |
| 5 | Unicidade relevante? | Nenhuma: só a PK sobre um id aleatório por pedido e as FKs. |
| 6 | Id de pedido/ação? | Nenhum. O id da Server Action identifica a função, não o pedido. |
| 7 | Impressão da Recomendação reutilizável? | Não. `deriveRecommendationFingerprint()` (D-083) é a forma estrutural, sem empresa e compartilhada entre decisões. O par (diagnóstico, item) identifica a fonte, e várias decisões por recomendação são legítimas (D-064, cenário G). |
| 8 | Cenário tem identidade determinística? | Só a âncora financeira (`ScenarioBaselineIdentity`), que identifica a verdade financeira, não a confirmação. Duas decisões sobre o mesmo cenário podem ser legítimas. |
| 9 | Proposta do Chat tem identidade? | Não: a resposta e as ações são efêmeras (D-103/D-104); só carregam a âncora. |
| 10 | Decisão manual tem identidade? | Não. |
| 11 | Dois pedidos simultâneos | Duas Decisions (reproduzido: 2→2 e 10→10 nos quatro fluxos). |
| 12 | Reenvio HTTP | Uma Decision nova por reenvio. |
| 13 | Gravou e a resposta se perdeu | A Decision existe; a tela mostra "Erro inesperado… Tente novamente."; o novo clique grava outra. |
| 14 | O 2º pedido detecta o 1º? | Não: não há chave nem busca. |

---

## 3. Semântica

**A idempotência representa a submissão, nunca a semântica eterna da decisão.**

- **Reenvio da mesma confirmação** (mesma chave, mesmo pedido canônico): devolve a mesma Decision, como sucesso.
- **Mesma chave com pedido diferente:** recusa, sem gravar.
- **Chave diferente:** nova decisão legítima, mesmo que o conteúdo seja igual.

O desenho nunca deduplica por texto, empresa, período, recomendação, cenário ou janela de tempo. Duas decisões idênticas registradas em momentos diferentes continuam sendo duas.

**Unidade de intenção = uma instância do formulário de confirmação**, do primeiro clique em "Registrar decisão" até o sucesso.

- Duplo clique e reenvio no mesmo formulário usam a mesma chave.
- Duas abas, ou dois formulários, são duas intenções: as duas decisões aparecem no histórico, e isso é aceito.

---

## 4. Fronteira de confiança

A chave vem do navegador e é uma **reivindicação de identidade do pedido**, nunca autoridade.

- O servidor continua validando sessão, empresa (RLS e empresa aberta), origem, diagnóstico/revisão/recomendação, âncora de cenário com recomputação, parâmetros e ator — exatamente como hoje.
- A chave só decide uma coisa: "este pedido já foi gravado?".
- **Fabricar uma chave não dá acesso a nada:** a busca e a unicidade ficam restritas à própria empresa e ao próprio ator.
- **Reaproveitar uma chave com outro conteúdo** só produz recusa.

Esta é a mesma fronteira de D-096. O próprio dono, contornando a interface, já pode gravar decisões arbitrárias pela API; a idempotência não amplia nem reduz isso.

---

## 5. Alternativas avaliadas

| Opção | Correção | Complexidade | RLS / tenants | Corrida | Auditoria | Migration | Veredito |
|---|---|---|---|---|---|---|---|
| Impressão determinística do conteúdo como chave | **Errada**: deduplica para sempre decisões legítimas repetidas; com janela de tempo vira heurística e continua sujeita à corrida | baixa | ok | não resolve sem bucket | fraca | sim | rejeitada |
| Token emitido pelo servidor ao mostrar a proposta | Sem persistência ou assinatura, é só outra reivindicação do cliente. Com tabela de propostas pendentes, é o ciclo de vida expirável rejeitado em D-096; com HMAC, é um segredo novo, também rejeitado em D-096 | alta | ok | depende de unicidade igual | boa | sim | rejeitada |
| **A** — só `idempotency_key` em `decisions` | Resolve o reenvio, mas não detecta "mesma chave, outro conteúdo" (devolveria outra Decision como sucesso) | baixa | ok | ok | média | sim | insuficiente |
| **B** — `idempotency_key` + `request_fingerprint` em `decisions`, unicidade (empresa, ator, chave) | **Correta** em todos os casos de §9 | baixa | sem policy nova; RLS antes do índice | índice único | boa: chave e impressão na própria linha, consultáveis | aditiva, nullable | **recomendada** |
| **C** — tabela separada de registros de idempotência | Correta, mas exige gravar duas linhas atomicamente (RPC/transação), com tabela, RLS e grants novos | alta | policy nova | precisa de RPC | boa | tabela nova | rejeitada (B dá a mesma garantia com uma linha) |
| **D** — RPC/transação especializada | Não acrescenta correção: um INSERT já é atômico e o índice decide a corrida. Acrescenta superfície de API e a tentação de SECURITY DEFINER | média | risco de definer | índice igual | igual | função nova | rejeitada |
| **E** — id da Decision derivado de (empresa, ator, chave), com a PK como unicidade | **Correta e sem migration** (ver §6) | baixa | sem policy nova | PK | fraca: chave e impressão não ficam gravadas | **nenhuma** | não recomendada; alternativa sem migration |

---

## 6. Achado: existe uma solução correta sem migration (opção E)

A Mission 213 foi aberta com a premissa (D-135) de que deduplicar no servidor "exigiria um contrato persistido novo". **Isso não é estritamente verdade**, e o achado é registrado aqui antes de qualquer implementação, como pede a missão.

**Como funcionaria a opção E:**

- `decisions.id = UUID(SHA-256(empresa | ator | chave))`;
- a chave primária já é um índice único global, e o INSERT de um mesmo id falha com `23505` em `decisions_pkey`;
- o servidor relê pelo id, sob RLS, e compara o pedido.

O precedente é direto: `Knowledge.id` determinístico mais `23505` tratado como "já existe" (D-073, `saveKnowledge()`). E `createHumanDecision()` já recebe o id como parâmetro (D-064).

O modelo local (§13) usa exatamente esse mecanismo.

**Por que não é a recomendação:**

1. **Identidade misturada.** O id da entidade passa a ser função de uma reivindicação do cliente. O que identifica a confirmação vira o que identifica a decisão.
2. **Ligação com o conteúdo frágil.** Sem coluna, ou a impressão vai para dentro do `decision jsonb` imutável (metadado de transporte no objeto de domínio), ou o pedido é reconstruído a partir da Decision gravada (todo campo novo precisa ser espelhado nos dois lados, e esquecer um enfraquece a recusa sem ninguém perceber).
3. **Auditoria.** Nada na linha diz que ela nasceu de uma submissão com chave, nem qual.
4. **Erro sobrecarregado.** `23505` em `decisions_pkey` passa a significar "reenvio".

**Quando faria sentido:** se a migration não for aprovada, E é a alternativa correta sem schema. A decisão é humana.

---

## 7. Arquitetura recomendada (opção B)

### 7.1 Banco

As colunas são nulas no histórico (sem backfill) e nunca entram no `decision jsonb`; o objeto `Decision` do domínio não muda.

```
decisions.idempotency_key      uuid  null
decisions.request_fingerprint  text  null    -- SHA-256 hex do pedido canônico, calculado no servidor
check   (idempotency_key is null) = (request_fingerprint is null)
check   idempotency_key is null or human_actor_id is not null
check   request_fingerprint is null or request_fingerprint ~ '^[0-9a-f]{64}$'
unique  (company_id, human_actor_id, idempotency_key) where idempotency_key is not null
```

SQL oficial: `supabase/migrations/20261008120000_decision_idempotency.sql` (Migration 019).

### 7.2 Escopo da unicidade

`company_id, human_actor_id, idempotency_key`:

- **Empresa primeiro.** A chave nunca atravessa empresa. A policy de INSERT, que o Postgres avalia **antes** da checagem de unicidade, já exige que a empresa seja do próprio usuário. Por isso uma colisão com linha de outro tenant é recusada por RLS (`42501`), nunca por `23505`: não há oráculo entre tenants (lição de D-126; provado no pgTAP, caso `a_collide_into_b`).
- **Ator.** A chave de uma pessoa nunca devolve a decisão de outra. Hoje cada empresa tem um único dono (`companies.user_id`), então ator = dono; o escopo já serve para empresas com mais de uma pessoa.
- **Ator nulo** (Decision determinística, não persistida hoje) nunca tem chave (check).
- **Caminhos de serviço/operador:** a autoridade de offboarding (D-131) nunca cria decisão; a purga de empresa encerrada apaga a linha inteira, com chave e tudo.

### 7.3 Impressão canônica do pedido

Função pura nova, em `modules/decisions/lib/`:

```
SHA-256( JSON canônico { v: 1, entrypoint, companyId, humanActorId, payload } )
```

- **Ordem de chaves:** objetos com chaves ordenadas recursivamente; arrays mantêm a ordem; ausente vira `null`.
- **Valores aceitos:** só primitivos, arrays e objetos simples. Qualquer outro valor recusa o pedido como inválido, e a função nunca lança exceção.
- **`entrypoint`:** `"human-decision"` ou `"scenario-decision"`. A origem estrutural (Recomendação, Manual, Cenário, Chat) já está no `payload`, então não há enum global de origem.
- **`payload` de `human-decision`:**
  - type, priority, confidence, title, description, rationale;
  - diagnosisId, reviewId, recommendationId;
  - recommendations, reasonings, contexts, evidences;
  - é o comando montado pelo servidor, menos o ator.
- **`payload` de `scenario-decision`:**
  - evaluatedBaselineIdentity, request, alternative, proposedBy;
  - type, priority, confidence, title, description, rationale.
- **Fora da impressão:** id, instantes e números recomputados pelo servidor.

### 7.4 Ordem no servidor

Vale para as duas ações. Os passos 6–7 já existem hoje.

1. Sessão (`getCurrentUser`).
2. Formato da chave (`isUuid`, D-128). Ausente ou malformada: recusa ("Confirmação inválida. Recarregue a página e tente novamente."), sem tocar o banco.
3. Empresa sob RLS e ainda aberta (`getCompanyById`).
4. Impressão do pedido (pura).
5. **Busca pela chave** (empresa, ator, chave), sob RLS:
   - encontrada com a mesma impressão: devolve a Decision gravada, `replayed: true`;
   - encontrada com outra impressão: recusa (`stage: "idempotency"`).

   Esta busca é atalho e UX, **não a garantia**.
6. Validação completa:
   - diagnóstico, revisão e recomendação da mesma empresa;
   - ou baseline canônico, identidade exata com recusa `stale-baseline`, e recomputação.
7. Composição (`createHumanDecision`, id aleatório).
8. **INSERT** com chave e impressão:
   - ok: `created`;
   - `23505` **nomeado** `decisions_idempotency_key_unique` (mesmo padrão de `isTenantScopedCnpjViolation`): relê pela chave e segue a regra do passo 5;
   - qualquer outro erro: lança, como hoje.
9. **Cenário/Chat — releitura tardia.** Se o passo 6 recusar por baseline ou verdade financeira, busca pela chave mais uma vez. Se outro pedido com a mesma chave acabou de gravar legitimamente, devolve essa Decision. **Nunca grava.**

**Regra da âncora (D-095/D-135).** Antes da primeira gravação, todo pedido passa pela recusa de baseline desatualizado: o passo 5 não encontra nada e o passo 6 roda inteiro. Depois que a Decision foi gravada por um pedido que passou por todas as regras, o reenvio a devolve, mesmo que uma análise nova tenha chegado depois. Nenhum reenvio antigo grava contra uma verdade que já mudou.

### 7.5 Resposta ao navegador

- **Reenvio:** `{ success: true, decision, replayed: true }`. A interface trata como sucesso ("Decisão registrada com sucesso.") e nunca mostra "falhou porque já existe".
- **Mesma chave com outro conteúdo:** `{ success: false, stage: "idempotency", error: "Esta confirmação já foi usada para registrar outra decisão. Recarregue a página para ver as decisões registradas." }`. A busca e a unicidade são da própria empresa e do próprio ator, então a mensagem nunca revela nada de outro tenant.

---

## 8. Ciclo de vida da chave (interface)

Vale para `HumanDecisionSection` e `ScenarioDecisionForm`. Este segundo é o formulário único de Scenario Lab, comparação e cartões do Chat.

- **Nascimento:** `idempotencyKeyRef.current ??= crypto.randomUUID()` no primeiro clique em "Registrar decisão", nunca durante a renderização.
- **Estável:** a chave se mantém em reenvios, em erros e em edição dos campos. Se a 1ª tentativa gravou sem resposta e a pessoa editar, o servidor recusa como "outra decisão" em vez de duplicar.
- **Renovada** (`null`):
  - depois de sucesso (`created` ou `replayed`), porque o formulário se reinicia ou dá lugar à confirmação;
  - depois de `stage: "idempotency"`, junto com `router.refresh()`, para a pessoa ver a decisão já gravada antes de decidir de novo.
- **Mensagem de exceção:** passa a dizer que reenviar é seguro, por exemplo "Não foi possível confirmar o registro. Tente novamente — uma decisão já registrada não será duplicada."

---

## 9. Casos de falha

| Caso | Comportamento |
|---|---|
| A. Grava, resposta perdida, reenvio | Passo 5 encontra com a mesma impressão: devolve a mesma Decision, como sucesso. |
| B. Dois pedidos simultâneos | Os dois passam pelo passo 5 sem achar nada e validam. O índice deixa um INSERT vencer; o outro espera o commit do vencedor, recebe `23505`, relê e devolve a mesma Decision. **Provado:** 10 conexões, 1 linha, 9 × `23505`; modelo pelo app: 10 respostas, 1 Decision. |
| C. Falha antes do INSERT | Nada gravado; o reenvio valida do zero. Se a 1ª transação inseriu e desfez, a que espera grava (provado). |
| D. INSERT ok, a interface falha depois | Uma Decision; o reenvio devolve a mesma. |
| E. Reenvio minutos depois, com análise nova | Gravada antes: devolve (sem falso "análise mudou"). Nunca gravada: a regra de baseline recusa (correto: perguntar de novo). |
| F. Chave reaproveitada com outro conteúdo | Passo 5 ou 8 encontra outra impressão: recusa, nada gravado. |
| G. Outra sessão ou outra pessoa | Mesmo ator, nova sessão: mesmo espaço de chaves, devolve se o pedido for igual. Outro ator: espaço próprio; nunca enxerga nem recebe a decisão de outro. |
| H. Outra empresa | Espaço próprio. A RLS recusa escrita fora da própria empresa antes do índice; a leitura de outra empresa é vazia. |

---

## 10. Efeito em Outcome, Learning, Knowledge e relatório

- **Uma confirmação, uma linha.** Execução, resultado humano, observação financeira, aprendizado e Knowledge apontam para essa linha. Um reenvio nunca cria um `decision_id` novo, então nunca abre uma segunda cadeia; a contagem de D-083 e a evidência de D-073 deixam de ser infladas por reenvio. Nenhum desses contratos muda.
- **Relatório (D-133):** continua lendo as decisões pela linhagem (diagnóstico ou identidade do cenário) e vê a única linha. Nada de deduplicar no renderer: a integridade nasce na escrita.
- **Fora do escopo:** as ações que criam execução, resultado, observação e aprendizado têm o mesmo padrão sem chave (§15).

---

## 11. RLS, grants e SECURITY DEFINER

- **Nenhuma policy nova.**
  - `decisions_insert_own` (Migration 017) cobre as colunas novas: ator = `auth.uid()`, empresa própria e aberta.
  - `decisions_select_own` restringe a busca às próprias linhas.
  - Sem UPDATE/DELETE, chave e impressão são imutáveis.
- **Sem enumeração:** a busca filtra pela própria empresa e pelo próprio ator, e a RLS de leitura já esconde o resto. Não há conflito observável de outra empresa, porque a RLS de escrita vem antes do índice. Um ator também não troca de empresa: a policy de INSERT exige posse.
- **Grants:** nada novo.
- **SECURITY DEFINER: desnecessário.** INSERT simples sob a sessão do usuário, atômico, com o índice decidindo a corrida. Nenhuma RPC.

---

## 12. Migration e implantação

**Compatibilidade.**

- Colunas nullable sem default (só metadado) e sem backfill; nenhuma chave inventada para o histórico.
- Os três checks são verdadeiros para linhas antigas.
- O índice parcial exclui as linhas sem chave.
- Provado num banco descartável com linhas existentes, inclusive duplicatas e ator nulo: aplicação sem erro e linhas byte a byte iguais.

**Ordem de implantação.**

1. Migration no ambiente (local, depois Pilot com autorização).
2. Deploy do app que grava as colunas.

O app atual com o schema novo funciona, porque as colunas são nulas e opcionais. O app novo com o schema antigo **quebra** a criação de decisão: o PostgREST recusa coluna desconhecida. Por isso o schema vai primeiro.

**Reversão.** Primeiro o app sem as colunas, depois `drop index` / `drop constraint` / `drop column` (SQL no fim da migration proposta, testado no banco descartável). Perde só os metadados de idempotência.

**Tipos.** `types/database.ts` é mantido à mão: acrescentar as duas colunas em Row, Insert e Update.

---

## 13. Prova local (Mission 213)

Tudo foi feito no Supabase local ou num Postgres descartável; nada no Pilot.

1. **Corrida atual (app real):** a tabela de §1.
2. **Migration proposta num Postgres descartável.**
   - **Banco:** container próprio, mesma imagem do Supabase local, nenhum banco do projeto. O schema `public` foi copiado do banco local (só leitura), com `auth.uid()` alinhado à definição real.
   - **Aplicação:** aplica sobre linhas existentes sem alterá-las.
   - **Reversão:** funciona.
   - **pgTAP de rascunho:** 30/30.
   - **10 conexões no mesmo instante, mesma (empresa, ator, chave):** 1 linha, 9 × `23505` com o nome do índice.
   - **1ª transação insere e desfaz:** a 2ª espera cerca de 2 s e grava.
   - **1ª insere e confirma:** a 2ª espera e recebe `23505`.
3. **Modelo do algoritmo pelo caminho do app** (supabase-js → PostgREST → RLS, sessão do dono, Supabase local; a PK faz o papel do índice, como na opção E):
   - 10 pedidos simultâneos: nenhum achou nada na busca prévia; 1 INSERT venceu; 9 receberam `23505`, releram e devolveram a mesma Decision (10 sucessos, 1 id, 1 linha);
   - reenvio depois: devolve pela busca;
   - mesma chave com outro conteúdo: recusa;
   - outra chave com o mesmo conteúdo: nova Decision.

   O modelo mostra que a busca prévia não protege nada sob corrida: quem garante é o índice.

Os roteiros ficaram fora do repositório (dependem de Chrome, do app local e de dados sintéticos); os números estão em `docs/ENGINEERING_LOG.md`.

---

## 14. Plano de testes da Mission 214

**CI (`tests/production-surface`):**

- **impressão:**
  - determinística, independente da ordem de chaves e sensível a cada campo;
  - separada por entrypoint e presa a empresa e ator;
  - recusa valores fora de JSON simples;
- **estrutura:**
  - as duas ações buscam pela chave antes de validar e gravam com chave e impressão;
  - `saveHumanDecision()` exige a submissão;
  - nenhum outro INSERT em `decisions`;
  - continua havendo só os dois chamadores de `createHumanDecision()`;
  - a releitura tardia nunca grava;
- **formulários:**
  - mandam `idempotencyKey` de um ref;
  - renovam só depois de sucesso ou `idempotency`;
  - não geram chave durante a renderização;
- **classificação de erro:** só o `23505` do índice nomeado vira reenvio.

**Supabase local (`tests/reports-local`, sessões reais):**

- mesmo pedido duas vezes em sequência, e 10 em paralelo;
- resposta perdida com reenvio;
- mesma chave com outro pedido;
- outra chave com o mesmo pedido;
- mesma chave em outro tenant, e escrita em empresa alheia (`42501`, nunca `23505`);
- outro ator com a mesma chave;
- empresa encerrada;
- cenário desatualizado antes da 1ª gravação (recusa) e depois dela (devolve);
- Recomendação, Cenário, Chat e Manual de ponta a ponta;
- regressão de Outcome e relatório.

O núcleo de INSERT, releitura e comparação deve receber o `SupabaseClient` por parâmetro, para ser testável com sessão local.

**pgTAP:** `supabase/tests/database/decision_idempotency.test.sql` (feito na Mission 214), `npx supabase test db`.

**Corrida pela interface:** repetir a reprodução de §1 com a solução. Esperado: 10 envios, 10 sucessos, 1 Decision em cada fluxo.

---

## 15. Limitações e riscos

**Limitações.**

- **Escopo da chave:** duas abas, ou dois formulários, são duas intenções (por desenho).
- **Escrita direta pela API:** quem contorna a ação ainda grava o que quiser na própria empresa (D-096). Os checks mantêm chave e impressão coerentes, mas não provam que a impressão foi calculada pelo servidor.
- **Ações a jusante:** criar execução, resultado, observação financeira e aprendizado continua sem chave (mesmo padrão; fora do escopo). O Knowledge já é idempotente.
- **Contrato estável da impressão:** mudar a canonicalização sem versão faria um reenvio em voo, atravessando um deploy, ser recusado como "outra decisão".
- **Prova da corrida em servidor de desenvolvimento:** o Next em dev serializa parte do trabalho (10 pedidos levaram de 5 a 20 s, de ponta a ponta) e mesmo assim duplicou tudo; em produção a concorrência tende a ser maior.

**Riscos de implementação.**

- **Ordem de implantação:** schema antes do app (§12).
- **Classificação do `23505`:** depende do nome do índice; um teste deve fixar o nome.
- **`crypto.randomUUID()`:** exige contexto seguro (HTTPS ou localhost). Ter alternativa com `crypto.getRandomValues`.
- **Releitura tardia:** só pode ler.
- **Índice em tabela grande:** num futuro com tabela grande, a criação deve ser `concurrently`, fora de transação.
