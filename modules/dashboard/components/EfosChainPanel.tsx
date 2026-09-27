const STAGES = [
  { title: "Dados", detail: "Demonstrativos enviados pela empresa." },
  { title: "Evidências", detail: "Fatos identificados por regras, com origem." },
  { title: "Interpretação", detail: "Situações e hipóteses a partir das evidências." },
  { title: "Recomendações", detail: "Ações sugeridas para avaliação." },
  { title: "Decisões", detail: "Escolhas da empresa, registradas e acompanhadas." },
  { title: "Resultados e aprendizado", detail: "O que aconteceu depois, e o que isso ensina." },
] as const;

/**
 * Mission 203 — explica, de forma compacta, como a NEXO transforma
 * dados em decisão (a arquitetura mental do EFOS), para que cada
 * número da tela tenha um lugar nessa cadeia.
 */
export function EfosChainPanel() {
  return (
    <section aria-labelledby="efos-titulo" className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-5">
      <div className="flex flex-col gap-1">
        <p className="type-eyebrow">EFOS</p>
        <h2 id="efos-titulo" className="type-section-title">
          Da informação à decisão
        </h2>
      </div>
      <ol className="flex flex-col">
        {STAGES.map((stage, index) => (
          <li key={stage.title} className="relative flex gap-3 pb-3 last:pb-0">
            {index < STAGES.length - 1 && (
              <span aria-hidden="true" className="absolute top-5 bottom-0 left-[0.5625rem] w-px bg-border-strong" />
            )}
            <span
              aria-hidden="true"
              className="num relative mt-0.5 flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-[0.625rem] font-semibold text-foreground-secondary"
            >
              {index + 1}
            </span>
            <div className="flex flex-col">
              <span className="text-[0.8125rem] font-medium text-foreground">{stage.title}</span>
              <span className="type-meta">{stage.detail}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
