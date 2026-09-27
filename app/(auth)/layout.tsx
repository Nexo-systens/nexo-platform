import Link from "next/link";

const CHAIN = ["Dados", "Evidências", "Interpretação", "Recomendações", "Decisões", "Aprendizado"] as const;

/**
 * Mission 203 — entrada no produto. Painel de marca (posicionamento da
 * NEXO e a cadeia EFOS) à esquerda em telas largas; formulário à
 * direita. Em telas estreitas, só a marca e o formulário.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-surface-inverse px-12 py-12 text-foreground-inverse lg:flex">
        <Link href="/" className="flex items-center gap-2.5" aria-label="NEXO">
          <span className="flex size-8 items-center justify-center rounded-md bg-foreground-inverse text-sm font-semibold text-surface-inverse">
            N
          </span>
          <span className="text-base font-semibold tracking-[0.14em]">NEXO</span>
        </Link>

        <div className="flex max-w-md flex-col gap-6">
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-foreground-inverse/60 uppercase">
            Executive Financial Operating System
          </p>
          <p className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            O sistema operacional de inteligência financeira para administrar empresas.
          </p>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-foreground-inverse/70">
            {CHAIN.map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                <span>{step}</span>
                {index < CHAIN.length - 1 && (
                  <span aria-hidden="true" className="text-foreground-inverse/35">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>

        <p className="text-xs text-foreground-inverse/50">
          A NEXO apoia a decisão. As decisões finais são sempre da empresa.
        </p>
      </aside>

      <div className="flex flex-col items-center justify-center gap-8 px-4 py-12 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 lg:hidden" aria-label="NEXO">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            N
          </span>
          <span className="text-base font-semibold tracking-[0.14em] text-foreground">NEXO</span>
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
