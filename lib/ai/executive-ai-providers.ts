import { randomUUID } from "node:crypto";

import type { ExecutiveAIProvider } from "@/efos/application/executive-ai";
import type { ExecutiveChatProvider } from "@/efos/application/executive-chat";
import {
  CapturingExecutiveAIProvider,
  CapturingExecutiveChatProvider,
} from "@/efos/application/synthetic-validation";
import { AnthropicExecutiveAIProvider } from "@/efos/infrastructure/executive-ai";
import { AnthropicExecutiveChatProvider } from "@/efos/infrastructure/executive-chat";

/**
 * Mission 204 — modo de inspeção visual LOCAL/SINTÉTICO.
 *
 * Para inspecionar localmente o Diagnóstico, a Central de Decisões e o
 * Executive Chat com conteúdo, sem chamar a Anthropic, o app pode usar os
 * stand-ins determinísticos da Mission 160 (`Capturing*Provider`): eles
 * leem SOMENTE a instrução real montada pelo EFOS e devolvem uma resposta
 * que passa pela mesma validação e persistência de produção — nenhuma
 * Engine paralela, nenhum dado inventado fora da instrução.
 *
 * Só liga quando TODAS as condições valem:
 * - `NODE_ENV` diferente de `production` (nunca em `next build`/`start`);
 * - `NEXO_LOCAL_SYNTHETIC_AI=1` declarado explicitamente;
 * - o Supabase configurado é local (`127.0.0.1`/`localhost`).
 * Contra o NEXO Pilot (ou qualquer host remoto), o provider é sempre o real.
 * O `providerName` persistido identifica o diagnóstico sintético.
 */
export const LOCAL_SYNTHETIC_AI_PROVIDER_NAME = "nexo-local-synthetic-ai";

export function isLocalSyntheticAiEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.NEXO_LOCAL_SYNTHETIC_AI !== "1") return false;
  try {
    const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

export function createExecutiveAIProvider(): ExecutiveAIProvider {
  if (!isLocalSyntheticAiEnabled()) return new AnthropicExecutiveAIProvider();
  const now = new Date().toISOString();
  return new CapturingExecutiveAIProvider({
    providerName: LOCAL_SYNTHETIC_AI_PROVIDER_NAME,
    diagnosisId: randomUUID(),
    generatedAt: now,
    receivedAt: now,
  });
}

export function createExecutiveChatProvider(): ExecutiveChatProvider {
  if (!isLocalSyntheticAiEnabled()) return new AnthropicExecutiveChatProvider();
  const now = new Date().toISOString();
  return new CapturingExecutiveChatProvider({
    providerName: LOCAL_SYNTHETIC_AI_PROVIDER_NAME,
    answerId: randomUUID(),
    generatedAt: now,
    receivedAt: now,
  });
}
