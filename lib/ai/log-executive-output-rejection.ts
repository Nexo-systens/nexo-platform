import type { ExecutiveAIError } from "@/efos/application/executive-ai";
import { countExecutiveOutputViolations } from "@/efos/application/executive-output-policy";

/**
 * Mission 206 — log seguro de uma resposta de Executive AI rejeitada pela
 * política de saída (D-132): capability, provider e CONTAGENS por
 * categoria. Nunca o texto do modelo, números citados, ids, pergunta ou
 * dado da empresa. Permite medir no Pilot a taxa de rejeição real.
 */
export function logExecutiveOutputRejection(
  capability: "diagnosis" | "chat",
  error: ExecutiveAIError,
  log: (message: string) => void = (message) => console.warn(message)
): void {
  if (error.code !== "VALIDATION_FAILED" || !/^Política de saída/.test(error.message)) return;
  const counts = countExecutiveOutputViolations(error.message);
  log(
    `[executive-ai] ${capability}: resposta rejeitada pela política de saída — idioma=${counts.language} números=${counts.figures} indisponível=${counts.unavailable} sinal=${counts.sign} (provider=${error.providerName ?? "desconhecido"})`
  );
}
