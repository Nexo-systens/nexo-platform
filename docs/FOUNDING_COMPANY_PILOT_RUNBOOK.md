# FOUNDING COMPANY PILOT RUNBOOK

> Documento operacional para o primeiro Founding Company controlado da NEXO.
> Criado pela Mission 199 — Founding Company Pilot Environment & Controlled Launch Gate.
> Não é um manual de operações enterprise. É o runbook da PRIMEIRA empresa.

---

## GO-LIVE — Primeira Founding Company (Mission 201 + Closure)

**Estado: `MISSION_201_CLOSED_AWAITING_HUMAN_REVIEW` — tecnicamente pronto (`TECHNICALLY_READY_FOR_FIRST_FOUNDING_COMPANY`).** Nenhum P0, nenhum P1 técnico; o caminho real passou no smoke test ao vivo (abaixo). O primeiro upload real depende só das pré-condições humanas a seguir.

Este é o documento INTERNO: registra todos os riscos e limitações conhecidos. O documento para o cliente é `docs/FOUNDING_COMPANY_PROGRAM_DRAFT.md` — curto, sem detalhes técnicos, e ainda um rascunho.

### Pré-condições humanas (antes do primeiro upload real)

1. **Revisão apropriada do `docs/FOUNDING_COMPANY_PROGRAM_DRAFT.md`**, por quem tiver competência para isso. Nenhuma revisão foi feita ou é declarada aqui; este runbook não é aconselhamento jurídico. A revisão precisa preencher os campos `[A DEFINIR]` restantes (vigência, contatos, aceite), revisar o texto de encerramento já redigido (30 dias para ambientes ativos, 90 dias para backups controlados pela NEXO — ver "Política de retenção após o encerramento") e decidir se os fatos internos abaixo estão comunicados de forma adequada.
2. **Aceite registrado:** a Founding Company recebe e aceita a versão revisada — incluindo a concordância com o processamento necessário às funcionalidades de IA previstas, que fazem parte do serviço nesta modalidade; o operador registra data, versão aceita e quem aceitou no registro do operador (fora do repositório — ver "Registro do operador"). Se a empresa não concordar com o uso de IA, o onboarding é interrompido antes de receber qualquer documento.
3. **Checkpoint operacional executado** (procedimento abaixo).
4. **Operador NEXO disponível** durante toda a primeira sessão.

### Fatos internos que o documento do cliente resume (nunca esconder internamente)

- **Infraestrutura:** banco e arquivos no Supabase, projeto NEXO Pilot, região `ca-central-1` (Canadá) — fora do Brasil.
- **IA:** ao gerar Diagnóstico Executivo ou usar o Executive Chat, o contexto financeiro da empresa (indicadores, valores, evidências — sem razão social/CNPJ) é enviado à API da Anthropic (EUA). A análise financeira determinística não usa IA.
- **Acesso:** um único usuário por empresa (dono da conta); não existe compartilhamento com sócios/conselho. Enquanto não houver deploy público, o operador opera as sessões (suporte operacional, nunca revisão da análise).
- **Exclusão:** na operação normal, arquivos aceitos, execuções e diagnósticos são imutáveis. Desde a Mission 202 (D-130) existe a **exclusão definitiva de uma empresa encerrada** pelo próprio dono (arquivos + todos os dados; a conta não é afetada) — **ativa no NEXO Pilot desde 2026-09-27** (Migration 017 aplicada). Dados já copiados em dumps só saem quando o dump inteiro é apagado (até 90 dias após o encerramento — política abaixo).
- **Retenção:** enquanto a empresa participa, os dados permanecem. Após o encerramento (política desta fase, no rascunho do documento do cliente, ainda sujeita à revisão apropriada): dados nos **ambientes ativos sob controle da NEXO removidos em até 30 dias corridos**; cópias em **backups controlados pela NEXO por até 90 dias**, restritas a contingência. Procedimento em "Política de retenção após o encerramento", abaixo. Nada é prometido sobre a retenção técnica interna dos fornecedores (Supabase, Anthropic e demais).
- **Backup:** o Supabase não tem backup restaurável do Pilot (`backups list` vazio, PITR desligado). Mitigação VERIFICADA (2026-09-26): dump lógico de esquema e de dados executado de verdade na máquina do operador (Docker + Supabase CLI), com SHA-256 conferido — mais os originais preservados. Não é PITR nem disaster recovery completo; não inclui os arquivos do Storage; restauração nunca testada.
- **Hospedagem:** não existe deploy público; o acesso é por sessões operadas pelo operador NEXO (suporte operacional).

### Modelo de acesso (formal)

- Enquanto não existir deploy público aprovado, a primeira Founding Company usa a NEXO em **sessões operadas pelo operador NEXO**: é o operador quem roda o servidor e dá suporte ao uso da plataforma. Isso é suporte operacional ao uso e ao funcionamento do serviço — **não** revisão da análise financeira (ver regra canônica abaixo).
- A sessão roda na máquina do operador com `npm run dev` apontando para o NEXO Pilot. Isso é **ferramenta interna do operador**, não infraestrutura apresentada ao cliente.
- Não prometer acesso autônomo contínuo. O documento do cliente não descreve infraestrutura: fala apenas que a NEXO pode prestar suporte ao uso da plataforma, ao envio dos documentos e ao funcionamento do serviço.
- Links de e-mail de autenticação apontam para a origem que os gerou (`http://localhost:3000`): signup e recuperação de senha do fundador acontecem na sessão operada. Nunca usar `next start` local (a origem vira `https://localhost:3000` e os links quebram).

### Regra canônica: suporte operacional × validação técnica × análise financeira

Alinhada ao `docs/FOUNDING_COMPANY_PROGRAM_DRAFT.md`:

- **Análise financeira é da plataforma.** A NEXO **não** tem revisão humana obrigatória de análises, diagnósticos, evidências, hipóteses, cenários ou recomendações. Nenhuma pessoa da NEXO valida, aprova ou corrige a análise antes de a empresa vê-la, e isso nunca é condição de entrega. As decisões finais são da empresa.
- **Suporte operacional (permitido):** ajudar no uso da plataforma, no recebimento e envio dos documentos, em problemas técnicos e no funcionamento do serviço. Não é consultoria financeira manual: o operador não interpreta, reescreve nem complementa a análise.
- **Validação técnica do sistema (temporária, só nos primeiros ciclos reais):** o operador verifica se o PRODUTO funcionou — upload aceito, status de governança dos documentos, e se os números-chave foram extraídos corretamente do documento de origem (período, receita, lucro, ativos). É teste de funcionamento do sistema, não revisão da análise: não bloqueia a empresa, não altera nada do que a plataforma produziu, e uma divergência é tratada como **incidente técnico** (corrigido no produto, nunca à mão). Deixa de existir quando os ciclos reais estiverem estáveis — não é dependência permanente de intervenção humana.

### First Real Founding Company — Data Handling

- **Quem recebe os documentos:** somente o operador NEXO designado (nome no registro do operador), pelo canal acordado com a empresa e registrado.
- **Onde guardar os originais:** pasta privada controlada pela NEXO, **fora do repositório git**, com acesso restrito ao operador. Nunca em `docs/`, `tests/`, pastas temporárias de ferramentas, chats ou e-mail aberto. A empresa mantém os próprios originais.
- **Tipos aceitos para análise:** PDF e CSV (DRE, Balanço/Balancete, extrato com transações). Outros formatos ficam armazenados como "Não analisável" — não enviar sem motivo.
- **Proibido receber ou enviar:** credenciais bancárias, senhas, tokens, certificados digitais, dados de cartão. Se chegarem por engano: não usar, não enviar à NEXO, apagar a cópia recebida, avisar a empresa e registrar o ocorrido (sem copiar o conteúdo).
- **Checkpoint antes do upload:** obrigatório (procedimento abaixo).
- **Upload:** feito na sessão operada, na conta do próprio fundador, com a categoria correta.
- **Análise:** produzida pela plataforma ao executar pelo botão da empresa. A empresa vê a análise como a plataforma a produziu.
- **Validação técnica temporária (primeiros ciclos reais):** verificar o status de governança de cada documento (aceito, duplicata, conflito, requer revisão) e se os números-chave foram extraídos corretamente do documento de origem — ver a regra canônica acima. Não é revisão financeira nem condição de entrega. O operador nunca completa, estima nem corrige números manualmente; dado ausente aparece como indisponível, e divergência é incidente técnico.
- **IA:** nesta modalidade do programa, as funcionalidades de IA previstas (Diagnóstico Executivo, Executive Chat) fazem parte do serviço. A empresa concorda com o processamento das informações necessárias ao aceitar a versão apropriada do documento do cliente, antes do upload real. Se a empresa não concordar, o operador interrompe o onboarding antes de receber qualquer documento. Não improvisar um "modo sem IA": um escopo sem essas funcionalidades exige definição própria (produto e documento), nunca uma decisão do operador durante a sessão. Falha do provider não afeta a análise já feita.
- **Incidente:** qualquer um de — dado de outra empresa visível, acesso indevido, perda de dado, credencial recebida, número financeiro claramente errado, erro inesperado repetido. Ação: seguir "Parada / rollback"; registrar horário, o que foi observado e o HEAD em uso (sem copiar dados financeiros); avisar a empresa pelo canal acordado, conforme a versão revisada do documento; abrir uma missão de correção. Nunca "consertar" no banco (Seção 15).
- **Encerramento:** a empresa pode encerrar a participação a qualquer momento; a NEXO para de receber documentos e de processar dados da empresa. Prazos: 30 dias corridos para os ambientes ativos, 90 dias para os backups controlados pela NEXO — "Política de retenção após o encerramento", abaixo. A remoção física é feita pelo caminho do produto — "Encerramento e exclusão definitiva de uma empresa", abaixo — nunca por SQL manual nem `service_role` (Seção 15).
- **Retenção:** só os prazos 30/90 da política abaixo, e só para o que está sob controle direto da NEXO — nunca prometer além disso, nem nada sobre a retenção interna dos fornecedores. O texto do cliente continua `DRAFT` até a revisão apropriada.
- **Backup:** checkpoint operacional por sessão (abaixo) — não é PITR.
- **A NEXO não é sistema contábil, ERP nem registro oficial.** A fonte oficial continua sendo a contabilidade da empresa; a NEXO produz inteligência a partir de cópias dos demonstrativos.

### Checkpoint operacional (backup lógico, antes de cada ciclo com dado real)

**Estado: VERIFICADO (2026-09-26).** Na máquina do operador da NEXO: Docker Desktop instalado e com o Engine em execução (`docker run --rm hello-world` com sucesso); pasta privada `C:\NEXO_BACKUPS\pilot` criada fora do Git; dump real do esquema e dump real dos dados do NEXO Pilot executados com sucesso, em arquivos separados (`2026-09-26-schema.sql`, `2026-09-26-data.sql`), ambos com tamanho maior que zero e SHA-256 calculado e conferido. Nenhum conteúdo nem hash dos dumps foi para o Git ou para chats — os hashes ficam só no registro do operador. O Supabase CLI + `db dump` estão funcionais nessa máquina. **Segundo checkpoint VERIFICADO (2026-09-27), pré-Migration 017:** novo par `schema` + `data` (`--use-copy`) em arquivos novos com data, sem sobrescrever os anteriores, ambos com tamanho maior que zero e SHA-256 calculado e conferido (hashes só na pasta privada/registro do operador, nunca no Git).

Procedimento obrigatório, nesta ordem, antes de cada ciclo real:

1. **Preservar os originais do cliente fora do Git**, na pasta privada da NEXO, com o hash de cada arquivo. A empresa também mantém os próprios originais.
2. **Confirmar o Pilot saudável:** Seções 1–3 (git limpo, `HEAD == origin/develop`, CI verde).
3. **Confirmar a paridade de migrations:** `npx supabase migration list --linked` com todas as migrations do repositório aplicadas (hoje 19/19 — a 017 da Mission 202 e a 018 da Mission 202B aplicadas em 2026-09-27; a 019 da Mission 214 aplicada na Mission 215, em 2026-10-09).
4. **Dump do esquema** (Docker Desktop precisa estar em execução — o Supabase CLI roda o `pg_dump` num contêiner):
   ```bash
   npx supabase db dump --linked -f C:\NEXO_BACKUPS\pilot\<AAAA-MM-DD>-schema.sql
   ```
5. **Dump dos dados:**
   ```bash
   npx supabase db dump --linked --data-only --use-copy -f C:\NEXO_BACKUPS\pilot\<AAAA-MM-DD>-data.sql
   ```
6. **Verificar tamanho maior que zero** nos dois arquivos (PowerShell):
   ```powershell
   (Get-Item C:\NEXO_BACKUPS\pilot\<AAAA-MM-DD>-schema.sql).Length
   ```
   ```powershell
   (Get-Item C:\NEXO_BACKUPS\pilot\<AAAA-MM-DD>-data.sql).Length
   ```
7. **Calcular o SHA-256** de cada arquivo:
   ```powershell
   Get-FileHash -Algorithm SHA256 C:\NEXO_BACKUPS\pilot\<AAAA-MM-DD>-schema.sql
   ```
   ```powershell
   Get-FileHash -Algorithm SHA256 C:\NEXO_BACKUPS\pilot\<AAAA-MM-DD>-data.sql
   ```
8. **Registrar localmente**, só no registro privado do operador: data/hora (UTC e BRT), HEAD em uso, nomes dos arquivos, tamanhos e hashes (dos dumps e dos originais).
9. **Só então iniciar o upload real.**

Se um dump falhar: não iniciar o ciclo até resolver, ou registrar no registro do operador a aceitação explícita do risco (com os originais preservados e com hash).

**Regras e limites (não enfraquecer):**
- Os dumps podem conter dados sensíveis — o de dados conterá os dados financeiros reais da empresa. Manter só em armazenamento privado com acesso restrito; **nunca versionar em Git**, nunca enviar por chat ou e-mail, nunca copiar para pastas de ferramentas.
- O dump lógico **não contém os arquivos físicos do Supabase Storage** (só os metadados). A empresa e a NEXO precisam preservar os documentos originais — são eles que permitem refazer os uploads.
- **Não é PITR nem disaster recovery completo:** é uma fotografia lógica do banco no instante do dump. Mudanças posteriores só ficam protegidas pelo próximo checkpoint.
- **A restauração continua não testada.** Uso previsto, se um dia necessário: recuperação manual num projeto NOVO e vazio (aplicar as migrations, depois o arquivo de dados com `psql` e a string de conexão digitada pelo próprio operador) — **nunca sobrescrever o NEXO Pilot**. Tratar como melhor esforço. Alternativa futura: backups do plano do Supabase.

### Política de retenção após o encerramento (30/90 dias)

**Regra operacional desta fase**, alinhada à seção "Encerramento" do `docs/FOUNDING_COMPANY_PROGRAM_DRAFT.md` (ainda `DRAFT — REQUIRES APPROPRIATE REVIEW BEFORE USE`; não é afirmação jurídica). Vale **só para os ambientes e backups sob controle direto da NEXO**. Não descreve nem promete a retenção técnica interna dos fornecedores (Supabase, Anthropic e demais) — nunca inventar nem afirmar política de fornecedor. Coerente com D-130: a purga altera só o banco e o Storage ativos; backups são outro ciclo de vida.

**Marco zero (D):** a data em que a empresa comunica o encerramento da participação pelo canal acordado, registrada no registro do operador. Todos os prazos contam em dias corridos a partir de D.

**A partir de D — interromper novos processamentos.** Não receber documentos, não abrir sessão de uso para a empresa, não executar análise, diagnóstico nem chat. O operador de offboarding registra a solicitação em `/operator/offboarding` ("Autoridade de offboarding do operador", abaixo), o que encerra a empresa no produto se ela ainda estiver aberta — sem depender de nova sessão do dono. A partir daí o banco recusa qualquer dado novo (D-130, D-131).

**Até D+30 — prazo dos ambientes ativos.**
1. **Exclusão definitiva pelo caminho do produto** — pelo operador de offboarding, sem depender da sessão do dono ("Autoridade de offboarding do operador", abaixo), ou pelo próprio dono ("Encerramento e exclusão definitiva de uma empresa", abaixo): arquivos no Storage e todos os dados da empresa no banco do NEXO Pilot (documentos, dados financeiros, análises e toda a inteligência derivada).
2. **Cópias mantidas pela NEXO fora do Pilot:** apagar os originais da empresa guardados na pasta privada e as cópias recebidas pelo canal acordado.
3. **Registrar** a data e o resultado de cada passo no registro do operador.
- **Sempre pelo caminho do produto:** o prazo é cumprido pelo operador de offboarding ou pelo dono — nunca `service_role`, SQL ou dashboard (Seção 15). Se o caminho do produto for recusado (por exemplo, referência legada entre empresas), tratar como bloqueio antes de D+30: registrar, escalar e abrir uma missão de correção.
- **Exceção de preservação** (obrigação aplicável ou outra circunstância que exija retenção, conforme o texto do cliente): o operador não decide sozinho. Registrar o motivo, o escopo e quem decidiu, depois da revisão apropriada. Nunca usar a exceção como padrão.

**Até D+90 — prazo dos backups controlados pela NEXO.**
- Todo dump criado antes da exclusão definitiva da empresa contém os dados dela, inclusive os feitos entre D e a purga. Cada um desses dumps **expira em D+90**; se contiver mais de uma empresa encerrada, vale a expiração mais próxima.
- Até expirar, o dump fica **restrito à contingência/recuperação**: nunca operação normal, nunca novas análises, nunca desenvolvimento, testes ou ambiente local, nunca cópia para outra máquina ou pasta.
- **Na expiração (ou antes): apagar o dump inteiro** — o par `schema` + `data` daquela data — da pasta privada e de qualquer cópia. Antes de apagar, conferir nome, data de criação e SHA-256 contra o inventário e garantir que exista um checkpoint mais novo, feito depois da purga (para não deixar as demais empresas sem backup). Registrar data, arquivos e hashes apagados.
- **Nunca editar um dump** (nem o SQL) para retirar uma única empresa: um dump é uma fotografia de todas as empresas; a única forma de tirar dados de um dump é apagar o dump inteiro.

**Inventário privado obrigatório** (no registro do operador, nunca no repositório), revisado a cada checkpoint e a cada encerramento. Para cada dump: nome do arquivo; data/hora de criação (UTC e BRT); tipo (`schema` ou `data`); tamanho; SHA-256; HEAD em uso; empresas encerradas cuja exclusão definitiva ocorreu depois da criação do dump, ou ainda não ocorreu (esses dumps ainda contêm os dados delas); **data prevista de expiração** (a menor D+90 entre essas empresas); data efetiva de eliminação. Dumps que não contêm nenhuma empresa encerrada não têm prazo definido por esta política.

**Restauração.** Se um dump ou snapshot anterior a uma exclusão definitiva for restaurado: (1) não liberar o ambiente restaurado para operação; (2) consultar o registro privado de offboardings; (3) reaplicar a exclusão definitiva de cada empresa excluída depois da data do dump — se o dump for anterior ao encerramento, a empresa volta aberta: registrar/encerrar e excluir de novo pelo caminho do operador de offboarding (ou do dono); (4) conferir que nenhuma empresa excluída voltou; (5) só então liberar para operação normal. A restauração nunca foi testada: o procedimento exato de reaplicação deve ser definido e ensaiado junto com o primeiro teste de restauração — até lá, uma restauração não pode voltar à operação sem essa revisão.

**Registro de offboarding:** só o necessário para provar e reaplicar a exclusão — identificação da empresa, D, data da purga, contagens da prévia, resultado, dumps afetados e a data de eliminação de cada um; nunca conteúdo financeiro. Precisa existir pelo menos enquanto houver dump que contenha a empresa; o que manter depois disso fica para a revisão apropriada.

### Encerramento e exclusão definitiva de uma empresa (Mission 202, D-130)

**Estado: ATIVO no NEXO Pilot desde 2026-09-27 (Migration 017 aplicada com autorização humana, 17/17).** Provado no Supabase local (pgTAP 51/51, ponta a ponta 8/8, UI) e no Pilot com uma empresa técnica descartável da conta de teste DEV_USER (smoke da ativação, abaixo), já excluída definitivamente — nenhuma fixture ficou no Pilot.

- **Encerrar** (Empresas → "Encerrar"): a empresa some das listagens e deixa de aceitar qualquer dado novo, inclusive por API direta. É irreversível para o usuário (não há reabertura). Os dados continuam guardados. A CNPJ continua ocupada para aquele dono até a exclusão definitiva.
- **Excluir definitivamente** (Empresas → "Empresas encerradas" → "Ver o que será excluído" → digitar a frase `EXCLUIR-XXXXXXXX` → "Excluir definitivamente"): feito na sessão do **próprio dono**, na sessão operada — ou, sem a sessão do dono, pelo operador de offboarding (seção seguinte). Remove primeiro os arquivos da empresa no Storage (inclusive órfãos), depois, numa única transação, todos os dados da empresa nas 12 tabelas, e por último a empresa. **A conta do usuário não é apagada.** Outras empresas — do mesmo dono ou de outros — não são tocadas.
- **Registrar** no registro do operador: data/hora, empresa, D (data do encerramento da participação) e os prazos D+30/D+90, quem pediu e quem confirmou, contagens da prévia e o resultado. Depois, anotar a empresa em cada dump do inventário que ainda a contém, com a data prevista de expiração (política de retenção acima).
- **Se falhar:** "Não foi possível remover os arquivos…" — nada foi apagado do banco; tentar de novo. "Os arquivos foram removidos, mas a exclusão dos dados falhou…" — a empresa continua encerrada com os dados estruturados; tentar de novo (repetir é seguro). "…outra empresa referencia dados desta" — nada foi apagado; é uma referência legada entre empresas: parar e abrir uma missão de correção. Depois do sucesso, repetir é inofensivo.
- **Nunca** usar SQL Editor, `service_role` ou DELETE direto em `storage.objects` para "adiantar" uma exclusão (Seção 15).

### Autoridade de offboarding do operador (Mission 202B, D-131)

**Estado: ATIVO no NEXO Pilot desde 2026-09-27 (Migration 018 aplicada com autorização humana, 18/18; autoridade concedida pelo mecanismo governado).** Provado no Supabase local (pgTAP 65/65 + 51/51, ponta a ponta 10/10 + 8/8, UI, com dono e operador em contas distintas) e no Pilot pelo caminho do operador (smoke da ativação, abaixo). Remove a dependência da sessão do dono para concluir um offboarding: o operador NEXO, com autoridade explícita, registra o encerramento solicitado pelo canal acordado e conclui a exclusão definitiva. Não é posse da empresa: o operador continua sem ver nem alterar nenhum dado dela.

- **Quem pode:** só uma conta com concessão ativa em `public.offboarding_operators` — de preferência uma conta própria de operador, sem empresas. Nunca a conta de uma Founding Company. No NEXO Pilot, a concessão ativa está na conta técnica interna usada como DEV_USER (identificada só no registro privado).
- **Conceder (ação administrativa governada, não é operação de dados):** com autorização humana explícita e registrada no registro do operador (quem autorizou, data, conta), o dono do banco executa pelo Supabase CLI, no projeto confirmado (Seção de migrations: identidade e região): `select public.grant_offboarding_operator('<id da conta do operador>', '<referência do registro privado>');`. O id e a referência ficam só no registro privado — nunca no Git ou em chat. A referência aceita só letras, números e `. _ : / -` (nunca e-mail ou nome).
- **Revogar:** `select public.revoke_offboarding_operator('<id>', '<referência>');` — vale na próxima requisição (a autoridade é lida no banco a cada chamada). Revogar quando o operador deixar a função ou ao fim de cada janela de offboarding, se assim decidido.
- **Fluxo** (sessão operada, conta do operador logada, `/operator/offboarding` — para quem não é operador a página responde 404):
  1. informar o identificador técnico da empresa (do registro privado) → "Consultar": estado (aberta/encerrada), solicitação registrada (sim/não) e contagens — sem razão social, CNPJ ou conteúdo;
  2. se não registrada: informar a referência do registro privado e digitar `ENCERRAR-XXXXXXXX` → "Registrar solicitação de encerramento". Empresa ainda aberta é encerrada aqui (irreversível para o usuário: deixa de receber dados e não reabre). Nada é apagado;
  3. digitar `EXCLUIR-XXXXXXXX` → "Excluir definitivamente": mesma orquestração do dono (arquivos primeiro pela Storage API, depois a purga transacional, depois a verificação). A conta do dono não é afetada.
- **O que o operador nunca consegue:** ler, baixar, listar ou gravar dados/arquivos de qualquer empresa; reabrir empresa; purgar empresa aberta ou sem solicitação registrada; conceder autoridade.
- **Auditoria:** cada encerramento e purga ficam em `public.company_offboarding_records` (id técnico, instantes, autoridade `owner`/`operator`, referência, contagens — nenhum dado da empresa). Transcrever o resultado para o registro privado do operador: é essa cópia que permite reaplicar a purga depois de uma restauração.

Smoke da ativação no Pilot (2026-09-27; empresa técnica descartável e dados sintéticos; nenhuma Founding Company):
- Operador autenticado acessou `/operator/offboarding`; com a concessão revogada, a mesma sessão recebeu 404 na hora (revogação imediata) e, reconcedida, 200 — concessão, revogação e reconcessão pelo mecanismo governado, com referências.
- Empresa técnica criada, 1 CSV sintético e 1 análise; o operador registrou a solicitação (a empresa foi encerrada), a prévia mostrou só estado e contagens, o botão ficou desabilitado até a frase e a exclusão definitiva foi feita **pelo caminho do operador**.
- Depois: empresa, filhos e objetos de Storage da fixture = 0; conta, empresa de controle e totais globais idênticos ao retrato anterior; restou só o registro mínimo de offboarding (encerramento e purga com autoridade `operator`, referência e contagens).
- Sondagem sempre desfeita (nada persistiu): o operador não reabre (0 linhas), não lê nem altera dados de outra empresa (0 linhas; `42501` na escrita), não enxerga arquivos dela (nem em download, nem na remoção), não concede autoridade, não lê os registros e não chama o núcleo (`42501`); não purga empresa aberta (`not_closed`); quem não é operador recebe o mesmo que uma empresa inexistente.
- Limite do smoke remoto: no Pilot, a conta operadora também era a dona da fixture (nenhuma conta nova foi criada); a independência entre dono e operador foi provada localmente, com contas distintas.

### Registro do operador

Um documento privado da NEXO, **fora do repositório**, com o que este runbook proíbe commitar: identidade do operador designado, canal acordado com a empresa, contas de teste (por e-mail), conta e empresa reais com data de criação, aceite do documento do cliente, checkpoints, inventário e rotação de dumps (com as datas previstas de expiração), offboardings com seus prazos D+30/D+90, incidentes e feedback. É a fonte de identificação positiva — nunca a memória.

### Checklist de go-live

**Antes do primeiro upload real**
- [ ] Documento do cliente revisado de forma apropriada (versão e data no registro do operador)
- [ ] Aceite da Founding Company registrado, incluindo a concordância com as funcionalidades de IA previstas (sem concordância: onboarding interrompido antes de receber documentos)
- [ ] Tipos de documento suportados confirmados com a empresa (PDF/CSV)
- [ ] Originais preservados na pasta privada, com hashes
- [ ] Pilot saudável (Seções 1–3)
- [ ] Migrations do repositório todas aplicadas no Pilot (19/19 desde 2026-10-09)
- [ ] Dumps de esquema e de dados feitos, tamanho maior que zero e SHA-256 registrados no registro do operador (ou risco aceito explicitamente)
- [ ] Conta e empresa corretas (conta própria do fundador, identificada no registro)
- [ ] Nenhuma conta de teste misturada com a empresa real
- [ ] Operador disponível
- [ ] Procedimento de parada conhecido

**Durante a primeira análise**
- [ ] Upload controlado, categoria correta
- [ ] Validação técnica (temporária): status de governança de cada documento verificado (aceito, duplicata, conflito, requer revisão)
- [ ] Validação técnica (temporária): números-chave extraídos conferem com os originais; divergência registrada como incidente técnico
- [ ] Validação técnica (temporária): dados ausentes aparecem como indisponíveis e conflitos aparecem como alerta — nunca como zero
- [ ] Análise entregue exatamente como a plataforma a produziu — sem revisão financeira manual como condição de entrega, sem números corrigidos à mão
- [ ] Funcionalidades de IA previstas usadas como parte do serviço, dentro do aceite registrado — nenhum "modo sem IA" improvisado
- [ ] Nenhuma decisão automática

**Depois da primeira análise**
- [ ] Recarregar a página: análise persistida e histórico corretos
- [ ] Originais continuam preservados
- [ ] Problemas registrados
- [ ] Feedback da empresa registrado
- [ ] Nenhuma limpeza destrutiva

### Separação entre dados sintéticos e a empresa real

**Decisão: `PRESERVE_SYNTHETIC_EVIDENCE`.** Inventário (Mission 201, só contagens): 4 usuários de auth; 2 empresas, cada uma de um dono diferente; 7 documentos; 7 execuções; 0 diagnósticos/decisões. O isolamento é por RLS (provado ao vivo) e a CNPJ é única por dono (D-126).

- **Convenção existente, mantida:** empresas sintéticas criadas pela NEXO usam o prefixo `SMOKE` na razão social (ex.: "SMOKE M201 — Empresa Sintética LTDA"). COMPANY_A (evidência da Mission 199B) pertence a uma conta de teste. Não existe outro sistema de marcação — não criar um.
- **Contas de teste** (USER_A, USER_B/DEV_USER e as demais criadas em missões) ficam listadas no registro do operador. **A empresa real** é criada pela conta nova do fundador, registrada com data de criação. Nunca criar dado sintético na conta do fundador; nunca usar conta de teste para dado real.
- **Identificação positiva antes de qualquer operação destrutiva:** conferir, contra o registro do operador, a conta dona (por `user_id`), a razão social E a data de criação; obter autorização explícita por escrito; remover somente as linhas daquela conta de teste. Nunca DELETE amplo; nunca com base em memória. Operação destrutiva continua proibida na operação normal (Seção 15).

### Roteiro da sessão operada

1. Checklist "Antes do primeiro upload real" completo.
2. `npm run dev`; o fundador cria a própria conta em `/signup` (a mensagem é sempre neutra — D-127), confirma pelo e-mail e entra.
3. `/companies` → Nova empresa. Regime tributário e Porte são opcionais (corrigido na Mission 201 — antes a criação falhava em silêncio sem eles).
4. Enviar documento (categoria + PDF/CSV) → status "Disponível".
5. Executar análise → a empresa vê a análise produzida pela plataforma. Em paralelo, nos primeiros ciclos reais, fazer a validação técnica: conferir se os números-chave extraídos (ex.: Receita Líquida, Lucro Líquido, período) batem com o documento de origem. Divergência = incidente técnico, nunca correção manual.
6. Recarregar a página → a análise continua lá (hidratação, D-125); Histórico mostra a execução "Atual".
7. Gerar diagnóstico executivo — funcionalidade de IA prevista, parte do serviço nesta modalidade e coberta pelo aceite registrado.
8. Checklist "Depois da primeira análise"; registrar o feedback no registro do operador (não existe módulo de feedback no produto).

### Parada / rollback

- Parar a sessão a qualquer sinal de dado financeiro errado, vazamento entre empresas ou erro inesperado repetido. Não "consertar" no banco (Seção 15).
- Código: voltar para o último commit conhecido-bom de `develop` (Seção 14). Migrations nunca são revertidas.
- Documento errado: excluir (lógico) e reenviar; reanalisar. A execução antiga continua no histórico, imutável.

### Observabilidade (manual, suficiente para 1 empresa em sessões operadas)

| Evento | Onde aparece |
|---|---|
| Análise que falhou | UI (mensagem do painel de análise) + terminal do servidor `[api:analyze.executive.*]` (D-129) |
| Upload rejeitado | UI (mensagem do envio) |
| Conflito/duplicata financeira | UI (alerta de governança por documento) |
| Falha do provider de IA | UI (`stage: "provider"`), análise determinística intacta |
| Falha de envio de e-mail de auth | terminal `[auth:signup]`/`[auth:password_reset]` (a UI mostra sempre a resposta neutra) |
| Erro 500 | UI (mensagem genérica) + terminal `[api:*]` |
| Processamento preso | só por consulta de leitura: `documents.status = 'processing'`; resolvido por uma nova análise (a tentativa mais nova sempre vence — D-117) |

Não existe alerta automático. O operador acompanha o terminal durante a sessão.

### Smoke test do caminho real (Mission 201) — LIVE_PROVEN

Servidor local → NEXO Pilot, usuário de teste real (USER_B), sem nenhum bypass: criar empresa sintética pela UI → enviar CSV de DRE (Julho/2026) pela UI → Storage + validação de bytes + `public.documents` ("Disponível") → `POST /api/efos/analyze/[companyId]/executive` (200) → Margem Bruta 54,21%, Margem Líquida 22,16%, Lucro Líquido R$ 242.000,00 (conferidos contra o documento), liquidez "não pôde ser calculada" (sem Balanço — nunca zero) → reload: análise hidratada → Histórico: 1 execução "Atual" → estado de ativação "análise disponível". IA não foi chamada.

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

Cadeia esperada (18 migrations no repositório, ordem exata — `supabase/migrations/`; **todas as 18 aplicadas no NEXO Pilot** — as 16 primeiras desde o Pilot Migration Gate da Mission 199B, a 017 (Mission 202) e a 018 (Mission 202B) desde 2026-09-27):

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
20260926000000_companies_cnpj_tenant_scoped_unique
20260926120000_company_offboarding
20260927120000_offboarding_operator_authority
```

**Migration 016 — ATUALIZADO (Mission 199B Security Closure, D-126).** `companies_cnpj_tenant_scoped_unique` troca a unicidade global de `companies.cnpj` por `unique (user_id, cnpj)`, fechando o oráculo cross-tenant de CNPJ encontrado pela matriz da Mission 199B. **LIVE_PROVEN — APLICADA no NEXO Pilot (Mission 199B Security Closure — Pilot Migration Gate).** Estado anterior `ONLY_016_PENDING` (001–015 local == remoto, 016 só local), `db push --linked --dry-run` confirmando só a 016, depois `npx supabase db push --linked`. Verificado no banco real, somente por metadados/contagens: `companies_document_key (cnpj)` removida; `companies_user_id_cnpj_key (user_id, cnpj)` presente; `migration list --linked` 16/16; RLS habilitada em 13/13 tabelas, 28 policies (as 3 de `companies` presentes) e contagem de linhas idêntica antes e depois. Estado esperado a partir de agora: `migration list --linked` com 16 local == remoto. No Windows, se `npx` for bloqueado pela política de execução do PowerShell, usar `npx.cmd` (nunca alterar a política de segurança).

**Migration 017 — Mission 202 (D-130). LIVE_PROVEN — APLICADA no NEXO Pilot em 2026-09-27 (Mission 202 — Pilot Activation & Closure Gate), com autorização humana explícita.** `company_offboarding`: encerramento monotônico, bloqueio de novos dados em empresa encerrada, prévia/listagem/purga definitiva. Provada antes num Supabase local descartável (cadeia 001–017 do zero, pgTAP 51/51, ponta a ponta 8/8, UI). Fluxo da aplicação: identidade do projeto confirmada (NEXO Pilot, `ca-central-1`; o projeto histórico de `sa-east-1` INACTIVE e não linkado); estado `ONLY_017_PENDING` (16 local == remoto, 017 só local); checkpoint novo pré-migration (Seção "Checkpoint operacional"); as 14 policies alteradas pela 017 conferidas no Pilot por nome e comando; `db push --linked --dry-run` listando só a 017; `npx supabase db push --linked`. Estado esperado a partir de agora: `migration list --linked` com 17 local == remoto e `db push --dry-run` "up to date".

Verificação remota (somente catálogo, metadados e contagens agregadas):
- As 4 funções existem com `search_path` vazio e sem SQL dinâmico; só `purge_closed_company` é `SECURITY DEFINER`; EXECUTE para `authenticated`, nunca para `anon`/`public`.
- Todas as 32 policies de `public` e `storage.objects` exigem posse via `auth.uid()` (nenhuma confia só num `company_id` enviado pelo cliente); o UPDATE de `companies` exige empresa aberta (sem reabertura); as 13 policies de escrita exigem empresa aberta; a nova policy de DELETE no Storage exige empresa encerrada do próprio dono.
- Antes da aplicação: 0 empresas encerradas e 0 observações financeiras com referência entre empresas no Pilot — nenhum dado existente mudou de comportamento.

Smoke da ativação (empresa técnica descartável da conta de teste DEV_USER; nenhum dado real; a empresa técnica sintética já existente dessa conta, da Mission 201, serviu de controle, sem nenhuma alteração):
- Empresa alvo criada pela UI, 2 arquivos sintéticos enviados e 1 análise executada; encerrada pela UI.
- Sondagem de RLS como o dono (e como um uid aleatório sem conta), dentro de um bloco que sempre termina com exceção — tudo desfeito, contagens idênticas antes e depois: com a empresa ABERTA as mesmas gravações passam (controle positivo); ENCERRADA, inserir documento, execução ou objeto de Storage dá `42501` e editar/reabrir/alterar documento atinge 0 linhas; purga com frase errada → `confirmation_mismatch`, com a frase certa e arquivos presentes → `storage_not_empty`; quem não é dono recebe exatamente a mesma resposta de uma empresa inexistente (`{"found": false}` / `not_found`).
- Prévia pela UI igual ao banco (2 arquivos, 2 documentos, 1 análise); botão desabilitado até a frase exata; exclusão definitiva pela UI com sucesso.
- Depois: empresa, as 11 tabelas filhas e o prefixo do Storage da empresa alvo = 0; a diferença global foi exatamente a da empresa alvo; a empresa de controle, a conta (`auth.users` e `public.users`) e os totais globais idênticos ao retrato anterior à fixture. Nenhuma fixture restou; nenhum dump contém a fixture (criada depois do checkpoint).
- Não verificável remotamente sem `service_role`: a remoção física dos bytes no backend do Storage (feita pela própria Storage API, que remove o objeto e o metadado; provada fisicamente só no Supabase local). Falhas destrutivas propositais não foram simuladas no Pilot (provadas localmente).

**Migration 018 — Mission 202B (D-131). LIVE_PROVEN — APLICADA no NEXO Pilot em 2026-09-27, com autorização humana explícita.** `offboarding_operator_authority`: autoridade governada de offboarding do operador, núcleo único da purga (o fluxo do dono mantém os mesmos guards e respostas), registro mínimo de offboarding, policies de Storage do operador só para remoção. Aditiva: não apagou nem alterou dado existente (backfill de 0 linhas). Antes, provada num Supabase local descartável (cadeia 001–018 do zero, pgTAP 116/116, ponta a ponta 18/18, UI). Fluxo da aplicação: commit técnico em `origin/develop` com CI verde; identidade do projeto confirmada (NEXO Pilot, `ca-central-1`; `sa-east-1` INACTIVE, não tocado); `ONLY_018_PENDING`; checkpoint novo pré-migration; nenhum nome novo já existente no Pilot; `db push --linked --dry-run` listando só a 018; `npx supabase db push --linked`. Verificação remota: 13 funções com `search_path` vazio; núcleo, contagem interna, concessão e revogação sem EXECUTE para `authenticated` e `service_role`; nenhuma função executável por `anon`; 34 policies (as 32 anteriores + 2 do operador), nenhuma policy de dados referencia o operador, nenhuma policy de DELETE em `public`; tabelas novas com RLS, sem policy e sem privilégio de cliente; leitura de Storage do operador só dentro de `storage.object.delete_many`. Estado esperado após a 018: `migration list --linked` com 18 local == remoto e `db push --dry-run` "up to date".

**Migration 019 — Mission 214 (D-137/D-138). APLICADA no NEXO Pilot em 2026-10-09 (Mission 215), com autorização humana explícita.** `decision_idempotency`: colunas `idempotency_key` (uuid) e `request_fingerprint` (text) em `public.decisions`, nullable e sem default (sem backfill); três checks (`decisions_idempotency_pair_check`, `decisions_idempotency_human_actor_check`, `decisions_request_fingerprint_format_check`); índice único parcial `decisions_idempotency_key_unique` em `(company_id, human_actor_id, idempotency_key) where idempotency_key is not null`. Sem RLS, grant, RPC ou SECURITY DEFINER novos. Fluxo: identidade confirmada (NEXO Pilot, `ca-central-1`, ACTIVE_HEALTHY; `sa-east-1` INACTIVE, não linkado, não tocado); leitura só antes — 18/18, 0 Decisions, colunas/índice/checks ausentes, 2 policies em `decisions`; `db push --linked --dry-run` listando só a 019; `npx supabase db push --linked`. Ponto de recuperação: nenhum checkpoint novo (plano sem PITR); a 019 é aditiva sobre uma tabela vazia e reversível por migration corretiva (ver o cabeçalho da migration). Verificação só leitura: 19/19; colunas nullable sem default; três checks validados; índice único e válido com o escopo acima; as 2 policies de `decisions` idênticas às de antes; conjunto de funções idêntico ao de antes (mesmo digest; nenhuma RPC nem SECURITY DEFINER nova); cache do PostgREST com as colunas novas (`pgrst_ddl_watch` ativo; leitura REST das colunas novas 200, coluna inexistente 400). Smoke autenticado só leitura (transação `read only`, role `authenticated` com `auth.uid()` de um dono existente, rollback): SELECT das colunas novas sob RLS funciona, 0 Decisions. **Nenhuma Decision, empresa ou outro dado foi criado.** O app de `develop` ainda não foi implantado — é o passo seguinte, com autorização própria. Estado esperado a partir de agora: `migration list --linked` com 19 local == remoto e `db push --dry-run` "up to date".

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

**Estado comprovado no NEXO Pilot — ATUALIZADO (Mission 199B / 199B Closure).**
- **HUMAN-DRIVEN LIVE (Mission 199B, `ccfb0e7`)**: USER_A autenticado, COMPANY_A operada, análise real persistida. O teste ao vivo expôs e corrigiu dois defeitos deste fluxo: logout pela UI quebrado (`UserMenu.tsx`) e estado de envio dos formulários `/signup`/esqueci/redefinir senha (`startTransition`).
- **HUMAN-VERIFIED (posterior à 199B)**: SMTP próprio configurado no Supabase Auth do Pilot; um novo usuário de teste foi criado e autenticado com sucesso. O envio de e-mail de autenticação **não é mais bloqueio**.
- **NOT PROVEN**: estado final da delegação DNS do domínio — nenhuma evidência verificável registrada.
- **PENDENTE**: USER_B dedicado para a matriz de isolamento (ver Anexo).

Nenhuma credencial, e-mail real ou project ref deve ser registrado neste documento.

**Respostas de autenticação — ATUALIZADO (Mission 200, D-127).** Signup e "esqueci minha senha" mostram a MESMA mensagem neutra com ou sem conta existente ("Se este e-mail puder ser usado..." / "Se este e-mail estiver cadastrado..."), sempre depois de pelo menos 1,5 s. É esperado: um fundador que já tem conta e tenta se cadastrar de novo não é informado disso — a mensagem orienta a entrar ou recuperar a senha. Só aparecem erros acionáveis que não revelam a conta: senha fraca, e-mail em formato inválido, cadastro desativado, muitas tentativas (limite por IP), serviço inalcançável. Falhas suprimidas (ex.: limite de envio de e-mail) ficam no log do servidor como `[auth:signup]`/`[auth:password_reset]`, só com código/status. Suporte: se o usuário diz que "nada chegou", verificar esse log e o painel de e-mail do Supabase Auth — nunca confirmar ao usuário se o endereço tem conta. O link de confirmação só redireciona para caminhos internos da NEXO. **LIVE_PROVEN (Mission 200 Closure):** no NEXO Pilot, signup com conta existente e recuperação com e sem conta mostraram a mesma resposta neutra, o mesmo status e o mesmo estado visual, todas em ~1,5 s.

**Erros internos — ATUALIZADO (Mission 200 Closure, D-129).** Uma falha inesperada nas rotas de análise/histórico aparece para o usuário só como a mensagem genérica da operação (ex.: "Erro inesperado ao executar a análise executiva.") — nunca o texto técnico. Para diagnosticar, procurar no log do servidor a linha `[api:<operação>] falha interna inesperada (D-129)`, que traz nome, código e mensagem truncada do erro.

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

**Reload / retorno à página — ATUALIZADO (Mission 199B, D-125).** Ao abrir uma empresa, `ExecutiveAnalysisPanel` lê a última análise já persistida via `GET /api/efos/analyze/[companyId]/executive` — estritamente somente leitura (não aceita documentos, não roda pipeline, não cria Execution; `getCompanyById()` primeiro). Esperado: depois de uma análise, recarregar a página continua mostrando o mesmo relatório; empresa sem análise mostra o estado inicial. Antes da 199B, o painel voltava a "Nenhuma análise executada ainda" a cada reload (P1 encontrado ao vivo). CODE-VERIFIED + regressão `tests/executive-report/latest-executive-analysis-hydration.test.ts`.

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
- **Migrations**: todas as 16 migrations preservam dado (a 016 só relaxa a unicidade global de `cnpj` para `(user_id, cnpj)`, nunca apaga linha); as 15 primeiras são aditivas (nenhuma `DROP`/reescrita destrutiva — confirmado por leitura de cada uma, Mission 197/199). **Nunca reverter uma migration já aplicada** — se um deploy futuro precisar desfazer uma mudança de schema, isso deve ser uma NOVA migration aditiva, nunca a exclusão física da anterior.
- **Documentos/Storage**: exclusão é sempre lógica (`deleted_at`) para documentos aceitos — fisicamente imutável (Migration 015, D-123). Nenhuma ação de rollback pode ou deve apagar bytes de documento aceito.
- **Execuções/Diagnósticos**: imutáveis por design (D-017, `executive_diagnoses` sem policy de UPDATE/DELETE). Rollback de aplicação nunca precisa (nem pode) alterar histórico já persistido.
- **Se algo corromper a Financial Truth de uma execução específica**: a correção é uma REANÁLISE (Seção 12), nunca uma edição manual de linha. Se isso não for suficiente, escalar para revisão técnica de engenharia (defeito de produto) antes de qualquer UPDATE manual em `public.executions`/`public.documents` — nunca uma revisão financeira da análise.

## 15. Ações manuais proibidas

Em nenhuma circunstância, para operação normal do primeiro Founding Company:

- editar `public.documents`/`public.executions`/`public.executive_diagnoses`/`public.decisions` via SQL Editor do dashboard Supabase;
- usar a `service_role` key para contornar RLS;
- apagar fisicamente um objeto de Storage referenciado por um `public.documents` (estruturalmente impossível desde a Migration 015 — D-123 — mas nunca tentar via dashboard, que não está sujeito à mesma policy);
- reverter uma migration já aplicada.

Se qualquer uma dessas parecer necessária, é um sinal de que existe um defeito de produto — não um procedimento operacional válido. Reportar, não contornar.

A exclusão definitiva de uma empresa (D-130) **não é** uma ação manual: é o caminho do produto, feito pela sessão do próprio dono, e continua proibido executá-la ou "adiantá-la" por SQL, `service_role` ou dashboard. Depois da Migration 018 (D-131), o operador de offboarding também pode concluí-la — sempre pelo caminho do produto (`/operator/offboarding`, sessão do próprio operador), nunca por SQL. A única ação por CLI prevista é administrativa: conceder ou revogar a autoridade (`grant_offboarding_operator`/`revoke_offboarding_operator`), com autorização humana registrada — nunca uma operação sobre dados de empresa.

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

**Resolvido (Mission 199P):** a opção 1 foi escolhida — o piloto usa o projeto dedicado NEXO Pilot; o resíduo acima fica no projeto histórico, fora do piloto.

**Matriz de isolamento cross-tenant — CONCLUÍDA: `CROSS_TENANT_GATE_PASSED` (Mission 199B Final External Gate).** Resultado final no parágrafo "Execução final" abaixo; o texto a seguir é o critério original. Requer um USER_B dedicado, criado e confirmado por humano no NEXO Pilot (SMTP já funcional). Provar ao vivo que USER_B, autenticado, NÃO consegue ler nem alterar de COMPANY_A: a empresa (`/companies/[id]`), documentos (lista, download, upload, exclusão), `POST`/`GET /api/efos/analyze/[companyId]/executive` (esperado `404`/`unauthorized`) e `GET /api/efos/history/[companyId]` (esperado histórico vazio). Até lá, o isolamento é apenas CODE-VERIFIED (RLS + `getCompanyById()`), nunca LIVE-PROVEN. O piloto só fecha depois desta prova.

**Primeira execução (Mission 199B, gate externo) — `CROSS_TENANT_GATE_FAILED`.** USER_B (usuário real autenticado do Pilot, sem nenhuma empresa) não enxergou nada de COMPANY_A, e o papel anônimo foi provado isolado ao vivo nas 13 tabelas, no Storage e na RPC. Mas a auditoria encontrou um oráculo de enumeração: a unicidade GLOBAL de `companies.cnpj` revelava, pelo erro "Já existe uma empresa cadastrada com este CNPJ.", que um CNPJ existia em outro tenant. Correção commitada pela Mission 199B Security Closure (D-126, Migration 016) e **aplicada e verificada no NEXO Pilot** (Pilot Migration Gate). Para repetir a matriz: obter os IDs reais de COMPANY_A pelo Table Editor do Supabase Dashboard (leitura humana) e rodar de novo com USER_B.

**Execução final (Mission 199B Final External Gate) — `CROSS_TENANT_GATE_PASSED`.** USER_B (usuário real autenticado, 0 empresas) contra COMPANY_A, no Pilot já com a Migration 016, usando apenas três UUIDs técnicos de COMPANY_A (empresa, um documento, uma execução — autorização humana restrita, nunca persistidos). Cada prova foi repetida com um UUID inexistente, e as respostas foram idênticas:
- **LIVE_PROVEN:** `/companies/[id]` (não encontrada); `/documents?companyId=` (vazio); `GET`/`POST /api/efos/analyze/[companyId]/executive` (`404` unauthorized, `POST` rejeitado antes de qualquer efeito); `GET /api/efos/history/[companyId]`, inclusive com `previousExecutionId` real (histórico vazio); rastreabilidade por documentId (`[]`); chat executivo e simulação de cenário (`stage: "access"`). Nenhum oráculo de existência; nenhuma alteração em COMPANY_A.
- **LIVE_SCHEMA_PROVEN + REGRESSION_TESTED:** CNPJ (`companies_user_id_cnpj_key (user_id, cnpj)`, D-126).
- **STRUCTURALLY_ISOLATED:** download do Storage (exige storage path, não obtido de propósito); decisões/recomendações/knowledge por ID (COMPANY_A não tem registros); Server Actions de mutação (não executadas).
- **NOT_PROVEN:** consulta direta ao banco como USER_B (exigiria extrair o token da sessão).

O isolamento do piloto passa a ser LIVE-PROVEN nas superfícies acima.
