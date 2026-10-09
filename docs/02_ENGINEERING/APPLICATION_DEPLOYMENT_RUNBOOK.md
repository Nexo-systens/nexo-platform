# Application Deployment Runbook — NEXO app × NEXO Pilot

> **Status (Mission 216, 2026-10-09): `APPLICATION_DEPLOYMENT_NOT_READY` — alvo existente que exige correção (`EXISTING_TARGET_REQUIRES_CORRECTION`).** Código, schema e build estão prontos; a configuração do alvo (variáveis da Vercel por ambiente, URLs do Supabase Auth, caminho para Production) não é legível por um agente e precisa de verificação humana. Nenhum deploy, merge, mudança de DNS, de env ou de Auth foi feito.

Escopo: só o runtime do **produto** (aplicativo Next.js). O site institucional final não faz parte deste documento.

Nenhuma credencial, valor de variável, e-mail, project ref do Supabase ou slug de time da Vercel deve ser registrado aqui.

---

## 1. Estado real do deploy

Levantado só por leitura (API do GitHub, HTTP GET, DNS, CLI do Supabase). Nada abaixo vem de documentação antiga.

| Pergunta | Resposta verificada |
|---|---|
| Existe deploy do app? | **Sim, na Vercel**, pela integração Git da Vercel com o GitHub (deployments criados por `vercel[bot]`). Não existe arquivo de deploy no repositório (`vercel.json`, `.vercel/`, Dockerfile, netlify/wrangler/fly), nenhum webhook no repositório e o CI (`.github/workflows/ci.yml`) não faz deploy. |
| Ambientes | Ambientes do GitHub: `Preview` e `Production`. GitHub Pages: não existe. |
| Branch → ambiente | Observado: todo push em **`develop` cria um deployment `Preview` automaticamente** (38 de 38 pushes desde 2026-09-20, todos `success`, todos de `develop`). Os 4 deployments `Production` (2026-07-13 a 2026-07-15) são de commits de `main`. A configuração de "Production Branch" da Vercel não é legível sem o painel. |
| Commit publicado — Preview | Um deployment por commit; o mais recente é `8329d1d` (Mission 215). Cada um tem URL própria `nexo-platform-<hash>-<team>.vercel.app`, **protegida por Vercel Authentication** (GET → 302 para `vercel.com/sso-api`): só membros do time Vercel acessam. |
| Commit publicado — Production | Último deployment de produção (`9ce6352`, HEAD de `main`, "release 0.3.1 - auth module"): **failure**. Último com sucesso: `0e3fcee` ("release 0.3 - foundation", 2026-07-15). O alias de produção `nexo-platform-sable.vercel.app` (também o `homepage` do repositório) responde 200 com o scaffold "Create Next App"; `/login` responde 404. Qual deployment o alias aponta só o painel confirma; o conteúdo servido é compatível com `0e3fcee`. |
| Preview, staging ou production? | Não há staging. O produto atual (`develop`) só existe como Preview protegido; Production serve um scaffold de julho, não o produto. |
| Que banco usa? | **Production:** nenhum — o HTML e os 6 scripts servidos não contêm host `*.supabase.co`, JWT nem marcador de segredo. **Preview: DESCONHECIDO** — depende das variáveis de ambiente da Vercel para Preview, ilegíveis sem o painel, e o deployment é protegido. |
| Custom domain | Nenhum observável (ver seção 7). |
| Deploy automático | `develop` → Preview: **sim** (observado). `main` → Production: observado em julho; a configuração atual não é legível. |
| Rollback disponível | A Vercel mantém os deployments anteriores (Instant Rollback / Promote no painel); a disponibilidade no plano atual precisa ser confirmada no painel. Pelo git: `revert` + novo deployment. |

**Consequências.**
- Um push em `develop` publica código como Preview protegido. A documentação anterior ("não existe deploy hospedado") estava incompleta: não há deploy **público do produto**, mas há Previews automáticos.
- O push de `c2bf659` (Mission 214) gerou um Preview com o código que grava as colunas da Migration 019 cerca de 17 horas antes da 019 chegar ao Pilot (Mission 215). Se o env de Preview apontar para o Pilot, esse Preview recusaria o registro de decisão nesse intervalo. O Pilot tinha e continua com **0 Decisions** — nenhum dado foi afetado.
- Se o env de Preview apontar para o Pilot, o Preview de `8329d1d` já roda o código novo contra o schema 19/19 (protegido, só o time).

Ferramentas: Vercel CLI não instalada nesta máquina, projeto não vinculado (`.vercel/` ausente), nenhuma credencial Vercel presente. Configurações do projeto Vercel (env, Production Branch, domínios, proteção) só pelo painel.

## 2. NEXO Pilot — baseline

- Projeto vinculado: NEXO Pillot, `ca-central-1`, `ACTIVE_HEALTHY`. O projeto histórico `sa-east-1` está INACTIVE e não vinculado.
- Migrations: **19/19** (última `20261008120000_decision_idempotency.sql`); `db push --dry-run` "up to date".
- `public.decisions`: 0 linhas; colunas `idempotency_key`/`request_fingerprint`, três checks e `decisions_idempotency_key_unique` presentes; 2 policies.

**Baseline de SECURITY DEFINER (reproduzível).** As contagens "12" e "15" medem escopos diferentes; nenhuma função mudou.

| Escopo | Filtro | SECURITY DEFINER |
|---|---|---|
| Aplicação | `pronamespace = public` | **12** — exatamente as 12 definidas pelas migrations do repositório (nome a nome) |
| Todos os schemas não-catálogo | `nspname not in ('pg_catalog','information_schema')` | **15** = 12 de `public` + `pgbouncer.get_auth` + `vault.create_secret` + `vault.update_secret` (plataforma Supabase; as duas do `vault` pertencem à extensão) |

- `public`: 19 funções (12 SECURITY DEFINER + 7 SECURITY INVOKER), iguais às 19 definidas pelo repositório.
- Digest `md5(schema.nome(args)prosecdef)` de todos os schemas exceto `pg_catalog`/`information_schema`/`pg_toast`: `465cfc0e09d95572f4969251cd1b116c` — idêntico antes e depois da Migration 019 e na Mission 216.
- Digest só de `public` (`md5(nome(args)prosecdef)`, ordenado): `db7701a9060628374e8f4c89ec99f2d7`.

## 3. Compatibilidade aplicação ↔ Pilot

**Contrato inteiro.** Os tipos gerados do Pilot (`supabase gen types --linked`, só leitura) contêm todas as 13 tabelas de `types/database.ts` com as mesmas colunas e tipos; as únicas diferenças são aliases de enum do código, com os mesmos valores dos enums do Pilot (10 de 10). As 11 funções tipadas no código existem no Pilot. O Pilot tem a mais 2 tabelas e 5 funções internas de offboarding, sem uso direto do app.

**`public.decisions` (gravação de `saveHumanDecision()`).**

| Campo da aplicação | Coluna | Pilot | Origem |
|---|---|---|---|
| `decision.id` | `id` uuid | PK, default `gen_random_uuid()`; o app envia o id | Migration 007 (`20260822202720`) |
| `decision.companyId` | `company_id` uuid | obrigatória | 007 |
| `decision.basedOnDiagnosisId` | `diagnosis_id` uuid | nullable | 007 |
| `decision.basedOnReviewId` | `review_id` uuid | nullable | 007 |
| `decision.humanActorId` | `human_actor_id` uuid | nullable; o app recusa gravar sem ator | 007 |
| `decision` (JSON) | `decision` jsonb | obrigatória | 007 |
| — | `created_at` | default do banco | 007 |
| `submission.idempotencyKey` | `idempotency_key` uuid | **nullable, sem default** | **019** |
| `submission.requestFingerprint` | `request_fingerprint` text | **nullable, sem default** | **019** |

O app novo grava sempre os três invariantes da 019: ator presente (exceção antes do INSERT), chave UUID válida (`isIdempotencyKey`) e impressão no formato `decision-request:v<n>:<64 hex>` (`isDecisionRequestFingerprint`). Ele só trata como reenvio o `23505` do índice `decisions_idempotency_key_unique`, que existe no Pilot com esse nome.

**App anterior (pré-Mission 214, ex.: `54d9fe6`).** Insere sem as duas colunas (ficam NULL) e lê por campos nomeados (`toPersisted`), ignorando colunas extras. As expressões exatas dos três checks do Pilot, avaliadas em transação `read only` sobre linhas-modelo, aceitam as linhas do app antigo (com ou sem ator) e as do app novo, e só recusam chave sem impressão, chave sem ator e impressão fora do formato. Linhas sem chave ficam fora do índice parcial. Production atual (scaffold) não usa banco.

**Leitura autenticada.** Como `authenticated` com o `auth.uid()` de um dono existente, em transação `read only` com rollback, um SELECT de **todas as colunas que o código tipa** nas 13 tabelas funciona sob RLS.

## 4. Variáveis de ambiente (sem valores)

| Variável | Classe | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **required client + server** (inlined no build) | `lib/supabase/{client,server,proxy}.ts`. Na Vercel precisa existir no ambiente do build (Preview e/ou Production), apontando para o Pilot. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **required client + server** (pública por desenho; RLS) | Mesmos arquivos. Precisa ser a chave `anon` (JWT `role=anon`) ou `sb_publishable_…`, **nunca** `service_role`/`sb_secret_…`. |
| `ANTHROPIC_API_KEY` | **required server** para Diagnóstico, Executive Chat e simulação de cenário | Lida só em `efos/infrastructure/executive-{ai,chat}/` em runtime; ausente → falha fechada `PROVIDER_UNAVAILABLE` (a análise determinística continua). Nunca com prefixo `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | optional (client) | Canonical/imagem de compartilhamento da landing (`modules/site/`). Só origem `https`. |
| `NEXT_PUBLIC_NEXO_CONTACT_URL` | optional (client) | CTA comercial da landing (`mailto:`/`https:`). |
| `NODE_ENV` | deployment-only (definida pela plataforma) | `production` → `getOrigin()` usa `https`; desliga a IA sintética local. |
| `NEXO_LOCAL_SYNTHETIC_AI` | local-only | Ignorada em produção e contra host não local (Mission 204). |
| `FIXTURE_EMAIL`, `FIXTURE_PASSWORD`, `FIXTURE_THROUGH` | local-only | `scripts/visual-fixtures/` (Supabase local). |
| `SUPABASE_LOCAL_URL`, `SUPABASE_LOCAL_ANON_KEY`, `SUPABASE_LOCAL_DB_CONTAINER`, `TZ` | local-only (testes) | `tests/*-local/`. |

Não existe variável de URL de Auth: as URLs de retorno de e-mail derivam do header `host` da requisição (seção 6). O `.env.local` desta máquina define só as três primeiras, apontando para o Pilot.

## 5. Fronteira de segredos (Mission 216)

- `ANTHROPIC_API_KEY` só é alcançável por arquivos `"use server"` (`executive-diagnosis`, `executive-chat`, `scenario-simulation` actions); nenhum arquivo `"use client"` importa módulo de servidor.
- Nenhum uso de `service_role` no código (só comentários dizendo que não é usada).
- Nenhuma variável secreta com prefixo `NEXT_PUBLIC_`.
- Build limpo com o env do Pilot: o valor real da chave Anthropic aparece 0 vezes em `.next/static` (61 arquivos) e em `.next/server` (600); nenhum JWT `service_role`, `sk-ant-…` real ou `sb_secret_…`. A chave anon e o host do Pilot aparecem no bundle cliente — esperado.
- Repositório (890 arquivos versionados): valor Anthropic 0, chave anon 0, host do Pilot 0; o único `sk-ant-` é um texto falso de teste (`mission-206`). Nenhum `.env*`/`.pem` jamais commitado; nenhum padrão de segredo em todo o histórico.
- Lacuna (P3): o projeto não usa o pacote `server-only`; a proteção depende da convenção de prefixo do Next (variável sem `NEXT_PUBLIC_` nunca é inlined no cliente).

## 6. Autenticação e URLs exigidas

**Fluxo real.**
- **Login:** server action `login` → `signInWithPassword` (`@supabase/ssr`, cookies) → `redirect("/dashboard")`. Não usa URL de redirect do Supabase Auth.
- **Signup:** `emailRedirectTo = <origin>/auth/confirm?next=/dashboard`.
- **Recuperação de senha:** `redirectTo = <origin>/auth/confirm?next=/reset-password`.
- `<origin> = https://<header host>` (ou `http://` só em `NODE_ENV=development`).
- **`/auth/confirm`:** `verifyOtp({ token_hash, type })`; `next` só aceita caminho interno; sem token → `/login?error=confirmation_failed`. Exige que os templates de e-mail do Supabase entreguem `token_hash` e `type` nessa rota.
- **Proxy (`proxy.ts` → `lib/supabase/proxy.ts`):** renova a sessão em toda requisição; sem usuário fora das rotas públicas → `/login`; com usuário numa rota pública → `/dashboard` (exceto `/auth/confirm` e `/reset-password`).
- **Logout:** server action `logout` → `signOut()` → `/login`.
- Não há magic link nem OAuth.

**Para um host de deploy `H`, no Supabase Auth do Pilot (painel; não alterado):**
1. **Redirect URLs** devem permitir `https://H/auth/confirm**` (ou `https://H/**`). Sem isso, o Supabase troca o `redirectTo` pela Site URL e os links de signup e de recuperação levam ao host errado.
2. **Site URL:** se os templates de e-mail usam `{{ .SiteURL }}`, ela precisa ser `https://H`; se usam `{{ .RedirectTo }}`, basta o item 1. Os templates atuais não são legíveis por um agente; o fluxo só foi provado ao vivo em `http://localhost:3000` (Missions 199B/201).
3. Manter `http://localhost:3000/**` enquanto as sessões operadas continuarem.
4. URLs de Preview mudam a cada deployment (`nexo-platform-*-<team>.vercel.app`) e são protegidas. Não habilitar fluxos de e-mail nelas, salvo decisão explícita.

**SMTP (Resend).** Nenhuma mudança é necessária: o domínio de envio (`auth.nexoefos.com.br`) independe do host do app. O deploy só depende das URLs acima.

## 7. Domínios

| Host | Estado real |
|---|---|
| `nexoefos.com.br` | **Reservado/planejado.** Zona delegada à Cloudflare (NS); sem A/AAAA/CNAME (não serve web, HTTPS não resolve); `MX .` (nulo) e `v=spf1 -all`. |
| `www.nexoefos.com.br` | **Inexistente** (NXDOMAIN). |
| `app.nexoefos.com.br` | **Inexistente** (NXDOMAIN). |
| `auth.nexoefos.com.br` | **Só DNS de e-mail:** não é host web; tem filhos `send.auth…` (MX/SPF de envio) e `resend._domainkey.auth…` (DKIM), do envio Resend do Supabase Auth. |
| Supabase custom domain | Indisponível no plano atual ("Custom Domain add-on, Pro plan and above"). |
| Vercel | Só `*.vercel.app` observável; domínios do projeto Vercel só no painel. |

## 8. Build reproduzível (Mission 216)

`npm ci` limpo pelo lockfile (Node 24.21.0, npm 11.19.0; sem upgrade), `.next` e `tsbuildinfo` removidos → type-check limpo · lint limpo · testes do CI 536/536 (65 + 30 + 41 + 395 + 5) · `next build` sucesso, **20 rotas** + Proxy.

Smoke só leitura do build de produção local (`next start`) contra o Pilot, sem sessão: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password` → 200; todas as rotas protegidas e a API de histórico → 307 `/login`; `/auth/confirm` sem token ou com `next` externo → `/login?error=confirmation_failed`; nenhum erro no log do servidor.

## 9. Ordem de deploy (não executada)

Pré-requisito já cumprido: schema do Pilot 19/19, maior ou igual ao que o código exige.

0. **Decisão humana do alvo.**
   - **(A) Preview protegido de `develop` contra o Pilot.** Já existe e é o recomendado para a ativação acompanhada: só o time Vercel acessa, sem merge.
   - **(B) Production.** Exige merge `develop` → `main` ou "Promote to Production" de um deployment, além de domínio e da correção do último build de produção que falhou em julho.
1. **Verificar no painel Vercel** (sem colar valores em lugar nenhum):
   - as variáveis do ambiente escolhido: `NEXT_PUBLIC_SUPABASE_URL` aponta para o **Pilot** (`ca-central-1`), nunca `sa-east-1`; `NEXT_PUBLIC_SUPABASE_ANON_KEY` é a anon/publishable do Pilot; `ANTHROPIC_API_KEY` só como variável sensível, sem prefixo público;
   - a Production Branch;
   - a Deployment Protection;
   - o Node.js 24 nas configurações do projeto.
2. **Supabase Auth do Pilot:** adicionar `https://H/auth/confirm**` às Redirect URLs (e a Site URL, se os templates usarem `{{ .SiteURL }}`); conferir os templates de confirmação e de recuperação.
3. **Build:** `8329d1d` (ou o HEAD aprovado) com CI verde; para (A), o deployment já construído; se o env mudou no passo 1, um "Redeploy" desse mesmo commit.
4. **Deploy:** só com autorização explícita.
5. **Health check:**
   - `GET /` e `/login` → 200;
   - rota protegida sem sessão → 307 `/login`;
   - `/auth/confirm` sem token → `/login?error=confirmation_failed`;
   - logs de runtime da Vercel sem erro.
6. **Smoke autenticado (humano faz login):** seção 12.
7. **Critérios de rollback:** seção 10.

## 10. Rollback do app

**Gatilhos:**
- erro 5xx em qualquer rota do health check;
- login, logout ou proxy quebrado;
- registro de decisão falhando com coluna desconhecida ou erro diferente de `CREATED`/`REPLAYED`/`KEY_REUSED`;
- deployment apontando para outro Supabase;
- segredo exposto.

**Ação:**
1. Na Vercel, voltar o alias ao deployment anterior (Instant Rollback/Promote) ou implantar o commit conhecido-bom.
2. **Manter a Migration 019.**

**Por que não reverter a 019:**
- ela é compatível com o app anterior (colunas nullable sem default; checks aceitam NULL; índice parcial ignora linhas sem chave);
- removê-la exige uma migration corretiva nova, que apaga o metadado de idempotência das Decisions já gravadas;
- removê-la quebraria qualquer deployment do código novo ainda ativo;
- reverter o app resolve uma falha do app sem tocar dado.

Reverter o schema só faz sentido depois do app anterior estar no ar, com autorização própria (cabeçalho da migration).

## 11. Condições que impedem o deploy

- Migrations do Pilot ≠ repositório, ou `db push --dry-run` diferente de "up to date".
- Variável obrigatória ausente no ambiente alvo, ou URL apontando para outro projeto Supabase (inclusive `sa-east-1`).
- Chave pública com papel `service_role`/`sb_secret_`, ou segredo com prefixo `NEXT_PUBLIC_`.
- Redirect URLs/templates do Supabase Auth incompatíveis com o host.
- Alvo desconhecido (projeto Vercel, Production Branch ou proteção não confirmados).
- Build, type-check, lint ou testes falhando; CI vermelho no commit.
- Comportamento automático de `main`/`develop` não confirmado no painel.
- `nexoefos.com.br`/`app.` exigidos sem DNS (hoje inexistentes).

## 12. Observabilidade e smoke pós-deploy

**O que existe:**
- logs de build e runtime da Vercel (painel);
- logs do servidor Next: `internalErrorResponse()` (D-129) registra só nome, código e mensagem truncada; `logSuppressedAuthOutcome()` cobre os fluxos neutros de auth;
- error boundaries em `companies`, `companies/[id]` e `dashboard`, `not-found` global e do app;
- logs de API/Auth/Postgres do Supabase (painel).

**Lacunas críticas:**
- nenhuma captura de erro do cliente (sem SDK de error reporting);
- nenhuma rota de health — usar `/login` 200 + rota protegida 307;
- sem `global-error.tsx`;
- logs do Supabase com retenção curta no plano gratuito.

Nenhuma plataforma nova foi criada.

**Smoke pós-deploy recomendado** (humano logado na conta técnica, só leitura até autorização separada):
- Dashboard;
- Empresas;
- workspace da empresa: Análise, Central de Decisões, Scenario Lab (sem simular) e Executive Chat (só abrir, sem pergunta);
- Relatórios;
- logout → `/login`.

**Decisão real de fumaça** (1 confirmação, reenvio → `REPLAYED`, 1 linha): só com autorização separada.
