import { SituationFrame } from "@/modules/site/components/ProductFrames";
import { ContactLink, SectionIntro, SignInLink, SiteContainer } from "@/modules/site/components/SitePrimitives";
import type { ContactChannel } from "@/modules/site/lib/site-config";

/**
 * Mission 205 — abertura da página: hero, problema e a categoria (EFOS).
 * Toda afirmação aqui é sustentada pelo produto atual ou é tese declarada
 * da NEXO (docs/00_FUNDACION); nenhum número de mercado, cliente ou selo.
 */

const HERO_CHAIN = ["Dados financeiros", "Evidências", "Cenários", "Decisões", "Acompanhamento"] as const;

export function SiteHero({ contact }: { contact: ContactChannel }) {
  return (
    <section aria-labelledby="hero-titulo" className="site-ledger relative overflow-hidden bg-surface-inverse text-foreground-inverse">
      <SiteContainer className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 pt-16 pb-20 sm:pt-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-16 lg:pt-24 lg:pb-28">
        <div className="site-enter flex flex-col gap-8">
          <p className="flex items-center gap-3 text-[0.6875rem] font-semibold tracking-[0.18em] text-brass uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-brass/70" />
            Executive Financial Operating System
          </p>
          <h1 id="hero-titulo" className="site-display text-[2.75rem] leading-[1.03] text-balance sm:text-[3.5rem] xl:text-[4rem]">
            Inteligência financeira para administrar empresas.
          </h1>
          <p className="max-w-xl text-[1.0625rem] leading-relaxed text-pretty text-foreground-inverse/75 sm:text-lg">
            A NEXO lê os demonstrativos da sua empresa, mostra o que mudou e por quê, testa alternativas antes da escolha e acompanha cada
            decisão até o resultado que ela produziu.
          </p>
          <ol aria-label="O caminho que a NEXO organiza" className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[0.8125rem] text-foreground-inverse/80">
            {HERO_CHAIN.map((step, index) => (
              <li key={step} className="flex items-center gap-2.5">
                <span>{step}</span>
                {index < HERO_CHAIN.length - 1 && (
                  <span aria-hidden="true" className="text-brass">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ContactLink channel={contact} variant="primary-inverse">
              Conversar sobre a NEXO
            </ContactLink>
            <SignInLink variant="ghost-inverse" />
          </div>
          <p className="text-[0.8125rem] text-foreground-inverse/66">Para fundadores, CEOs e diretores financeiros de empresas estruturadas.</p>
        </div>

        <div className="site-enter-delayed relative">
          <SituationFrame className="lg:translate-x-2" />
        </div>
      </SiteContainer>
    </section>
  );
}

const PROBLEMS = [
  {
    title: "Dados espalhados",
    text: "DRE, balanço, extratos e relatórios vivem em lugares diferentes e raramente conversam entre si.",
  },
  {
    title: "Informação que chega tarde",
    text: "Quando o fechamento fica pronto, a janela para agir já ficou menor.",
  },
  {
    title: "Números sem conclusão",
    text: "Os indicadores estão lá. O que eles significam juntos — e o que pedem agora — não está.",
  },
  {
    title: "Relatórios que olham para trás",
    text: "O relatório explica o mês passado, mas não organiza o próximo movimento.",
  },
  {
    title: "Cenário longe da decisão",
    text: "Simulações vivem em planilhas paralelas, desconectadas do que foi decidido depois.",
  },
  {
    title: "Decisões que não ensinam",
    text: "O que foi decidido, por quê e o que aconteceu depois raramente fica registrado.",
  },
] as const;

export function SiteProblem() {
  return (
    <section aria-labelledby="problema-titulo" id="problema" className="bg-background py-24 sm:py-32">
      <SiteContainer className="grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
        <div className="site-reveal lg:sticky lg:top-28 lg:self-start">
          <SectionIntro id="problema-titulo" eyebrow="O problema" title="Os números existem. A decisão continua difícil.">
            <p>
              Empresas nunca produziram tanta informação financeira. Transformá-la em decisão ainda depende de planilhas, reuniões e da
              experiência de quem administra.
            </p>
          </SectionIntro>
        </div>
        <ol className="grid gap-x-10 sm:grid-cols-2">
          {PROBLEMS.map((problem, index) => (
            <li key={problem.title} className="site-reveal flex flex-col gap-2 border-t border-border-strong py-5 sm:gap-2.5 sm:py-7">
              <span className="num text-[0.75rem] font-medium tracking-[0.12em] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="text-[1.0625rem] font-semibold tracking-tight text-foreground">{problem.title}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-foreground-secondary">{problem.text}</p>
            </li>
          ))}
        </ol>
      </SiteContainer>
    </section>
  );
}

const LAYERS = [
  { name: "BI", role: "visualiza informações" },
  { name: "Contabilidade", role: "organiza fatos e obrigações" },
  { name: "ERP", role: "registra operações" },
] as const;

const EFOS_VERBS = ["interpreta a realidade financeira", "identifica evidências", "constrói cenários", "organiza decisões", "acompanha resultados"] as const;

const CYCLE = [
  { step: "Evidência", text: "Padrões detectados nos números, com origem rastreável." },
  { step: "Contexto", text: "O que esses padrões significam para esta empresa." },
  { step: "Cenário", text: "O efeito de uma alternativa, antes de escolhê-la." },
  { step: "Recomendação", text: "Um caminho proposto, com fundamento e nível de confiança." },
  { step: "Decisão", text: "A escolha da empresa, com justificativa e responsável." },
  { step: "Resultado", text: "O que de fato aconteceu depois." },
  { step: "Aprendizado", text: "O que fica para as próximas decisões." },
] as const;

export function SiteCategory() {
  return (
    <section aria-labelledby="efos-titulo" id="efos" className="border-y border-border bg-surface py-24 sm:py-32">
      <SiteContainer className="flex flex-col gap-16">
        <div className="site-reveal grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-20">
          <SectionIntro id="efos-titulo" eyebrow="A categoria" title="A camada que faltava entre os seus sistemas e as suas decisões." />
          <div className="flex flex-col gap-4 text-[1.0625rem] leading-relaxed text-foreground-secondary">
            <p>
              Cada sistema da empresa cumpre um papel essencial. Ainda falta quem transforme o que eles produzem em decisão — e acompanhe o que
              acontece depois.
            </p>
            <p>
              <strong className="font-semibold text-foreground">Executive Financial Operating System (EFOS)</strong> é essa categoria. A NEXO é o
              sistema que a implementa.
            </p>
          </div>
        </div>

        <div className="site-reveal flex flex-col" role="list" aria-label="Camadas de sistemas de uma empresa">
          <div role="listitem" className="site-ledger relative overflow-hidden rounded-t-2xl bg-surface-inverse px-6 py-8 text-foreground-inverse sm:px-10 sm:py-10">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-center">
              <div className="flex flex-col gap-1">
                <span className="text-[0.6875rem] font-semibold tracking-[0.16em] text-brass uppercase">Camada de decisão</span>
                <span className="site-display text-[2rem] leading-none">EFOS</span>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2.5 text-[0.9375rem] text-foreground-inverse/85">
                {EFOS_VERBS.map((verb) => (
                  <li key={verb} className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-brass" />
                    {verb}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {LAYERS.map((layer, index) => (
            <div
              key={layer.name}
              role="listitem"
              className={`grid gap-1 border-x border-b border-border bg-surface-subtle px-6 py-5 sm:px-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-center ${
                index === LAYERS.length - 1 ? "rounded-b-2xl" : ""
              }`}
            >
              <span className="site-display text-[1.375rem] text-foreground">{layer.name}</span>
              <span className="text-[0.9375rem] text-foreground-secondary">{layer.role}</span>
            </div>
          ))}
          <p className="mt-5 max-w-3xl text-[0.875rem] leading-relaxed text-muted-foreground">
            A NEXO não substitui ERP, contabilidade ou BI: trabalha a partir do que eles produzem. Hoje, a partir dos demonstrativos que a empresa
            envia — DRE, balanço ou balancete e extratos, em PDF ou CSV.
          </p>
        </div>

        <div className="site-reveal flex flex-col gap-8">
          <h3 className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">O ciclo que a NEXO organiza</h3>
          <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-7">
            {CYCLE.map((item, index) => (
              <li key={item.step} className="flex flex-col gap-2 bg-surface p-4 last:col-span-2 sm:gap-3 sm:p-5 lg:min-h-48 lg:last:col-span-1">
                <span className="num text-[0.75rem] font-medium text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <span className="site-display text-[1.1875rem] leading-tight text-foreground sm:text-[1.375rem]">{item.step}</span>
                <span className="text-[0.8125rem] leading-relaxed text-foreground-secondary">{item.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </SiteContainer>
    </section>
  );
}
