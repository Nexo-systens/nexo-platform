import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  DecisionFrame,
  EvidenceFrame,
  InquiryFrame,
  LearningFrame,
  PortfolioFrame,
  ScenarioFrame,
} from "@/modules/site/components/ProductFrames";
import { SectionIntro, SiteContainer } from "@/modules/site/components/SitePrimitives";

/**
 * Mission 205 — o produto: mapa das capacidades, a narrativa situação →
 * evidência → cenário → decisão → resultado, a separação entre fato e
 * inferência e o Executive Chat. Só capacidades que existem hoje; nenhuma
 * integração automática, previsão ou execução automática é prometida.
 */

const CAPABILITIES = [
  { name: "Visão executiva", text: "O que mudou, o que pede atenção e o que aguarda decisão — por empresa e no portfólio.", href: "#visao-executiva" },
  { name: "Executive Analysis", text: "Indicadores, evidências e trajetória período a período, com fato e inferência separados.", href: "#evidencia" },
  { name: "Scenario Lab", text: "Simulações com base, cenário e diferença lado a lado, antes da escolha.", href: "#cenario" },
  { name: "Decision Center", text: "Revisão da leitura da IA, registro da decisão e acompanhamento da execução.", href: "#decisao" },
  { name: "Executive Chat", text: "Perguntas executivas respondidas a partir do que a NEXO já sabe da empresa.", href: "#chat" },
  { name: "Knowledge", text: "Resultados e aprendizados das decisões, preservados como memória da empresa.", href: "#resultado" },
] as const;

export function SiteCapabilities() {
  return (
    <section aria-labelledby="produto-titulo" id="produto" className="bg-background pt-24 pb-12 sm:pt-32 sm:pb-16">
      <SiteContainer className="flex flex-col gap-14">
        <SectionIntro id="produto-titulo" eyebrow="O produto" title="Do demonstrativo à decisão, em um só sistema." className="site-reveal">
          <p>
            A empresa envia seus demonstrativos. A NEXO organiza os dados, calcula os indicadores e conduz o restante do caminho — cada parte
            alimenta a seguinte, sem planilhas paralelas.
          </p>
        </SectionIntro>
        <ul className="site-reveal grid grid-cols-[minmax(0,1fr)] gap-px border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((capability) => (
            <li key={capability.name} className="bg-background">
              <a href={capability.href} className="group flex h-full flex-col gap-2 px-1 py-6 transition-colors hover:bg-surface sm:px-6">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[1rem] font-semibold tracking-tight text-foreground">{capability.name}</span>
                  <span aria-hidden="true" className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
                <span className="text-[0.875rem] leading-relaxed text-foreground-secondary">{capability.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </SiteContainer>
    </section>
  );
}

function StoryStep({
  id,
  number,
  module,
  title,
  children,
  points,
  frame,
  reverse = false,
}: {
  id: string;
  number: string;
  module: string;
  title: string;
  children: ReactNode;
  points: readonly string[];
  frame: ReactNode;
  reverse?: boolean;
}) {
  return (
    <li
      id={id}
      className={cn(
        "site-reveal relative grid grid-cols-[minmax(0,1fr)] gap-10 py-14 sm:py-20 lg:items-center lg:gap-16",
        reverse ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" : "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
      )}
    >
      <div className={cn("flex flex-col gap-5", reverse && "lg:order-2")}>
        <p className="flex items-baseline gap-3">
          <span aria-hidden="true" className="num site-display text-[2.5rem] leading-none text-primary/30">{number}</span>
          <span className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{module}</span>
        </p>
        <h3 className="site-display text-[1.875rem] leading-[1.1] text-balance text-foreground sm:text-[2.25rem]">{title}</h3>
        <div className="text-[1rem] leading-relaxed text-foreground-secondary">{children}</div>
        <ul className="flex flex-col gap-2.5 border-t border-border pt-5">
          {points.map((point) => (
            <li key={point} className="flex gap-3 text-[0.875rem] leading-relaxed text-foreground-secondary">
              <span aria-hidden="true" className="mt-2 h-px w-3 shrink-0 bg-foreground/40" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(reverse && "lg:order-1")}>{frame}</div>
    </li>
  );
}

export function SiteStory() {
  return (
    <section aria-labelledby="como-funciona-titulo" id="como-funciona" className="bg-background pb-16 sm:pb-24">
      <SiteContainer>
        <h2 id="como-funciona-titulo" className="sr-only">
          Como funciona
        </h2>
        <ol className="divide-y divide-border border-t border-border">
          <StoryStep
            id="visao-executiva"
            number="01"
            module="Visão executiva"
            title="Comece pelo que mudou."
            points={[
              "Situação do período comparada à análise anterior, em uma frase.",
              "Variações sempre com direção em texto — nunca só em cor.",
              "Para quem acompanha várias empresas, o portfólio em uma leitura.",
            ]}
            frame={<PortfolioFrame />}
          >
            <p>
              A primeira leitura responde se a empresa está melhor ou pior que no período anterior, quais sinais pedem atenção e o que aguarda
              decisão.
            </p>
          </StoryStep>

          <StoryStep
            id="evidencia"
            number="02"
            module="Executive Analysis"
            title="Sinais, não suposições."
            reverse
            points={[
              "Margens, liquidez, endividamento e prazos acompanhados período a período.",
              "Cada indicador leva à sua origem nos documentos.",
              "Quando falta dado, a NEXO diz que está indisponível — nunca mostra zero.",
            ]}
            frame={<EvidenceFrame />}
          >
            <p>
              Quando uma deterioração se sustenta ao longo dos períodos, ela vira evidência: um padrão identificado por regra, com origem
              rastreável — não uma impressão.
            </p>
          </StoryStep>

          <StoryStep
            id="cenario"
            number="03"
            module="Scenario Lab"
            title="Teste antes de decidir."
            points={[
              "Hoje: mudanças em despesas operacionais e no prazo de recebimento, e a comparação entre cenários.",
              "O que você está assumindo fica escrito ao lado do resultado.",
              "Cenários são simulações sobre a última análise, nunca previsões.",
            ]}
            frame={<ScenarioFrame />}
          >
            <p>
              Simule uma alternativa e veja, lado a lado, a base atual, o valor com o cenário e a diferença em cada indicador afetado.
            </p>
          </StoryStep>

          <StoryStep
            id="decisao"
            number="04"
            module="Decision Center"
            title="A decisão vira um objeto de gestão."
            reverse
            points={[
              "A leitura da IA é revisada antes de qualquer escolha.",
              "A decisão pode concordar com a IA, divergir dela ou existir sem ela.",
              "Responsável, prazo e trilha: decidida, em execução, concluída.",
            ]}
            frame={<DecisionFrame />}
          >
            <p>
              A recomendação não é o fim. A empresa registra o que decidiu, por quê e quem conduz — e acompanha a execução até a conclusão.
            </p>
          </StoryStep>

          <StoryStep
            id="resultado"
            number="05"
            module="Resultado e Knowledge"
            title="O que aconteceu depois."
            points={[
              "Resultado observado registrado pela empresa, com os números de antes e depois.",
              "Aprendizado classificado pela força da evidência disponível.",
              "Decisões independentes com o mesmo desfecho formam conhecimento — associação no tempo, nunca prova de causa.",
            ]}
            frame={<LearningFrame />}
          >
            <p>Cada decisão concluída deixa um registro do que se esperava, do que aconteceu e do que fica para as próximas.</p>
          </StoryStep>
        </ol>
      </SiteContainer>
    </section>
  );
}

const KNOWN = [
  { kind: "Indicador calculado", example: "Margem Líquida de -4,26% em agosto de 2026.", note: "Calculado a partir dos documentos." },
  { kind: "Evidência", example: "Margem Líquida em queda há 4 períodos consecutivos.", note: "Padrão identificado por regra, com origem." },
] as const;

const INFERRED = [
  { kind: "Interpretação", example: "Os indicadores, em conjunto, sugerem um período que pede atenção executiva.", note: "Com nível de confiança." },
  { kind: "Hipótese", example: "O padrão pode continuar se as condições operacionais se mantiverem.", note: "Com o que é preciso para validá-la." },
  { kind: "Risco", example: "Um sinal confirmado indica risco já presente no período atual.", note: "Sempre ligado às evidências de base." },
  { kind: "Recomendação", example: "Revisar a estrutura de custos operacionais.", note: "Proposta para decisão — nunca executada sozinha." },
] as const;

function LayerItem({ kind, example, note, inferred }: { kind: string; example: string; note: string; inferred: boolean }) {
  return (
    <li className="flex flex-col gap-2 border-t border-foreground-inverse/12 py-5">
      <span className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-foreground-inverse/65 uppercase">
        <span
          aria-hidden="true"
          className={cn("inline-block size-2 rounded-full", inferred ? "ring-2 ring-brass/80 ring-inset" : "bg-foreground-inverse/80")}
        />
        {kind}
      </span>
      <span className="text-[1rem] leading-relaxed text-foreground-inverse">“{example}”</span>
      <span className="text-[0.8125rem] text-foreground-inverse/66">{note}</span>
    </li>
  );
}

export function SiteAnalysisLayers() {
  return (
    <section aria-labelledby="analise-titulo" id="analise" className="site-ledger bg-surface-inverse pt-24 pb-20 text-foreground-inverse sm:pt-32 sm:pb-24">
      <SiteContainer className="flex flex-col gap-14">
        <SectionIntro
          id="analise-titulo"
          eyebrow="Executive Analysis"
          tone="inverse"
          title="Fato é fato. Interpretação é interpretação."
          className="site-reveal"
        >
          <p>
            A NEXO não gera texto sobre números. Cada afirmação carrega a sua natureza, e o que é inferido nunca se apresenta como certeza.
          </p>
        </SectionIntro>

        <div className="site-reveal grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2.5 text-[0.9375rem] font-semibold">
              <span aria-hidden="true" className="size-2 rounded-full bg-foreground-inverse/80" />O que sabemos
            </h3>
            <ul>
              {KNOWN.map((item) => (
                <LayerItem key={item.kind} {...item} inferred={false} />
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2.5 text-[0.9375rem] font-semibold">
              <span aria-hidden="true" className="size-2 rounded-full ring-2 ring-brass/80 ring-inset" />O que é inferido
            </h3>
            <ul className="grid gap-x-10 sm:grid-cols-2">
              {INFERRED.map((item) => (
                <LayerItem key={item.kind} {...item} inferred />
              ))}
            </ul>
          </div>
        </div>
        <p className="site-reveal max-w-3xl text-[0.875rem] leading-relaxed text-foreground-inverse/66">
          Exemplos com dados fictícios. Na plataforma, cada natureza tem marcação própria e a leitura da IA aparece sempre identificada como
          interpretação, nunca como fato contábil.
        </p>
      </SiteContainer>
    </section>
  );
}

export function SiteChat() {
  return (
    <section aria-labelledby="chat-titulo" id="chat" className="bg-background py-24 sm:py-32">
      <SiteContainer className="grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-20">
        <div className="site-reveal flex flex-col gap-8">
          <SectionIntro id="chat-titulo" eyebrow="Executive Chat" title="Pergunte à inteligência da sua empresa.">
            <p>
              Perguntas executivas respondidas a partir da análise mais recente, das evidências e do conhecimento já formado desta empresa — não
              de conhecimento genérico.
            </p>
          </SectionIntro>
          <ul className="flex flex-col gap-3 border-t border-border pt-6">
            {[
              "A resposta separa fatos considerados, interpretação e hipóteses a validar.",
              "Cada resposta indica se está fundamentada no contexto atual da empresa.",
              "Quando cabe, leva direto ao cenário, à decisão ou ao conhecimento relacionado.",
              "Quando sugere uma ação, nada acontece sem a sua confirmação.",
            ].map((point) => (
              <li key={point} className="flex gap-3 text-[0.9375rem] leading-relaxed text-foreground-secondary">
                <span aria-hidden="true" className="mt-2.5 h-px w-3 shrink-0 bg-foreground/40" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="site-reveal">
          <InquiryFrame />
        </div>
      </SiteContainer>
    </section>
  );
}
