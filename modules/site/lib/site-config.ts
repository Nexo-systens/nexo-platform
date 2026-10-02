/**
 * Mission 205 — configuração da página institucional.
 *
 * Nenhum contato ou domínio é inventado no código: o canal comercial e a
 * URL pública vêm de variáveis de ambiente definidas na publicação.
 *
 * - `NEXT_PUBLIC_NEXO_CONTACT_URL`: canal da conversa comercial
 *   (`mailto:` ou `https://`, ex.: agenda ou WhatsApp). Sem ele, os
 *   botões levam à seção de conversa da própria página, que não exibe
 *   nenhum contato fictício.
 * - `NEXT_PUBLIC_SITE_URL`: origem pública (ex.: `https://nexoefos.com.br`).
 *   Sem ela, canonical e imagem de compartilhamento ficam de fora — o
 *   Next exige URL absoluta e uma origem errada seria publicada.
 */

type SiteEnv = Readonly<Record<string, string | undefined>>;

export const CONVERSATION_ANCHOR = "#conversar";

export interface ContactChannel {
  readonly href: string;
  /** Há um canal real configurado (e-mail ou link externo). */
  readonly configured: boolean;
  readonly external: boolean;
}

export function resolveContactChannel(env: SiteEnv): ContactChannel {
  const raw = env.NEXT_PUBLIC_NEXO_CONTACT_URL?.trim();
  if (raw) {
    if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(raw)) {
      return { href: raw, configured: true, external: false };
    }
    try {
      const url = new URL(raw);
      if (url.protocol === "https:") return { href: url.toString(), configured: true, external: true };
    } catch {
      // Valor inválido: tratado como ausente, nunca publicado.
    }
  }
  return { href: CONVERSATION_ANCHOR, configured: false, external: false };
}

/** Origem pública validada (só https, sem caminho), ou `undefined`. */
export function resolveSiteUrl(env: SiteEnv): URL | undefined {
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || (url.pathname !== "/" && url.pathname !== "")) return undefined;
    return new URL(url.origin);
  } catch {
    return undefined;
  }
}
