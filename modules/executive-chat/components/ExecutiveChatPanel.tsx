"use client";

import { AlertTriangle, CircleHelp, Lightbulb, MessageCircle, Send, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ExecutiveChatAnswer, ExecutiveChatGroundingStatus } from "@/efos/application/executive-chat";

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

const GROUNDING_LABELS: Record<ExecutiveChatGroundingStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  GROUNDED: { label: "Fundamentado no contexto atual", variant: "default" },
  PARTIAL: { label: "Fundamentado parcialmente", variant: "secondary" },
  UNSUPPORTED: { label: "Sem fundamentação suficiente", variant: "destructive" },
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
  const [lastQuestion, setLastQuestion] = useState<string | undefined>();

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || status === "loading") return;

    setStatus("loading");
    setErrorMessage(undefined);
    setLastQuestion(trimmed);
    const priorMessages = turns.map((turn) => ({ role: turn.role, content: turn.content }));
    setTurns((current) => [...current, { role: "user", content: trimmed }]);
    setInput("");

    try {
      const result = await askExecutiveChatQuestionAction({ companyId, question: trimmed, priorMessages });

      if (!result.success) {
        setStatus("error");
        setErrorMessage(result.error);
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

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      {turns.length === 0 && status !== "loading" && (
        <EmptyState
          icon={MessageCircle}
          title="Pergunte à NEXO sobre esta empresa"
          description="Respostas são sempre fundamentadas no contexto financeiro canônico, evidências e conhecimento organizacional já governado desta empresa — nunca em conhecimento genérico."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <Button key={question} variant="outline" size="sm" onClick={() => void submitQuestion(question)}>
                  {question}
                </Button>
              ))}
            </div>
          }
        />
      )}

      {turns.length > 0 && (
        <div className="flex flex-col gap-4">
          {turns.map((turn, index) => (
            <ChatTurnView key={index} turn={turn} companyId={companyId} />
          ))}
        </div>
      )}

      {status === "loading" && (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          <Button variant="outline" size="sm" className="w-fit" onClick={handleRetry}>
            Tentar novamente
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pergunte algo sobre esta empresa..."
          disabled={status === "loading"}
          className="min-h-10"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submitQuestion(input);
            }
          }}
        />
        <Button type="submit" disabled={status === "loading" || input.trim().length === 0} className="shrink-0">
          <Send className="size-4" aria-hidden="true" />
          Enviar
        </Button>
      </form>
    </div>
  );
}

function ChatTurnView({ turn, companyId }: { turn: ChatTurn; companyId: string }) {
  if (turn.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
        {turn.content}
      </div>
    );
  }

  const answer = turn.answer;
  if (!answer) {
    return <div className="max-w-[85%] rounded-lg border border-border px-3 py-2 text-sm text-foreground">{turn.content}</div>;
  }

  const grounding = GROUNDING_LABELS[answer.groundingStatus];

  return (
    <div className="flex max-w-[95%] flex-col gap-3 rounded-lg border border-border px-3 py-3 text-sm text-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={grounding.variant}>{grounding.label}</Badge>
        {answer.requiresScenarioSimulation && (
          <Badge variant="outline" className="gap-1">
            <ShieldAlert className="size-3" aria-hidden="true" />
            Requer simulação no Scenario Lab
          </Badge>
        )}
      </div>

      <p>{answer.answer}</p>

      {answer.factualClaims.length > 0 && (
        <ChatSection title="Fatos considerados" icon={CircleHelp}>
          {answer.factualClaims.map((claim) => (
            <li key={claim.id}>{claim.statement}</li>
          ))}
        </ChatSection>
      )}

      {answer.analysis.length > 0 && (
        <ChatSection title="Análise executiva" icon={Lightbulb}>
          {answer.analysis.map((item) => (
            <li key={item.id}>
              {item.statement} <span className="text-xs text-muted-foreground">(confiança: {item.confidence})</span>
            </li>
          ))}
        </ChatSection>
      )}

      {answer.hypotheses.length > 0 && (
        <ChatSection title="Hipóteses a validar" icon={Lightbulb}>
          {answer.hypotheses.map((hypothesis) => (
            <li key={hypothesis.id}>
              {hypothesis.statement}{" "}
              <span className="text-xs text-muted-foreground">— validação necessária: {hypothesis.validationNeeded}</span>
            </li>
          ))}
        </ChatSection>
      )}

      {answer.limitations.length > 0 && (
        <ChatSection title="Limitações desta resposta" icon={AlertTriangle}>
          {answer.limitations.map((limitation) => (
            <li key={limitation.id}>
              {limitation.statement} <span className="text-xs text-muted-foreground">({limitation.reason})</span>
            </li>
          ))}
        </ChatSection>
      )}

      {/*
        Mission 189 — sempre visualmente SEPARADA do texto da resposta
        (Seção 40) — nunca misturada com `answer`/análise/hipóteses.
        `proposedActions` é opcional (D-104); `?? []` trata ausência
        exatamente como "nenhuma ação", nunca um erro.
      */}
      {(answer.proposedActions ?? []).length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">Ações sugeridas</div>
          {(answer.proposedActions ?? []).map((action, index) => (
            <ExecutiveChatActionCard key={`${action.type}-${index}`} companyId={companyId} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChatSection({ title, icon: Icon, children }: { title: string; icon: typeof CircleHelp; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {title}
      </div>
      <ul className="list-inside list-disc space-y-1 text-sm">{children}</ul>
    </div>
  );
}
