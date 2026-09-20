import type { ExecutiveAIInstruction } from "@/efos/application/executive-ai-instruction";

/**
 * Requisição enviada a um `ExecutiveAIProvider` (Mission 116 —
 * Executive AI Provider Boundary; revisado pela Mission 117 —
 * Executive AI Prompt Contract, D-061). Carrega **exclusivamente**
 * `instruction: ExecutiveAIInstruction` — nunca `context` diretamente
 * (Mission 117, Etapa 16: a instrução é a unidade canônica entregue
 * ao provider; `context` já vive dentro dela, `instruction.context`
 * — expor as duas ao mesmo tempo criaria duas fontes paralelas do
 * mesmo dado, exatamente o que a missão proíbe).
 *
 * Deliberadamente **nunca** contém: `Decision`/`Outcome` (D-011/
 * Mission 115 — a IA nunca vê nem produz decisão/execução), cliente de
 * banco/Supabase, estado de UI/React, comando de execução. Nenhum
 * desses conceitos é representável neste tipo — a fronteira é
 * estrutural, não apenas convencional.
 */
export interface ExecutiveAIRequest {
  readonly instruction: ExecutiveAIInstruction;
  readonly requestId?: string;
  readonly requestedAt?: string;
}
