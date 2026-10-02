import type { Metadata } from "next";

import { SiteConversation, SiteFooter, SiteFounding, SiteTrust } from "@/modules/site/components/SiteClosing";
import { SiteHeader } from "@/modules/site/components/SiteHeader";
import { SiteCategory, SiteHero, SiteProblem } from "@/modules/site/components/SiteOpening";
import { SiteAnalysisLayers, SiteCapabilities, SiteChat, SiteStory } from "@/modules/site/components/SiteProduct";
import { resolveContactChannel } from "@/modules/site/lib/site-config";
import { buildSiteMetadata } from "@/modules/site/lib/site-metadata";

/**
 * Mission 205 — página institucional e comercial da NEXO em `/`.
 *
 * Pública e estática: não lê sessão nem cookies (o proxy manda quem já
 * está autenticado para `/dashboard`, como antes). Server Components do
 * início ao fim; a única ilha client é o menu em telas estreitas.
 */
export const metadata: Metadata = buildSiteMetadata(process.env);

export default function SitePage() {
  const contact = resolveContactChannel(process.env);

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-surface px-4 py-2 text-sm font-medium text-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader contact={contact} />
      <main id="conteudo" className="flex flex-col">
        <SiteHero contact={contact} />
        <SiteProblem />
        <SiteCategory />
        <SiteCapabilities />
        <SiteStory />
        <SiteAnalysisLayers />
        <SiteChat />
        <SiteTrust />
        <SiteFounding contact={contact} />
        <SiteConversation contact={contact} />
      </main>
      <SiteFooter contact={contact} />
    </>
  );
}
