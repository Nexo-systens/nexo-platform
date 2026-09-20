# PROJECT RULES

> Regras permanentes de engenharia da NEXO.
> 
> Este documento define princípios que NÃO podem ser quebrados sem uma decisão arquitetural formal registrada em `DECISIONS.md`.

---

# Objetivo

Garantir consistência arquitetural durante toda a evolução da NEXO.

Toda IA, desenvolvedor ou colaborador deve seguir estas regras.

---

# REGRA 1 — O domínio é o centro

O domínio representa a linguagem oficial da NEXO.

Toda regra de negócio deve existir para servir o domínio.

Nenhuma tecnologia pode alterar o domínio.

---

# REGRA 2 — O domínio não depende de infraestrutura

É proibido que o domínio importe:

- Banco de dados
- Supabase
- APIs
- Frameworks
- React
- Next.js
- Serviços externos
- SDKs

O domínio deve ser totalmente independente.

---

# REGRA 3 — O domínio não contém comportamento técnico

Entidades representam conceitos.

Elas não:

- acessam banco
- fazem requisições
- chamam IA
- manipulam arquivos

Toda lógica pertence aos Engines.

---

# REGRA 4 — Cada Engine possui uma única responsabilidade

Um Engine deve resolver apenas um problema.

Exemplo:

✔ Data Engine normaliza dados.

✔ Indicator Engine calcula indicadores.

✔ Evidence Engine transforma indicadores em evidências.

Nunca misturar responsabilidades.

---

# REGRA 5 — Engines comunicam intenção, não implementação

Sempre que possível, a comunicação deve ocorrer através do domínio e de eventos.

Nunca criar dependências desnecessárias entre Engines.

---

# REGRA 6 — Toda implementação deve responder uma pergunta

Antes de iniciar qualquer código responder:

Qual problema do executivo esta implementação resolve?

Se não houver resposta clara, a implementação não deve existir.

---

# REGRA 7 — A experiência é guiada por decisões

A interface nunca deve ser construída em torno de módulos.

Ela deve responder perguntas executivas.

Exemplos:

Como está minha empresa?

O que mudou?

Quais riscos existem?

O que devo decidir hoje?

---

# REGRA 8 — Nenhuma IA altera arquitetura sozinha

Mudanças arquiteturais exigem:

1. discussão
2. aprovação
3. registro em DECISIONS.md

Depois disso a implementação pode acontecer.

---

# REGRA 9 — Missões possuem escopo único

Cada missão deve possuir apenas um objetivo.

Nunca implementar funcionalidades extras.

Nunca antecipar próximas etapas.

---

# REGRA 10 — Toda missão termina com validação

Obrigatório:

- Type-check
- Build
- Documentação atualizada
- Relatório final

---

# REGRA 11 — Toda conversa termina com HANDOFF

Antes de encerrar um chat:

Atualizar:

- HANDOFF.md
- ENGINEERING_LOG.md
- ROADMAP.md (quando necessário)

Nunca depender do histórico da conversa.

---

# REGRA 12 — Commits pequenos

Cada commit deve representar apenas uma entrega lógica.

Exemplos:

feat(domain): add financial entities

feat(data-engine): normalize transactions

feat(indicators): calculate liquidity ratios

Evitar commits gigantes.

---

# REGRA 13 — Documentação é parte do produto

Arquitetura e documentação possuem o mesmo valor que o código.

Nenhuma implementação relevante deve existir sem documentação correspondente.

---

# REGRA 14 — O EFOS é a tecnologia, NEXO é o produto

Externamente:

Produto = NEXO

Internamente:

Arquitetura = EFOS

Nunca misturar esses conceitos.

---

# REGRA 15 — Clareza acima de complexidade

A solução mais simples que respeite a arquitetura deve ser preferida.

Complexidade só é aceita quando gera benefício claro.

---

# REGRA 16 — Evolução incremental

Nenhum componente deve ser desenvolvido "para o futuro".

Cada implementação deve resolver uma necessidade atual e permitir evolução posterior.

---

# REGRA 17 — Qualidade antes de velocidade

É preferível entregar uma missão bem concluída do que várias parcialmente implementadas.

---

# REGRA 18 — A fonte da verdade

A prioridade dos documentos é:

1. PROJECT_RULES.md
2. DECISIONS.md
3. HANDOFF.md
4. ARCHITECTURE.md
5. CONTEXT.md
6. ROADMAP.md
7. ENGINEERING_LOG.md

Em caso de conflito, seguir essa ordem.

---

# REGRA 19 — Revisão obrigatória

Toda missão concluída deve ser revisada antes da próxima começar.

Nenhuma Sprint avança sem validação.

---

# REGRA 20 — Objetivo Final

O objetivo da NEXO não é gerar dashboards.

O objetivo é transformar dados financeiros em entendimento, entendimento em recomendações e recomendações em decisões executivas de alta qualidade.

Toda implementação deve aproximar o produto desse objetivo.

Caso contrário, ela não deve existir.