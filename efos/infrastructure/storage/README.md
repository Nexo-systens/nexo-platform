# Infrastructure — Storage

Status: **esqueleto, sem implementação (Mission 029 — Infrastructure Layer Foundation).**

## Responsabilidade

Implementar o Port de armazenamento de arquivo já definido na Application Layer — nunca definir contratos novos, nunca conter regra financeira, nunca conhecer Engines internamente.

## Conteúdo previsto

| Implementação futura | Contrato (Application Layer) | Responsabilidade |
|---|---|---|
| `StorageProvider` concreto (exemplo, nome não decidido) | `StorageProvider` (`efos/application/ports/StorageProvider.ts`, Mission 017) | Upload/download de arquivo bruto. |

Nenhuma dessas implementações existe nesta missão — o nome acima é ilustrativo, não uma decisão de nomenclatura. Nenhum Supabase Storage, S3, ou qualquer outro serviço concreto foi criado.

## Dependências permitidas

- `efos/application/ports` (`StorageProvider`).

## Dependências proibidas

- **Engines** (`efos/engines/*`) — nunca conhecidos aqui.
- **Definição de contrato novo** — o contrato já existe na Application Layer; esta pasta só implementa.
- **Regra financeira** — pertence exclusivamente aos Builders dos Engines.
