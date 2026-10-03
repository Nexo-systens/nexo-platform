import { KindMarker } from "@/components/shared/KindMarker";
import { SemanticBadge } from "@/components/shared/SemanticBadge";
import type { ExecutiveDiagnosis } from "@/efos/application/executive-diagnosis/ExecutiveDiagnosis";
import type { InterpretationBasis } from "@/efos/application/executive-diagnosis/ExecutiveDiagnosis.types";
import { cn } from "@/lib/utils";
import {
  ACTION_KIND_LABELS,
  CONFIDENCE_LABELS,
  QUESTION_ORIGIN_LABELS,
  REFERENCE_KIND_LABELS,
  resolveReference,
  type ReferenceKind,
  type ReferenceLabels,
} from "@/modules/decisions/lib/diagnosis-references";

/**
 * Mission 204 — leitura da Executive AI.
 *
 * Continua inequívoco que é interpretação (camada "o que o EFOS infere",
 * marcador vazado, aviso explícito), mas sem a moldura tracejada âmbar e
 * sem ids técnicos: a base de cada afirmação aparece pelos nomes do que
 * a análise de origem calculou ("Liquidez Corrente", "Margem Líquida
 * negativa"). Conhecimento histórico tem aparência própria — nunca se
 * confunde com fato financeiro atual (Mission 148). Perguntas e
 * incertezas ficam recolhidas (divulgação progressiva).
 */

/** Base de uma afirmação, pelos nomes da análise de origem (exportada para o relatório executivo, Mission 208). */
export function DiagnosisBasis({ basis, references }: { basis: InterpretationBasis; references: ReferenceLabels }) {
  const current: { kind: ReferenceKind; id: string }[] = [
    ...(basis.indicatorIds ?? []).map((id) => ({ kind: "indicator" as const, id })),
    ...(basis.evidenceIds ?? []).map((id) => ({ kind: "evidence" as const, id })),
    ...(basis.contextIds ?? []).map((id) => ({ kind: "context" as const, id })),
    ...(basis.conflictIds ?? []).map((id) => ({ kind: "conflict" as const, id })),
  ];
  const historical = (basis.knowledgeIds ?? []).map((id) => ({ kind: "knowledge" as const, id }));

  if (current.length === 0 && historical.length === 0) {
    return <p className="type-meta">Sem base rastreável</p>;
  }

  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[0.75rem]">
      <span className="text-muted-foreground">Base:</span>
      {current.map((item, index) => {
        const reference = resolveReference(references, item.kind, item.id);
        return (
          <span
            key={`${item.kind}-${item.id}-${index}`}
            title={`${REFERENCE_KIND_LABELS[item.kind]}${reference.resolved ? "" : ` — ${item.id}`}`}
            className={cn(
              "rounded-sm bg-surface-sunken px-1.5 py-0.5 text-foreground-secondary",
              !reference.resolved && "italic text-muted-foreground"
            )}
          >
            <span className="sr-only">{REFERENCE_KIND_LABELS[item.kind]}: </span>
            {reference.label}
          </span>
        );
      })}
      {historical.map((item, index) => {
        const reference = resolveReference(references, item.kind, item.id);
        return (
          <span
            key={`knowledge-${item.id}-${index}`}
            className="rounded-sm border border-dashed border-kind-hypothesis/60 px-1.5 py-0.5 text-foreground-secondary"
          >
            <span className="font-medium">Conhecimento histórico: </span>
            {reference.label}
          </span>
        );
      })}
    </p>
  );
}

function Group({
  title,
  count,
  children,
  heading: Heading = "h4",
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  heading?: "h3" | "h4";
}) {
  if (count === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <Heading className="type-eyebrow">
        {title} <span className="num">· {count}</span>
      </Heading>
      <ul className="flex flex-col divide-y divide-border">{children}</ul>
    </section>
  );
}

function Item({
  statement,
  aside,
  detail,
  basis,
  references,
}: {
  statement: string;
  aside?: React.ReactNode;
  detail?: React.ReactNode;
  basis?: InterpretationBasis;
  references: ReferenceLabels;
}) {
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-pretty text-foreground">{statement}</p>
        {aside}
      </div>
      {detail && <p className="type-meta">{detail}</p>}
      {basis && <DiagnosisBasis basis={basis} references={references} />}
    </li>
  );
}

export function ExecutiveDiagnosisView({
  diagnosis,
  references = new Map(),
  generatedAt,
  embedded = false,
}: {
  diagnosis: ExecutiveDiagnosis;
  references?: ReferenceLabels;
  generatedAt?: string;
  /** Mission 208 — dentro do relatório executivo o título vem da seção do documento; fica só o aviso. */
  embedded?: boolean;
}) {
  const followUps = diagnosis.questions.length + diagnosis.uncertainties.length;
  const groupHeading = embedded ? "h3" : "h4";

  return (
    <article className="flex flex-col gap-6 border-l-2 border-dotted border-kind-interpretation pl-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <KindMarker kind="interpretation" />
          {generatedAt && <span className="type-meta">· gerada em {generatedAt}</span>}
        </div>
        {!embedded && <h3 className="type-section-title">Leitura da Executive AI</h3>}
        <p className="type-meta max-w-3xl">
          <strong className="font-medium text-foreground-secondary">Interpretação, não fato contábil.</strong> Leitura gerada
          por IA sobre o que o EFOS já calculou — nunca uma decisão nem uma execução. Revise cada afirmação antes de agir.
        </p>
      </header>

      {/* Mission 208 — no relatório executivo o resumo já abre o documento (Situação executiva). */}
      {!embedded && (
        <div className="flex flex-col gap-2">
          <p className="type-eyebrow">Resumo executivo</p>
          <p className="max-w-3xl text-[1.0625rem] leading-relaxed text-pretty text-foreground">
            {diagnosis.executiveSummary.statement}
          </p>
          <DiagnosisBasis basis={diagnosis.executiveSummary.basis} references={references} />
        </div>
      )}

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <Group heading={groupHeading} title="Prioridades" count={diagnosis.priorities.length}>
          {[...diagnosis.priorities]
            .sort((a, b) => a.rank - b.rank)
            .map((item) => (
              <Item
                key={item.id}
                statement={`${item.rank}. ${item.statement}`}
                detail={item.reason}
                basis={item.basis}
                references={references}
              />
            ))}
        </Group>

        <Group heading={groupHeading} title="Riscos" count={diagnosis.risks.length}>
          {diagnosis.risks.map((item) => (
            <Item
              key={item.id}
              statement={item.statement}
              aside={
                <SemanticBadge tone={item.type === "CONFIRMED_SIGNAL" ? "negative" : "warning"}>
                  {item.type === "CONFIRMED_SIGNAL" ? "Sinal confirmado" : "Risco inferido"}
                </SemanticBadge>
              }
              basis={item.basis}
              references={references}
            />
          ))}
        </Group>

        <Group heading={groupHeading} title="Interpretações" count={diagnosis.interpretations.length}>
          {diagnosis.interpretations.map((item) => (
            <Item
              key={item.id}
              statement={item.statement}
              aside={<SemanticBadge>{CONFIDENCE_LABELS[item.confidence] ?? item.confidence}</SemanticBadge>}
              basis={item.basis}
              references={references}
            />
          ))}
        </Group>

        <Group heading={groupHeading} title="Hipóteses" count={diagnosis.hypotheses.length}>
          {diagnosis.hypotheses.map((item) => (
            <Item
              key={item.id}
              statement={item.statement}
              aside={<SemanticBadge>{CONFIDENCE_LABELS[item.confidence] ?? item.confidence}</SemanticBadge>}
              detail={`Validação necessária: ${item.validationNeeded}`}
              basis={item.basis}
              references={references}
            />
          ))}
        </Group>

        <Group heading={groupHeading} title="Ações possíveis" count={diagnosis.possibleActions.length}>
          {diagnosis.possibleActions.map((item) => (
            <Item
              key={item.id}
              statement={item.statement}
              aside={<SemanticBadge tone="info">{ACTION_KIND_LABELS[item.kind] ?? item.kind}</SemanticBadge>}
              basis={item.basis}
              references={references}
            />
          ))}
        </Group>

        <Group heading={groupHeading} title="Interpretações de conflito" count={diagnosis.conflictInterpretations.length}>
          {diagnosis.conflictInterpretations.map((item) => (
            <Item
              key={item.id}
              statement={item.statement}
              detail={item.conflictSignals.join(" · ")}
              basis={item.basis}
              references={references}
            />
          ))}
        </Group>
      </div>

      {followUps > 0 && (
        <details className="rounded-lg bg-surface-subtle px-4 py-3">
          <summary className="cursor-pointer text-[0.8125rem] font-medium text-foreground select-none">
            Perguntas em aberto e incertezas <span className="num text-muted-foreground">· {followUps}</span>
          </summary>
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {diagnosis.questions.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-2.5">
                <p className="text-sm text-foreground">{item.question}</p>
                <SemanticBadge>{QUESTION_ORIGIN_LABELS[item.raisedFrom] ?? item.raisedFrom}</SemanticBadge>
              </li>
            ))}
            {diagnosis.uncertainties.map((item) => (
              <li key={item.id} className="flex flex-col gap-0.5 py-2.5">
                <p className="text-sm text-foreground">{item.statement}</p>
                <p className="type-meta">{item.reason}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
