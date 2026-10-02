import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { ContactChannel } from "@/modules/site/lib/site-config";

/** Marca NEXO: monograma + nome, a mesma do produto e da entrada. */
export function SiteBrand({ tone = "inverse", className }: { tone?: "inverse" | "default"; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 items-center justify-center rounded-md text-sm font-semibold",
          tone === "inverse" ? "bg-foreground-inverse text-surface-inverse" : "bg-primary text-primary-foreground"
        )}
      >
        N
      </span>
      <span className={cn("text-base font-semibold tracking-[0.14em]", tone === "inverse" ? "text-foreground-inverse" : "text-foreground")}>
        NEXO
      </span>
    </span>
  );
}

const ACTION_BASE =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,translate] duration-200 hover:-translate-y-px";

const ACTION_VARIANTS = {
  /** Ação principal sobre fundo escuro. */
  "primary-inverse": "bg-foreground-inverse text-surface-inverse hover:bg-white",
  /** Ação secundária sobre fundo escuro. */
  "ghost-inverse": "border border-foreground-inverse/25 text-foreground-inverse hover:border-foreground-inverse/60 hover:bg-foreground-inverse/5",
  /** Ação principal sobre fundo claro. */
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  /** Ação secundária sobre fundo claro. */
  ghost: "border border-border-strong text-foreground hover:border-foreground/40 hover:bg-surface",
} as const;

export type SiteActionVariant = keyof typeof ACTION_VARIANTS;

export function actionClass(variant: SiteActionVariant, className?: string) {
  return cn(ACTION_BASE, ACTION_VARIANTS[variant], className);
}

/** "Entrar na plataforma": sempre o login atual (quem já tem sessão segue ao produto). */
export function SignInLink({ variant, children = "Entrar na plataforma", className }: { variant: SiteActionVariant; children?: ReactNode; className?: string }) {
  return (
    <Link href="/login" className={actionClass(variant, className)}>
      {children}
    </Link>
  );
}

/**
 * CTA comercial. Com canal configurado, abre o canal (e-mail ou link
 * externo); sem ele, leva à seção de conversa da própria página.
 */
export function ContactLink({
  channel,
  variant,
  children,
  className,
}: {
  channel: ContactChannel;
  variant: SiteActionVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={channel.href}
      className={actionClass(variant, className)}
      {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
      <ArrowRight className="size-4" aria-hidden="true" />
      {channel.external && <span className="sr-only">(abre em nova aba)</span>}
    </a>
  );
}

/** Cabeçalho de seção: eyebrow, título serifado e texto de apoio. */
export function SectionIntro({
  id,
  eyebrow,
  title,
  children,
  tone = "default",
  align = "left",
  className,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  tone?: "default" | "inverse";
  align?: "left" | "center";
  className?: string;
}) {
  const inverse = tone === "inverse";
  return (
    <div className={cn("flex max-w-3xl flex-col gap-5", align === "center" && "mx-auto items-center text-center", className)}>
      <p className={cn("flex items-center gap-3 text-[0.6875rem] font-semibold tracking-[0.16em] uppercase", inverse ? "text-brass" : "text-muted-foreground")}>
        <span aria-hidden="true" className={cn("h-px w-8", inverse ? "bg-brass/70" : "bg-border-strong")} />
        {eyebrow}
      </p>
      <h2
        id={id}
        className={cn(
          "site-display text-[2.125rem] leading-[1.08] text-balance sm:text-[2.75rem] lg:text-[3.25rem]",
          inverse ? "text-foreground-inverse" : "text-foreground"
        )}
      >
        {title}
      </h2>
      {children && (
        <div className={cn("text-[1.0625rem] leading-relaxed text-pretty", inverse ? "text-foreground-inverse/72" : "text-foreground-secondary")}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Largura e respiro padrão das seções da página. */
export function SiteContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[78rem] px-4 sm:px-8 lg:px-12", className)}>{children}</div>;
}

/**
 * Quadro de produto: a tela real da NEXO reduzida a um recorte, com dados
 * fictícios declarados no próprio quadro. Não é navegador falso nem
 * captura com dado real; nada dentro dele é focável.
 */
export function ProductFrame({
  context,
  label,
  description,
  children,
  className,
}: {
  /** Área do produto (ex.: "Visão geral"). */
  context: string;
  /** Rótulo acessível da figura. */
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("site-frame overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-subtle px-4 py-2.5 sm:px-5">
        <span className="flex min-w-0 items-center gap-2 text-[0.75rem] text-muted-foreground">
          <span aria-hidden="true" className="flex size-4.5 items-center justify-center rounded bg-primary text-[0.5625rem] font-semibold text-primary-foreground">
            N
          </span>
          <span className="truncate">
            <span className="font-medium text-foreground-secondary">NEXO</span> · {context}
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
          Dados fictícios
        </span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
      <figcaption className="sr-only">
        {label}
        {description ? ` ${description}` : ""} Exemplo com dados fictícios.
      </figcaption>
    </figure>
  );
}
