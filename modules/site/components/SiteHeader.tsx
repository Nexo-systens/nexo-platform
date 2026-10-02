import Link from "next/link";

import { ContactLink, SiteBrand, SiteContainer } from "@/modules/site/components/SitePrimitives";
import { SiteMobileNav } from "@/modules/site/components/SiteMobileNav";
import type { ContactChannel } from "@/modules/site/lib/site-config";

export const SITE_NAV = [
  { href: "#efos", label: "EFOS" },
  { href: "#produto", label: "Produto" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#founding-company", label: "Founding Company" },
] as const;

/** Cabeçalho institucional: escuro e sólido, fixo no topo, com filete ao rolar (CSS). */
export function SiteHeader({ contact }: { contact: ContactChannel }) {
  return (
    <header className="site-header sticky top-0 z-40 border-b border-transparent bg-surface-inverse">
      <SiteContainer className="relative flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="NEXO — início" className="shrink-0">
          <SiteBrand />
        </Link>

        <nav aria-label="Seções da página" className="hidden lg:block">
          <ul className="flex items-center gap-7">
            {SITE_NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-[0.8125rem] text-foreground-inverse/72 transition-colors hover:text-foreground-inverse">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/login" className="text-[0.8125rem] font-medium text-foreground-inverse/85 transition-colors hover:text-foreground-inverse">
            Entrar
          </Link>
          <ContactLink channel={contact} variant="primary-inverse" className="h-9 px-4 text-[0.8125rem]">
            Conhecer a NEXO
          </ContactLink>
        </div>

        <SiteMobileNav items={SITE_NAV} contact={{ href: contact.href, label: "Conhecer a NEXO", external: contact.external }} />
      </SiteContainer>
    </header>
  );
}
