# AI START

> Este documento é o ponto de entrada obrigatório para qualquer IA trabalhando na NEXO.

---

# Objetivo

Antes de qualquer análise, implementação ou refatoração, leia os documentos abaixo na ordem indicada.

Não assuma contexto de conversas anteriores.

Considere esta documentação como a única fonte oficial de verdade.

---

# Ordem de leitura obrigatória

1. HANDOFF.md
2. CONTEXT.md
3. ARCHITECTURE.md
4. DECISIONS.md
5. ROADMAP.md
6. ENGINEERING_LOG.md

Depois consulte apenas a documentação específica necessária para a missão atual.

---

# Identidade do Projeto

Projeto:

NEXO

Produto:

NEXO

Arquitetura Interna:

Executive Financial Operating System (EFOS)

Posicionamento:

A NEXO transforma dados financeiros em decisões executivas.

A NEXO não é:

- ERP
- BI
- Dashboard
- Software de indicadores

O EFOS é o motor interno do produto.

---

# Arquitetura

A arquitetura segue:

- Domain Driven Design (DDD)
- Clean Architecture
- EFOS Core
- Event Driven (quando implementado)
- Engines independentes

Nunca criar dependências do domínio para infraestrutura.

---

# Ordem de dependências

Domain

↓

Domain Events

↓

EFOS Engines

↓

Application

↓

Experience

↓

Infrastructure

Nunca inverter esta ordem.

---

# Regras obrigatórias

Nunca:

- Reescrever arquitetura existente.
- Alterar decisões registradas.
- Criar implementações fora da missão.
- Misturar domínio com infraestrutura.
- Adicionar regras de negócio dentro das entidades.

Sempre:

- Seguir o HANDOFF.md.
- Atualizar ENGINEERING_LOG.md ao concluir uma missão.
- Atualizar ROADMAP.md quando uma Sprint evoluir.
- Atualizar DECISIONS.md caso uma decisão permanente seja tomada.
- Atualizar HANDOFF.md antes de encerrar uma conversa.

---

# Fluxo de trabalho

1. Ler documentação.
2. Entender a missão.
3. Executar somente a missão solicitada.
4. Validar.
5. Atualizar documentação.
6. Gerar relatório.
7. Encerrar.

---

# Escopo

Uma missão deve possuir apenas um objetivo.

Não implemente funcionalidades extras.

Não antecipe etapas futuras.

---

# Em caso de dúvida

A prioridade é:

1. DECISIONS.md
2. ARCHITECTURE.md
3. HANDOFF.md
4. CONTEXT.md
5. ROADMAP.md
6. ENGINEERING_LOG.md

---

# Ao finalizar uma missão

Sempre responder com:

## Resumo

O que foi implementado.

## Arquivos

Criados.

Alterados.

## Validação

Type-check.

Testes.

Build.

## Próximo passo

Qual missão deve ser executada em seguida.

---

# Objetivo Final

Construir a NEXO como um Executive Financial Operating System (EFOS).

Toda implementação deve aumentar a capacidade do sistema de compreender empresas, gerar evidências, apoiar decisões e aprender continuamente.

Nenhuma implementação deve existir apenas por conveniência técnica.