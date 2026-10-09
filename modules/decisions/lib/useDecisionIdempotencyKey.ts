import { useMemo, useRef } from "react";

/**
 * Mission 214 — Governed Decision Idempotency (D-137), lado do formulário.
 *
 * A chave de submissão pertence a UMA intenção concreta de um formulário
 * (nunca à empresa inteira, nunca ao conteúdo humano):
 *
 * 1. nasce só na primeira submissão daquela intenção — nunca durante a
 *    renderização;
 * 2. continua a mesma em reenvios do MESMO pedido canônico — resposta
 *    perdida, erro de rede, erro de transporte;
 * 3. é descartada depois de um sucesso confirmado (`settle()`);
 * 4. é renovada se a pessoa mudar o pedido antes de enviar de novo
 *    (assinatura diferente → chave nova).
 *
 * Isto é UX. A garantia é do servidor: mesma chave com outra impressão é
 * sempre recusada, e só o índice único decide uma corrida. A chave nunca
 * aparece na tela.
 */
export function useDecisionIdempotencyKey(): {
  /** A chave da intenção com esta assinatura (`decisionIntentSignature`). */
  readonly keyFor: (signature: string) => string;
  /** Encerra a intenção: a próxima submissão nasce com chave nova. */
  readonly settle: () => void;
} {
  const intentRef = useRef<{ readonly key: string; readonly signature: string } | null>(null);

  return useMemo(
    () => ({
      keyFor(signature: string): string {
        if (intentRef.current?.signature !== signature) {
          intentRef.current = { key: newIdempotencyKey(), signature };
        }
        return intentRef.current.key;
      },
      settle(): void {
        intentRef.current = null;
      },
    }),
    []
  );
}

/** UUID v4 do navegador; `getRandomValues` quando `randomUUID` não existe (contexto não seguro). */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
