import { Check, Minus } from "lucide-react";
import Link from "next/link";

import { ContactLink, SectionIntro, SignInLink, SiteBrand, SiteContainer } from "@/modules/site/components/SitePrimitives";
import { SITE_NAV } from "@/modules/site/components/SiteHeader";
import type { ContactChannel } from "@/modules/site/lib/site-config";

/**
 * Mission 205 — confiança, Founding Company, conversa e rodapé.
 *
 * Segurança: só fatos do produto e do documento do programa — nenhum selo,
 * certificação ou adjetivo ("bank-grade", "100% seguro"). Founding
 * Company: sem preço, sem condições inventadas (elas são documentadas à
 * parte). Rodapé: sem endereço, CNPJ, telefone ou política inexistente.
 */

const PROTECTS = [
  { title: "Acesso autenticado", text: "Todas as áreas da plataforma exigem login." },
  { title: "Isolamento entre empresas", text: "Os dados de cada empresa ficam restritos a ela, com isolamento aplicado no próprio banco de dados." },
  { title: "Encerramento governado", text: "Ao encerrar a participação, os dados são removidos conforme os prazos definidos nas condições do programa." },
  {
    title: "Fornecedores declarados",
    text: "Os fornecedores de infraestrutura e de inteligência artificial, e o que eles processam, estão descritos nas condições do programa.",
  },
] as const;

const NEVER = [
  { title: "Não executa decisões", text: "Nenhuma decisão financeira é tomada ou executada automaticamente. Quem decide é sempre a empresa." },
  { title: "Não movimenta recursos", text: "A NEXO não acessa contas bancárias nem movimenta dinheiro." },
  { title: "Não pede credenciais", text: "Nunca solicita senhas, credenciais bancárias, tokens ou certificados digitais." },
  { title: "Não disfarça inferência", text: "Interpretação nunca aparece como fato, e dado ausente nunca aparece como zero." },
] as const;

export function SiteTrust() {
  return (
    <section aria-labelledby="seguranca-titulo" id="seguranca" className="border-y border-border bg-surface-subtle py-24 sm:py-28">
      <SiteContainer className="flex flex-col gap-14">
        <SectionIntro id="seguranca-titulo" eyebrow="Segurança e confiança" title="Confiança se constrói com regras claras." className="site-reveal">
          <p>A NEXO apoia decisões financeiras. Por isso, o que ela faz — e o que nunca faz — está escrito.</p>
        </SectionIntro>
        <div className="site-reveal grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-2">
            <h3 className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Como a NEXO protege a sua empresa</h3>
            <ul className="flex flex-col">
              {PROTECTS.map((item) => (
                <li key={item.title} className="flex gap-4 border-t border-border-strong py-5">
                  <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden="true" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[1rem] font-semibold tracking-tight text-foreground">{item.title}</span>
                    <span className="text-[0.9375rem] leading-relaxed text-foreground-secondary">{item.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">O que a NEXO nunca faz</h3>
            <ul className="flex flex-col">
              {NEVER.map((item) => (
                <li key={item.title} className="flex gap-4 border-t border-border-strong py-5">
                  <Minus className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[1rem] font-semibold tracking-tight text-foreground">{item.title}</span>
                    <span className="text-[0.9375rem] leading-relaxed text-foreground-secondary">{item.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SiteContainer>
    </section>
  );
}

const PROGRAM = [
  { title: "Acesso inicial à plataforma", text: "Uso da NEXO com os demonstrativos da própria empresa, desde esta fase." },
  { title: "Proximidade com o produto", text: "Contato direto com quem constrói a NEXO, inclusive no envio dos documentos e no uso." },
  { title: "Feedback que vira produto", text: "O que a sua empresa observa no uso influencia as próximas evoluções." },
  {
    title: "Condições documentadas",
    text: "As condições desta fase estão em um documento próprio, apresentado e aceito antes do envio de qualquer documento financeiro.",
  },
] as const;

const AUDIENCE = ["Fundadores e CEOs", "CFOs e diretores financeiros", "Sócios de empresas estruturadas"] as const;

export function SiteFounding({ contact }: { contact: ContactChannel }) {
  return (
    <section aria-labelledby="founding-titulo" id="founding-company" className="bg-background py-24 sm:py-32">
      <SiteContainer className="grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div className="site-reveal flex flex-col gap-8">
          <SectionIntro id="founding-titulo" eyebrow="Founding Company Program" title="As primeiras empresas entram como Founding Companies.">
            <p>
              Um programa inicial para empresas selecionadas, com acesso à NEXO desde o começo e participação direta na evolução do produto.
            </p>
          </SectionIntro>
          <div className="flex flex-col gap-3">
            <h3 className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Para quem é</h3>
            <ul className="flex flex-wrap gap-2">
              {AUDIENCE.map((role) => (
                <li key={role} className="rounded-full border border-border-strong px-3.5 py-1.5 text-[0.8125rem] text-foreground-secondary">
                  {role}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <ContactLink channel={contact} variant="primary">
              Quero conhecer o programa
            </ContactLink>
          </div>
        </div>
        <ol className="site-reveal flex flex-col rounded-2xl border border-border bg-surface px-6 py-2 shadow-xs sm:px-8">
          {PROGRAM.map((item, index) => (
            <li key={item.title} className="flex gap-5 border-b border-border py-6 last:border-b-0">
              <span aria-hidden="true" className="num site-display text-[1.5rem] leading-none text-primary/35">{String(index + 1).padStart(2, "0")}</span>
              <div className="flex flex-col gap-1.5">
                <span className="text-[1rem] font-semibold tracking-tight text-foreground">{item.title}</span>
                <span className="text-[0.9375rem] leading-relaxed text-foreground-secondary">{item.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </SiteContainer>
    </section>
  );
}

export function SiteConversation({ contact }: { contact: ContactChannel }) {
  return (
    <section aria-labelledby="conversar-titulo" id="conversar" className="site-ledger bg-surface-inverse pt-24 pb-20 text-foreground-inverse sm:pt-32">
      <SiteContainer className="site-reveal flex flex-col items-center gap-8 text-center">
        <p className="flex items-center gap-3 text-[0.6875rem] font-semibold tracking-[0.18em] text-brass uppercase">
          <span aria-hidden="true" className="h-px w-8 bg-brass/70" />
          Conversar
          <span aria-hidden="true" className="h-px w-8 bg-brass/70" />
        </p>
        <h2 id="conversar-titulo" className="site-display max-w-3xl text-[2.375rem] leading-[1.06] text-balance sm:text-[3.25rem]">
          Vamos conversar sobre a sua empresa.
        </h2>
        <p className="max-w-xl text-[1.0625rem] leading-relaxed text-foreground-inverse/72">
          Uma conversa para entender o momento da empresa, mostrar a NEXO em funcionamento e avaliar se o Founding Company Program faz sentido.
        </p>
        {contact.configured ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <ContactLink channel={contact} variant="primary-inverse">
              Conversar sobre a NEXO
            </ContactLink>
            <SignInLink variant="ghost-inverse" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <p className="max-w-lg text-[0.9375rem] leading-relaxed text-foreground-inverse/80">
              Nesta fase, a NEXO conversa diretamente com as empresas convidadas para o programa.
            </p>
            <SignInLink variant="ghost-inverse" />
          </div>
        )}
      </SiteContainer>
    </section>
  );
}

export function SiteFooter({ contact }: { contact: ContactChannel }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-surface-inverse pb-10 text-foreground-inverse">
      <SiteContainer className="flex flex-col gap-10">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 border-t border-foreground-inverse/10 pt-12 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <SiteBrand />
            <p className="max-w-xs text-[0.875rem] leading-relaxed text-foreground-inverse/60">
              Executive Financial Operating System. Inteligência financeira para administrar empresas.
            </p>
          </div>
          <nav aria-label="Rodapé" className="flex flex-col gap-3">
            <span className="text-[0.6875rem] font-semibold tracking-[0.16em] text-foreground-inverse/62 uppercase">Página</span>
            <ul className="flex flex-col gap-2">
              {SITE_NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-[0.875rem] text-foreground-inverse/70 transition-colors hover:text-foreground-inverse">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-3">
            <span className="text-[0.6875rem] font-semibold tracking-[0.16em] text-foreground-inverse/62 uppercase">Acesso</span>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/login" className="text-[0.875rem] text-foreground-inverse/70 transition-colors hover:text-foreground-inverse">
                  Entrar na plataforma
                </Link>
              </li>
              {contact.configured && (
                <li>
                  <a
                    href={contact.href}
                    className="text-[0.875rem] text-foreground-inverse/70 transition-colors hover:text-foreground-inverse"
                    {...(contact.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    Conversar sobre a NEXO
                    {contact.external && <span className="sr-only"> (abre em nova aba)</span>}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-foreground-inverse/10 pt-6 text-[0.75rem] text-foreground-inverse/62 sm:flex-row sm:justify-between">
          <span>© {year} NEXO</span>
          <span>A NEXO apoia a decisão. As decisões finais são sempre da empresa.</span>
        </div>
      </SiteContainer>
    </footer>
  );
}
