# EFOS Domain — Modelo de Domínio Canônico

Status: **modelagem estrutural, sem regra de negócio, sem acesso a banco, sem cálculo.**

Referência normativa: `docs/01_ARCHITECTURE/04_DOMAIN MODEL.md` e `docs/00_FUNDACION/EXECUTIVE FINANCIAL ONTOLOGY.md`.

## Estrutura

```
efos/domain/
  enums/            conjuntos fechados de valores (ResourceType, FinancialEventType, ConfidenceLevel, ...)
  value-objects/     conceitos imutáveis sem identidade (Money, Percentage, Period, ConfidenceScore, Provenance, AuditTrail)
  entities/          conceitos com identidade e ciclo de vida próprios (Company, User, Document, ..., Knowledge)
  aggregates/        fronteiras de consistência que agrupam entidades relacionadas
```

## Regra de dependência

Este módulo **não importa de nenhum outro lugar do repositório** — nem de `app/`, `modules/`, `lib/`, `types/database.ts`, nem mesmo de `efos/engines`, `efos/interfaces` ou `efos/shared`. É a camada mais interna da arquitetura (`docs/01_ARCHITECTURE/07_SOFTWARE ARCHITECTURE.md`, Infrastructure nunca conhece regra financeira — e aqui o inverso também vale: o domínio nunca conhece infraestrutura). A dependência é sempre de fora para dentro: futuramente, `efos/engines/*` importará `efos/domain`, nunca o contrário.

## Toda entidade estende `DomainEntity`

`id` + `provenance` (origem/confiança) + `audit` (histórico/versão) — implementação estrutural direta da "Regra Fundamental" de `docs/01_ARCHITECTURE/04_DOMAIN MODEL.md` (toda entidade deve possuir identificador único, origem, histórico, rastreabilidade, auditabilidade, versionamento).

Ver o relatório da missão que criou este módulo para a explicação completa de cada entidade e das decisões de modelagem.
