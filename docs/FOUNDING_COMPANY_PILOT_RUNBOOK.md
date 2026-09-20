# FOUNDING COMPANY PILOT RUNBOOK

> Documento operacional para o primeiro Founding Company controlado da NEXO.
> Criado pela Mission 199 — Founding Company Pilot Environment & Controlled Launch Gate.
> Não é um manual de operações enterprise. É o runbook da PRIMEIRA empresa.

---

## 0. Como ler este documento

Toda etapa abaixo é marcada com o nível de prova por trás dela:

- **CODE-VERIFIED** — confirmado por leitura direta do código-fonte/migrations nesta ou em missões anteriores (196-199).
- **DETERMINISTICALLY PROVEN** — confirmado por execução real do pipeline determinístico (Mission 198), sem Supabase/browser.
- **HUMAN-VERIFIED (histórico)** — já confirmado por um humano logado de verdade em sessões anteriores (Missions 090-100), registrado em `docs/ENGINEERING_LOG.md`.
- **NOT PROVEN BY AGENT** — exige autenticação real. Nenhum agente desta série (Missions 089-199) executa isso sozinho: criar conta ou digitar senha, mesmo de teste, é proibido por política, sem exceção, independentemente de instrução de missão. Só um humano pode fazer esta etapa.

Todo passo marcado **NOT PROVEN BY AGENT** precisa ser executado por um humano antes do piloto real. A lista completa está na Seção 9.

---

## 1. Verificação de ambiente (antes de qualquer coisa)

**CODE-VERIFIED.** Rodar, na raiz do repositório:

```bash
git status
git log --oneline -5
npm run type-check
npm run lint
npm run build
```

Confirmar:
- branch `develop`, `HEAD == origin/develop`;
- build gera exatamente as rotas esperadas (16, a partir da Mission 197 — ver `npm run build`, seção "Route (app)");
- nenhum erro de type-check/lint.

**Identidade do projeto Supabase — ATUALIZADO (Mission 199P/Closure A).** O usuário criou um projeto Supabase novo e dedicado, **"NEXO Pillot"** (região `ca-central-1`, `ACTIVE_HEALTHY`), resolvendo a ambiguidade original da Mission 199. O repositório está linkado a ele (`supabase/.temp/linked-project.json`, local, gitignored) via `npx supabase link --project-ref <ref>` — sessão de CLI já autenticada com um token em cache, nenhuma senha vista/digitada por nenhum agente. O projeto histórico (`nexo-platform`) permanece `INACTIVE`/desvinculado, nunca mutado por nenhuma missão. `npx supabase projects list` é o comando LIVE-PROVEN para reconfirmar isso a qualquer momento.

## 2. Verificação de migrations

**LIVE_PROVEN (Mission 199P Closure A) — completo para o NEXO Pillot.** `npx supabase migration list --linked` (sem instalação global — `npx` baixa sob demanda) confirmou as 15 migrations locais == remotas, em ordem, sem divergência. `npx supabase db push --linked` aplicou a cadeia inteira com sucesso — incluindo a correção da Migration 005 (D-124: `financial_metrics`, classificada LEGACY_DEAD, nunca criada por nenhuma migration, tratada condicionalmente desde esta Closure). Verificação estrutural remota (somente leitura, `supabase db query --linked`): 13 tabelas exatas, RLS habilitada em todas, contagem de policies correta por tabela, bucket `documents` com 3 policies de Storage (select/insert/delete), RPC `acquire_processing_attempt_revision()` com `SECURITY DEFINER` e grants corretos.

Para reverificar a qualquer momento:

```bash
npx supabase migration list --linked
```

Cadeia esperada (15 migrations, ordem exata — `supabase/migrations/`):

```
20260715151336_initial_schema
20260719185615_users_profile
20260719195739_companies_core
20260719205643_documents_core
20260721141609_security_advisor_cleanup
20260802131410_executions_persistence
20260822202720_executive_decision_persistence
20260823190000_decision_execution_outcome
20260823210000_financial_observations
20260824000000_learning_records
20260825000000_knowledge_records
20260827000000_knowledge_evaluations
20260918120000_document_processing_authority
20260919120000_documents_bucket_size_limit
20260920000000_documents_storage_delete_policy
```

Se a lista real divergir desta (uma a mais, uma a menos, ordem diferente): **não tentar corrigir manualmente**. Classificar `MIGRATION_BEHIND`/`MIGRATION_AHEAD`/`MIGRATION_DIVERGED` e tratar como bloqueio até entendido — nunca reparar histórico de migration à mão (`docs/PROJECT_RULES.md`, mesma disciplina de nunca reescrever decisão já registrada).

## 3. Health / build / CI check

**LIVE_PROVEN (Missions 197-198, re-confirmável a qualquer momento).**

```bash
gh run list --limit 5
```

Todo push a `develop` desde a Mission 197 deve mostrar `completed success`. Se o run mais recente falhou, **não prosseguir para o piloto** — investigar antes (mesmo princípio da Mission 197: nunca assumir que CI funciona só porque o YAML existe).

## 4. Processo de criação de usuário/empresa

**NOT PROVEN BY AGENT.** Fluxo esperado (código lido, nunca executado por um agente):

1. `/signup` → e-mail + senha → Supabase Auth envia e-mail de confirmação real (confirmado ao vivo pela Mission 089 — `docs/ENGINEERING_LOG.md`, linha ~3149).
2. Confirmar e-mail → login em `/login`.
3. `/companies` → criar empresa (CNPJ, razão social — nenhuma expansão de KYC necessária, já auditado como adequado desde a Mission 195).
4. Empresa nova entra automaticamente no estado `no_documents` (`resolveActivationState()`, D-120) — `ActivationGuidanceCard` orienta o próximo passo.

Um humano deve executar isso manualmente. Nenhum agente desta série tem permissão para fazer login/signup, mesmo com credenciais de teste fornecidas por outra pessoa.

## 5. Formatos de documento suportados

**CODE-VERIFIED (Mission 195 Closure/196/197, inalterado).**

| Formato | Aceito no upload | Analisado (Financial Truth) |
|---|---|---|
| PDF | Sim | Sim |
| CSV | Sim | Sim |
| XLSX/XLS/DOC/DOCX/PNG/JPG/JPEG | Sim (armazenado) | Não — rotulado "Não analisável" na UI |

Fonte única de verdade: `modules/documents/constants.ts` (`ANALYZABLE_FILE_EXTENSIONS ⊂ ALLOWED_FILE_EXTENSIONS`).

## 6. Primeiro upload

**NOT PROVEN BY AGENT** (exige empresa autenticada). Comportamento esperado, **CODE-VERIFIED + DETERMINISTICALLY PROVEN (Mission 198)**:

- extensão validada no cliente E no servidor (`createDocumentAction()`, D-121);
- conteúdo validado por assinatura de bytes (`validateDocumentContent()`, D-121) — um `.csv` que na verdade é binário, ou um `.pdf` sem o cabeçalho `%PDF-`, é rejeitado antes de virar um registro;
- upload rejeitado nunca cria uma linha em `public.documents` — o objeto no Storage fica órfão, e agora (Migration 015, D-123) PODE ser limpo pelo próprio dono via `removeStorageObject()`.

## 7. Análise

**NOT PROVEN BY AGENT via browser** — **DETERMINISTICALLY PROVEN via o mesmo orquestrador de produção (Mission 198)**. `POST /api/efos/analyze/[companyId]/executive` (único endpoint canônico desde a Mission 197, D-122) — `getCompanyById()` primeiro, depois os 10 Engines do `EFOS_PIPELINE`. Checkpoints determinísticos exatos (reproduzíveis via `npm run test:release-candidate`): DRE sozinha → Margem Bruta disponível, Liquidez indisponível; +Balanço → Liquidez/ROA passam a disponíveis: valores exatos em `tests/release-candidate/full-pipeline-integration.test.ts`.

## 8. Estados de ativação esperados

**CODE-VERIFIED, `modules/activation/resolveActivationState.ts`, D-120.**

| Estado | Quando | O que o usuário vê |
|---|---|---|
| `no_documents` | 0 documentos | "Enviar documento" |
| `documents_not_analyzable` | documentos existem, nenhum PDF/CSV | "Enviar um PDF ou CSV" |
| `ready_for_analysis` | ≥1 documento analisável, 0 execuções | "Executar análise" |
| `analysis_available` | ≥1 execução, 0 diagnósticos | "Gerar diagnóstico executivo" |
| `diagnosis_available` | ≥1 diagnóstico | "Ver diagnóstico executivo" |

Uma empresa madura (`executionsCount`/`diagnosesCount` > 0) nunca regride, mesmo que os documentos atuais mudem — "existing customer safety", testado (`tests/activation/`).

## 9. Tratamento de conflito/duplicata

**DETERMINISTICALLY PROVEN (Mission 198, ao vivo, + `tests/release-candidate/`).**

- **Duplicata equivalente** (mesmo conteúdo econômico, novo `documentId` — como um re-upload real sempre produz): colapsa, sem duplicar Financial Truth.
- **Conflito material** (duas DREs do mesmo período, valores divergentes): nenhum vencedor arbitrário — indicadores dependentes de DRE ficam `unavailable` nos dois lados; Balanço não-relacionado permanece disponível; a UI mostra um alerta de governança (`documentGovernance`, `needs_review`/`same_period_conflict`).

## 10. Correção/re-upload

**CODE-VERIFIED**, fluxo suportado sem SQL/dashboard: `deleteDocumentAction()` (soft delete, `deleted_at`) → novo upload do documento corrigido → nova análise. Execuções antigas permanecem imutáveis (`PipelineExecution`, D-017) — nunca reescritas.

## 11. Falha de provider (IA)

**DETERMINISTICALLY PROVEN (Mission 198, ao vivo).** `ANTHROPIC_API_KEY` ausente/inválida → `AnthropicExecutiveAIProvider` lança `PROVIDER_UNAVAILABLE` ANTES de qualquer chamada de rede. A Financial Truth determinística (ExecutiveReport) já existe e persiste, independente do diagnóstico. Usuário vê erro no estágio `"provider"`, pode tentar novamente — nunca perde a análise já feita.

## 12. Reanálise

**CODE-VERIFIED.** Cada execução é imutável e identificada por `executionId` (D-017). Uma nova análise não apaga a anterior — vira a execução "atual"; a antiga permanece consultável via histórico.

## 13. Histórico

**CODE-VERIFIED.** `GET /api/efos/history/[companyId]` — somente leitura, RLS-scoped, `companyId` de outra empresa devolve histórico vazio, nunca erro/vazamento.

## 14. Rollback / escalonamento

Este é o plano de rollback estreito, específico do primeiro piloto — não um DR enterprise.

- **Aplicação**: rollback é sempre `git revert`/deploy da versão anterior de `develop` (ou do commit conhecido-bom). Nunca há necessidade de reverter dado.
- **Migrations**: todas as 15 migrations são aditivas (nenhuma `DROP`/reescrita destrutiva — confirmado por leitura de cada uma, Mission 197/199). **Nunca reverter uma migration já aplicada** — se um deploy futuro precisar desfazer uma mudança de schema, isso deve ser uma NOVA migration aditiva, nunca a exclusão física da anterior.
- **Documentos/Storage**: exclusão é sempre lógica (`deleted_at`) para documentos aceitos — fisicamente imutável (Migration 015, D-123). Nenhuma ação de rollback pode ou deve apagar bytes de documento aceito.
- **Execuções/Diagnósticos**: imutáveis por design (D-017, `executive_diagnoses` sem policy de UPDATE/DELETE). Rollback de aplicação nunca precisa (nem pode) alterar histórico já persistido.
- **Se algo corromper a Financial Truth de uma execução específica**: a correção é uma REANÁLISE (Seção 12), nunca uma edição manual de linha. Se isso não for suficiente, escalar para revisão humana antes de qualquer UPDATE manual em `public.executions`/`public.documents`.

## 15. Ações manuais proibidas

Em nenhuma circunstância, para operação normal do primeiro Founding Company:

- editar `public.documents`/`public.executions`/`public.executive_diagnoses`/`public.decisions` via SQL Editor do dashboard Supabase;
- usar a `service_role` key para contornar RLS;
- apagar fisicamente um objeto de Storage referenciado por um `public.documents` (estruturalmente impossível desde a Migration 015 — D-123 — mas nunca tentar via dashboard, que não está sujeito à mesma policy);
- reverter uma migration já aplicada.

Se qualquer uma dessas parecer necessária, é um sinal de que existe um defeito de produto — não um procedimento operacional válido. Reportar, não contornar.

---

## Anexo — Isolamento de dados do piloto (Seção 30 da Mission 199)

Não existe hoje uma taxonomia de tenancy dedicada a "piloto" vs. "sintético" vs. "real" — e a Mission 199 não recomenda criar uma (REGRA 15/16, evolução incremental). O isolamento real é por `company_id`/`user_id` (RLS), o mesmo mecanismo que já protege qualquer empresa de qualquer outra.

**Resíduo conhecido no projeto Supabase atual** (achado da Mission 199, lendo o histórico em `docs/ENGINEERING_LOG.md`/`docs/HANDOFF.md`):
- Uma conta de teste **não confirmada**: `nexo.mission089.test@mailinator.com` (criada pela Mission 089; nunca confirmada, nunca removida — `docs/HANDOFF.md`, Pendências).
- Uma empresa real criada pelo usuário humano durante a Mission 090: **"Nexo EFOS teste"** — última leitura conhecida (Mission 091) mostrava `public.documents` vazia para ela.

**Antes do primeiro piloto real, um humano deve decidir e executar UMA das duas opções** (nenhuma foi decidida por esta missão — decisão de produto/operação, não técnica):
1. Provisionar um projeto Supabase novo e dedicado ao Founding Company, mantendo o atual como ambiente de desenvolvimento; ou
2. Limpar o resíduo acima (remover a conta não confirmada, decidir o destino de "Nexo EFOS teste") e usar o mesmo projeto para o piloto.

Esta missão não removeu nem alterou nenhum dado nesse projeto — nenhuma mutação foi tentada (ver relatório da Mission 199).
