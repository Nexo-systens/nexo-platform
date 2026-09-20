import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ExecutiveDiagnosis } from "@/efos/application/executive-diagnosis/ExecutiveDiagnosis";
import type { InterpretationBasis } from "@/efos/application/executive-diagnosis/ExecutiveDiagnosis.types";

/**
 * Mission 127 — Executive Review & Decision Interface. Renderiza um
 * `ExecutiveDiagnosis` real (D-059) — puramente apresentacional, nunca
 * calcula/interpreta/reclassifica nada.
 *
 * **Separação visual obrigatória (Etapa 3)**: um aviso fixo no topo
 * afirma explicitamente que este conteúdo é interpretação da IA, não
 * Financial Truth — nunca omitido, nunca condicional. Cada item
 * interpretativo (`interpretations`/`hypotheses`/`risks`/`priorities`/
 * `possibleActions`/`conflictInterpretations`) exibe sua `basis`
 * (Etapa 4: "cada item interpretativo deve manter sua basis visível ou
 * acessível") — nunca apresentado como fato confirmado, sempre
 * rotulado como o que estruturalmente é.
 */

function BasisBadges({ basis }: { basis: InterpretationBasis }) {
  const currentTruth = [
    ...(basis.indicatorIds ?? []).map((id) => ({ id, kind: "indicador" })),
    ...(basis.evidenceIds ?? []).map((id) => ({ id, kind: "evidência" })),
    ...(basis.contextIds ?? []).map((id) => ({ id, kind: "contexto" })),
    ...(basis.conflictIds ?? []).map((id) => ({ id, kind: "conflito" })),
  ];
  // Mission 148 — Knowledge-Conditioned Executive Decision Intelligence
  // (D-080/Etapa 19). Badges de conhecimento histórico renderizadas com
  // uma variante visual DIFERENTE das 4 categorias de Financial Truth
  // acima — nunca a mesma aparência, para que o executivo nunca confunda
  // "conhecimento histórico citado" com "fato financeiro atual" só de
  // olhar a UI.
  const historicalKnowledge = (basis.knowledgeIds ?? []).map((id) => ({ id, kind: "conhecimento histórico" }));

  if (currentTruth.length === 0 && historicalKnowledge.length === 0) {
    return <span className="text-xs text-muted-foreground">Sem base rastreável</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {currentTruth.map((item, index) => (
        <Badge key={`${item.kind}-${item.id}-${index}`} variant="outline" className="text-[10px]">
          {item.kind}: {item.id}
        </Badge>
      ))}
      {historicalKnowledge.map((item, index) => (
        <Badge key={`${item.kind}-${item.id}-${index}`} variant="secondary" className="text-[10px]">
          {item.kind}: {item.id}
        </Badge>
      ))}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium text-foreground">
        {title} <span className="text-xs font-normal text-muted-foreground">({count})</span>
      </h4>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function ExecutiveDiagnosisView({ diagnosis }: { diagnosis: ExecutiveDiagnosis }) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border-2 border-dashed border-amber-400/60 bg-amber-50/40 p-4 dark:bg-amber-950/10">
      <div className="flex items-start gap-2 rounded-lg bg-amber-100/80 p-3 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="text-xs leading-relaxed">
          <strong>Interpretação da Executive AI — não é Financial Truth.</strong> Tudo abaixo é uma leitura
          gerada por IA sobre os dados financeiros já calculados pelo EFOS — nunca um fato confirmado,
          nunca uma decisão, nunca uma execução. Cada afirmação precisa ser revisada por um humano antes de
          qualquer ação.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Resumo executivo
        </span>
        <p className="text-sm text-foreground">{diagnosis.executiveSummary.statement}</p>
        <BasisBadges basis={diagnosis.executiveSummary.basis} />
      </div>

      <Section title="Interpretações" count={diagnosis.interpretations.length}>
        {diagnosis.interpretations.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-foreground">{item.statement}</p>
              <Badge variant="secondary" className="shrink-0 text-[10px]">{item.confidence}</Badge>
            </div>
            <div className="mt-2"><BasisBadges basis={item.basis} /></div>
          </div>
        ))}
      </Section>

      <Section title="Hipóteses" count={diagnosis.hypotheses.length}>
        {diagnosis.hypotheses.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-foreground">{item.statement}</p>
              <Badge variant="secondary" className="shrink-0 text-[10px]">{item.confidence}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Validação necessária: {item.validationNeeded}</p>
            <div className="mt-2"><BasisBadges basis={item.basis} /></div>
          </div>
        ))}
      </Section>

      <Section title="Riscos" count={diagnosis.risks.length}>
        {diagnosis.risks.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-foreground">{item.statement}</p>
              <Badge
                variant={item.type === "CONFIRMED_SIGNAL" ? "default" : "secondary"}
                className="shrink-0 text-[10px]"
              >
                {item.type === "CONFIRMED_SIGNAL" ? "sinal confirmado" : "risco inferido"}
              </Badge>
            </div>
            <div className="mt-2"><BasisBadges basis={item.basis} /></div>
          </div>
        ))}
      </Section>

      <Section title="Prioridades" count={diagnosis.priorities.length}>
        {[...diagnosis.priorities]
          .sort((a, b) => a.rank - b.rank)
          .map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">#{item.rank}</Badge>
                <p className="text-sm text-foreground">{item.statement}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
              <div className="mt-2"><BasisBadges basis={item.basis} /></div>
            </div>
          ))}
      </Section>

      <Section title="Ações possíveis" count={diagnosis.possibleActions.length}>
        {diagnosis.possibleActions.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-foreground">{item.statement}</p>
              <Badge variant="secondary" className="shrink-0 text-[10px]">{item.kind}</Badge>
            </div>
            <div className="mt-2"><BasisBadges basis={item.basis} /></div>
          </div>
        ))}
      </Section>

      <Section title="Perguntas" count={diagnosis.questions.length}>
        {diagnosis.questions.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <p className="text-sm text-foreground">{item.question}</p>
            <p className="mt-1 text-xs text-muted-foreground">origem: {item.raisedFrom}</p>
          </div>
        ))}
      </Section>

      <Section title="Incertezas" count={diagnosis.uncertainties.length}>
        {diagnosis.uncertainties.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <p className="text-sm text-foreground">{item.statement}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
          </div>
        ))}
      </Section>

      <Section title="Interpretações de conflito" count={diagnosis.conflictInterpretations.length}>
        {diagnosis.conflictInterpretations.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <p className="text-sm text-foreground">{item.statement}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {item.conflictSignals.map((signal, index) => (
                <Badge key={`${item.id}-signal-${index}`} variant="outline" className="text-[10px]">
                  {signal}
                </Badge>
              ))}
            </div>
            <div className="mt-2"><BasisBadges basis={item.basis} /></div>
          </div>
        ))}
      </Section>
    </div>
  );
}
