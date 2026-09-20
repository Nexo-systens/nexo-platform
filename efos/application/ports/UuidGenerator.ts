/**
 * Port de geração de identificador único. Contrato puro —
 * implementação real (ex.: `crypto.randomUUID()`) pertence a
 * Infrastructure. Nenhuma lógica de negócio. Não substitui os IDs
 * determinísticos já usados pelos Engines (`{prefix}-{financialModelId}
 * -{key}`, ver `docs/DECISIONS.md` D-001) — este Port serve a
 * identificadores da Application Layer (ex.: `ApplicationMetadata
 * .requestId`), que não precisam ser determinísticos.
 */
export interface UuidGenerator {
  generate(): string;
}
