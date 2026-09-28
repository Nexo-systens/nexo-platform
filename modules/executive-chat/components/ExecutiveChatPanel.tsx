"use client";

import { AlertTriangle, CornerDownRight, Send, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { KindMarker } from "@/components/shared/KindMarker";
import { SemanticBadge } from "@/components/shared/SemanticBadge";
import { TechnicalDetail } from "@/components/shared/TechnicalDetail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ExecutiveChatAnswer, ExecutiveChatGroundingStatus } from "@/efos/application/executive-chat";
import { presentExecutiveChatProviderError } from "@/modules/analysis/lib/analysis-error-message";
import { CONFIDENCE_LABELS } from "@/modules/decisions/lib/diagnosis-references";

import { askExecutiveChatQuestionAction } from "../actions/executive-chat.actions";
import { ExecutiveChatActionCard } from "./ExecutiveChatActionCard";

interface ChatTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly answer?: ExecutiveChatAnswer;
}

const SUGGESTED_QUESTIONS = [
  "Como está a saúde financeira da empresa?",
  "O que mais piorou recentemente?",
  "Quais riscos financeiros merecem atenção?",
  "Quais decisões recentes ainda precisam ser acompanhadas?",
  "Existe algum aprendizado relevante de decisões anteriores?",
];

const GROUNDING_LABELS: Record<ExecutiveChatGroundingStatus, { label: string; tone: "positive" | "warning" | "negative" }> = {
  GROUNDED: { label: "Fundamentado no contexto atual", tone: "positive" },
  PARTIAL: { label: "Fundamentado parcialmente", tone: "warning" },
  UNSUPPORTED: { label: "Sem fundamentação suficiente", tone: "negative" },
};

/**
 * Mission 188 — Executive Chat over Canonical EFOS Intelligence.
 *
 * Client Component: input/render apenas — nenhuma inferência
 * financeira acontece aqui (Seção 41). Toda a orquestração canônica
 * (resolução de verdade financeira, Knowledge, chamada de IA,
 * validação) vive em `askExecutiveChatQuestionAction()` (Server
 * Action).
 *
 * **Memória de conversa (Seção 21/D-103)**: `turns` é estado React
 * puro, session-local — nunca persistido, perdido ao recarregar a
 * página. A cada nova pergunta, o histórico completo já exibido é
 * reenviado como `priorMessages` para que o modelo tenha continuidade
 * conversacional — mas `askExecutiveChatQuestionAction()` sempre
 * resolve a verdade financeira canônica do zero a cada chamada, e o
 * modelo é instruído a nunca tratar `priorMessages` como fato (Seção
 * 22/36) — uma alucinação anterior nunca vira fato só por reaparecer
 * aqui.
 */
export function ExecutiveChatPanel({ companyId }: { companyId: string }) {
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [errorDetail, setErrorDetail] = useState<string | undefined>();
  const [lastQuestion, setLastQuestion] = useState<string | undefined>();

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || status === "loading") return;

    setStatus("loading");
    setErrorMessage(undefined);
    setErrorDetail(undefined);
    setLastQuestion(trimmed);
    const priorMessages = turns.map((turn) => ({ role: turn.role, content: turn.content }));
    setTurns((current) => [...current, { role: "user", content: trimmed }]);
    setInput("");

    try {
      const result = await askExecutiveChatQuestionAction({ companyId, question: trimmed, priorMessages });

      if (!result.success) {
        setStatus("error");
        if (result.stage === "provider") {
          const presented = presentExecutiveChatProviderError(result.error);
          setErrorMessage(presented.message);
          setErrorDetail(presented.technicalDetail);
        } else {
          setErrorMessage(result.error);
        }
        return;
      }

      setTurns((current) => [...current, { role: "assistant", content: result.answer.answer, answer: result.answer }]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro inesperado ao consultar o Executive Chat.");
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submitQuestion(input);
  }

  function handleRetry() {
    if (lastQuestion) {
      // Remove o turno de usuário que falhou antes de reenviar, para
      // não duplicá-lo na conversa.
      setTurns((current) => current.slice(0, -1));
      void submitQuestion(lastQuestion);
    }
  }

  // Mission 204 — superfície de consulta executiva: a pergunta vem
  // primeiro (campo de consulta, contexto e sugestões), e cada consulta é
  // um registro — pergunta como título, resposta como documento — da mais
  // recente para a mais antiga. O estado (`turns`), a memória de conversa
  // e o reenvio continuam exatamente os mesmos.
  const inquiries: { question: string; answer?: ChatTurn }[] = [];
  for (const turn of turns) {
    if (turn.role === "user") inquiries.push({ question: turn.content });
    else if (inquiries.length > 0) inquiries[inquiries.length - 1].answer = turn;
  }
  const pendingIndex = status === "loading" || status === "error" ? inquiries.length - 1 : -1;

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface p-4 shadow-xs">
        <label htmlFor="executive-chat-question" className="type-subsection-title">
          O que você quer entender sobre esta empresa?
        </label>
        <Textarea
          id="executive-chat-question"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ex.: Por que a margem líquida ficou negativa?"
          disabled={status === "loading"}
          className="min-h-20 resize-none border-0 bg-transparent px-0 text-[0.9375rem] shadow-none focus-visible:ring-0"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submitQuestion(input);
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="type-meta max-w-xl">
            As respostas usam a análise mais recente, as evidências e o conhecimento já formado desta empresa — nunca
            conhecimento genérico. Ações só acontecem com a sua confirmação.
          </p>
          <Button type="submit" disabled={status === "loading" || input.trim().length === 0} className="shrink-0">
            <Send className="size-4" aria-hidden="true" />
            Consultar
          </Button>
        </div>
      </form>

      {turns.length === 0 && status !== "loading" && (
        <div className="flex flex-col gap-3">
          <p className="type-eyebrow">Perguntas para começar</p>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {SUGGESTED_QUESTIONS.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  onClick={() => void submitQuestion(question)}
                  className="group flex w-full items-center justify-between gap-4 py-3 text-left text-sm text-foreground transition-colors duration-150 hover:text-primary"
                >
                  {question}
                  <CornerDownRight
                    className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inquiries.length > 0 && (
        <ol aria-label="Consultas desta sessão" className="flex flex-col gap-10">
          {inquiries
            .map((inquiry, index) => ({ inquiry, index }))
            .reverse()
            .map(({ inquiry, index }) => (
              <li key={index} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="type-eyebrow">Consulta</p>
                  <h3 className="text-[1.0625rem] leading-snug font-semibold tracking-tight text-foreground">{inquiry.question}</h3>
                </div>

                {inquiry.answer ? (
                  <InquiryAnswer turn={inquiry.answer} companyId={companyId} />
                ) : index === pendingIndex && status === "loading" ? (
                  <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
                    <span className="sr-only">Consultando o contexto desta empresa…</span>
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : index === pendingIndex && status === "error" && errorMessage ? (
                  <div role="alert" className="flex flex-col gap-2 rounded-lg border border-negative/25 bg-negative-soft p-3">
                    <div className="flex items-start gap-2 text-sm text-negative-soft-foreground">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>{errorMessage}</span>
                    </div>
                    <TechnicalDetail detail={errorDetail} />
                    <Button variant="outline" size="sm" className="w-fit" onClick={handleRetry}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}

function InquiryAnswer({ turn, companyId }: { turn: ChatTurn; companyId: string }) {
  const answer = turn.answer;
  if (!answer) {
    return <p className="text-[0.9375rem] leading-relaxed text-foreground">{turn.content}</p>;
  }

  const grounding = GROUNDING_LABELS[answer.groundingStatus];

  return (
    <article className="flex flex-col gap-5 border-l-2 border-dotted border-kind-interpretation pl-5">
      <div className="flex flex-wrap items-center gap-2">
        <SemanticBadge tone={grounding.tone}>{grounding.label}</SemanticBadge>
        {answer.requiresScenarioSimulation && (
          <SemanticBadge tone="info">
            <ShieldAlert className="size-3" aria-hidden="true" />
            Requer simulação no Scenario Lab
          </SemanticBadge>
        )}
      </div>

      <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-pretty text-foreground">{answer.answer}</p>

      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-2">
        {answer.factualClaims.length > 0 && (
          <AnswerGroup title="Fatos considerados" kind="evidence">
            {answer.factualClaims.map((claim) => (
              <li key={claim.id} className="py-2 text-sm text-foreground">
                {claim.statement}
              </li>
            ))}
          </AnswerGroup>
        )}

        {answer.analysis.length > 0 && (
          <AnswerGroup title="Análise" kind="interpretation">
            {answer.analysis.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-2 text-sm text-foreground">
                <span>{item.statement}</span>
                <SemanticBadge>{CONFIDENCE_LABELS[item.confidence] ?? item.confidence}</SemanticBadge>
              </li>
            ))}
          </AnswerGroup>
        )}

        {answer.hypotheses.length > 0 && (
          <AnswerGroup title="Hipóteses a validar" kind="hypothesis">
            {answer.hypotheses.map((hypothesis) => (
              <li key={hypothesis.id} className="flex flex-col gap-0.5 py-2 text-sm text-foreground">
                <span>{hypothesis.statement}</span>
                <span className="type-meta">Validação necessária: {hypothesis.validationNeeded}</span>
              </li>
            ))}
          </AnswerGroup>
        )}

        {answer.limitations.length > 0 && (
          <AnswerGroup title="Limites desta resposta" kind="hypothesis">
            {answer.limitations.map((limitation) => (
              <li key={limitation.id} className="flex flex-col gap-0.5 py-2 text-sm text-foreground">
                <span>{limitation.statement}</span>
                <span className="type-meta">{limitation.reason}</span>
              </li>
            ))}
          </AnswerGroup>
        )}
      </div>

      {/*
        Mission 189 — sempre visualmente SEPARADA do texto da resposta
        (Seção 40) — nunca misturada com `answer`/análise/hipóteses.
        `proposedActions` é opcional (D-104); `?? []` trata ausência
        exatamente como "nenhuma ação", nunca um erro.
      */}
      {(answer.proposedActions ?? []).length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-subtle p-4">
          <p className="type-eyebrow">Ações sugeridas — só acontecem se você confirmar</p>
          {(answer.proposedActions ?? []).map((action, index) => (
            <ExecutiveChatActionCard key={`${action.type}-${index}`} companyId={companyId} action={action} />
          ))}
        </div>
      )}
    </article>
  );
}

function AnswerGroup({
  title,
  kind,
  children,
}: {
  title: string;
  kind: "evidence" | "interpretation" | "hypothesis";
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <KindMarker kind={kind} />
        <span className="type-meta">· {title}</span>
      </div>
      <ul className="flex flex-col divide-y divide-border">{children}</ul>
    </section>
  );
}
