import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Contrato da camada oficial de consolidação de contexto financeiro entre
 * documentos da plataforma EFOS (Mission 052 — Financial Context Builder).
 * Primeira implementação concreta: `DefaultFinancialContextBuilder`
 * (`DefaultFinancialContextBuilder.ts`).
 *
 * `build()` recebe a coleção completa de `RawFinancialDocument` já
 * validada (`FinancialRecordValidator`, Mission 051) e devolve essa mesma
 * coleção de documentos — mesmo contrato oficial do Data Engine
 * (`efos/engines/data/data.types.ts`), nenhum tipo novo. **Esta camada
 * nunca executa o Pipeline.**
 *
 * Nenhum documento, linha, valor, data, label, `currency` ou hint é
 * criado ou alterado — cada `RawFinancialDocument`/`RawFinancialLine`
 * devolvido é exatamente o mesmo objeto recebido (mesma referência).
 * A única operação com efeito observável é a ordenação do array de
 * documentos ("organizar os documentos", permitida explicitamente pela
 * missão) — determinística, por campos já existentes
 * (`companyId`/`source`/`documentId`), portanto idempotente.
 *
 * As validações/confirmações de contexto compartilhado executadas são
 * deterministas (nenhuma IA, LLM ou heurística nova) e existem como
 * certificação/diagnóstico — ver `README.md` deste diretório para o
 * racional completo de por que seus resultados não têm, nesta missão,
 * nenhum lugar para serem registrados (`RawFinancialLine`/
 * `RawFinancialDocument` não têm campo de diagnóstico/contexto, e o
 * contrato do Data Engine é imutável — "Não alterar: Engine").
 */
export interface FinancialContextBuilder {
  build(
    documents: readonly RawFinancialDocument[]
  ): readonly RawFinancialDocument[];
}
