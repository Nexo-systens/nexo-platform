import type { Metadata } from "next";

import { resolveSiteUrl } from "@/modules/site/lib/site-config";

export const SITE_TITLE = "NEXO — Inteligência financeira para administrar empresas";
export const SITE_DESCRIPTION =
  "A NEXO é um Executive Financial Operating System: transforma os demonstrativos da empresa em evidências, cenários e decisões acompanhadas, com fato e interpretação sempre separados.";

/** Imagem de compartilhamento (1200×630) em `public/`. */
export const SITE_OG_IMAGE = "/og/nexo-og.png";

/**
 * Mission 205 — metadata da página institucional. Canonical, URL e imagem
 * de compartilhamento só entram com `NEXT_PUBLIC_SITE_URL` definido
 * (pronto para `nexoefos.com.br`): sem origem, o Next resolveria as URLs
 * contra um host provisório.
 */
export function buildSiteMetadata(env: Readonly<Record<string, string | undefined>>): Metadata {
  const siteUrl = resolveSiteUrl(env);
  const openGraph: Metadata["openGraph"] = {
    type: "website",
    locale: "pt_BR",
    siteName: "NEXO",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  };

  if (!siteUrl) {
    return { title: { absolute: SITE_TITLE }, description: SITE_DESCRIPTION, openGraph };
  }

  const image = {
    url: SITE_OG_IMAGE,
    width: 1200,
    height: 630,
    alt: "NEXO — Executive Financial Operating System",
  };
  return {
    metadataBase: siteUrl,
    title: { absolute: SITE_TITLE },
    description: SITE_DESCRIPTION,
    alternates: { canonical: "/" },
    openGraph: { ...openGraph, url: "/", images: [image] },
    twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [image.url] },
  };
}
