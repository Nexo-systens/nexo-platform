import type { RawFinancialDocument } from "@/efos/engines/data";

/**
 * Contrato da camada oficial de validação de registros financeiros da
 * plataforma EFOS (Mission 051 — Financial Record Validation).
 * Primeira implementação concreta: `DefaultFinancialRecordValidator`
 * (`DefaultFinancialRecordValidator.ts`).
 *
 * `validate()` recebe a coleção completa de `RawFinancialDocument` já
 * certificada (`FinancialKnowledgeBuilder`, Mission 050) e devolve
 * essa mesma coleção — mesmo contrato oficial do Data Engine
 * (`efos/engines/data/data.types.ts`), nenhum tipo novo.
 *
 * **O Validator nunca modifica nada.** Nenhum dado é corrigido,
 * nenhum dado é inventado — a camada apenas valida. Seja o registro
 * válido ou inconsistente, o retorno é sempre exatamente igual à
 * entrada (mesma referência, quando possível). Toda lógica é
 * idempotente por construção: como nada muda, `validate(validate(x))`
 * é sempre igual a `validate(x)`.
 *
 * As validações executadas são deterministas (nenhuma IA, LLM ou
 * heurística nova) e existem como certificação/diagnóstico — ver
 * `README.md` deste diretório para o racional completo de por que os
 * resultados dessas validações não têm, nesta missão, nenhum lugar
 * para serem registrados (`RawFinancialLine`/`RawFinancialDocument`
 * não têm campo de diagnóstico, e o contrato do Data Engine é
 * imutável — "Não alterar: Engine").
 */
export interface FinancialRecordValidator {
  validate(
    documents: readonly RawFinancialDocument[]
  ): readonly RawFinancialDocument[];
}
