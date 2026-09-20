import type { ExecutiveFinancialContext } from "@/efos/application/executive-context";
import type { ExecutiveKnowledgeContext } from "@/efos/application/executive-knowledge-context";

import {
  EXECUTIVE_AI_AUTHORITY,
  EXECUTIVE_AI_CONSTRAINTS,
  EXECUTIVE_AI_OBJECTIVE,
  EXECUTIVE_AI_OUTPUT_CONTRACT,
  type ExecutiveAIInstruction,
} from "./ExecutiveAIInstruction";

/**
 * Constrói um `ExecutiveAIInstruction` a partir de um
 * `ExecutiveFinancialContext` já produzido (Mission 117, Etapa 14).
 * Função pura, determinística — mesmos argumentos sempre produzem a
 * mesma instrução; `instructionId` é recebido como parâmetro (nunca
 * gerado internamente com `crypto.randomUUID()`/`Date.now()`), mesmo
 * princípio já usado em toda a Application Layer para manter Builders
 * livres de I/O e não-determinismo (ex.: `buildAuditTrail(timestamp)`
 * em `financial-model.mapper.ts`, que recebe `timestamp` em vez de
 * lê-lo do relógio).
 *
 * **`context` nunca é transformado** — é atribuído por referência
 * direta ao campo `context` da instrução, exatamente como recebido.
 * Nenhuma leitura de `context.financialTruth`/`unknowns`/`conflicts`
 * acontece aqui além da passagem direta — o builder não arredonda
 * valores, não remove indicadores "inconvenientes", não recalcula
 * nada, não converte um `Unknown` em zero/negativo/falso (Etapa 10/11
 * — preservação estrutural, não por convenção: como o builder nunca
 * lê os campos individualmente, não há oportunidade de alterá-los).
 *
 * Nenhuma chamada de rede, nenhum SDK de provider, nenhum banco,
 * nenhuma UI, nenhum Supabase (Etapa 14).
 *
 * `knowledgeContext?` (Mission 143 — Knowledge Injection into
 * Executive Analysis, D-075) — quarto parâmetro opcional, mesmo
 * princípio de `context`: recebido por referência direta, nunca
 * transformado/reinterpretado aqui. Omitido quando ausente (nunca um
 * `undefined` explícito no objeto retornado) — mesmo padrão de
 * `historicalIntelligence?` em `buildExecutiveFinancialContext()`
 * (Mission 114), para que `serializeExecutiveAIInstruction()` nunca
 * produza uma chave `knowledgeContext: null` quando não houver
 * `Knowledge` a integrar.
 */
export function buildExecutiveAIInstruction(
  context: ExecutiveFinancialContext,
  instructionId: string,
  knowledgeContext?: ExecutiveKnowledgeContext
): ExecutiveAIInstruction {
  return {
    instructionId,
    context,
    ...(knowledgeContext ? { knowledgeContext } : {}),
    objective: EXECUTIVE_AI_OBJECTIVE,
    authority: EXECUTIVE_AI_AUTHORITY,
    outputContract: EXECUTIVE_AI_OUTPUT_CONTRACT,
    constraints: EXECUTIVE_AI_CONSTRAINTS,
  };
}
