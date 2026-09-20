"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ExecutiveDiagnosis } from "@/efos/application/executive-diagnosis/ExecutiveDiagnosis";
import type { DiagnosisReviewStatus } from "@/efos/application/diagnosis-review/DiagnosisReview";
import { submitDiagnosisReviewAction } from "@/modules/decisions/actions/human-review.actions";
import type { PersistedDiagnosisReview } from "@/modules/decisions/services/diagnosis-review-persistence.service";

const SUBMITTABLE_STATUSES: readonly { value: DiagnosisReviewStatus; label: string }[] = [
  { value: "ACCEPTED", label: "Aceitar integralmente" },
  { value: "PARTIALLY_ACCEPTED", label: "Aceitar parcialmente" },
  { value: "REJECTED", label: "Rejeitar integralmente" },
  { value: "SUPERSEDED", label: "Substituir revisão anterior" },
];

interface DiagnosisItem {
  readonly id: string;
  readonly statement: string;
}

function collectDiagnosisItems(diagnosis: ExecutiveDiagnosis): readonly DiagnosisItem[] {
  return [
    ...diagnosis.interpretations,
    ...diagnosis.hypotheses,
    ...diagnosis.risks,
    ...diagnosis.priorities,
    ...diagnosis.possibleActions,
    ...diagnosis.conflictInterpretations,
  ].map((item) => ({ id: item.id, statement: item.statement }));
}

/**
 * Mission 127, Etapa 5 — Human Review Interface. Todos os 5 estados
 * oficiais (`DiagnosisReviewStatus`, D-063) são representáveis:
 * `PENDING` é exibido como rótulo implícito quando não existe nenhuma
 * revisão persistida ainda (nunca oferecido como opção de envio — o
 * próprio contrato documenta que `PENDING` nunca é um registro real);
 * os outros 4 são as opções de envio.
 *
 * `reviewer_user_id`/`reviewedBy` nunca aparecem neste formulário —
 * são resolvidos inteiramente no servidor (`submitDiagnosisReviewAction`,
 * D-065). A submissão é bloqueada (`disabled`) durante o processamento
 * (Etapa 9 — proteção contra duplo clique) e o histórico exibido vem
 * sempre de `history` (dado canônico, prop vinda de um Server
 * Component que consulta o banco — Etapa 8, nunca localStorage).
 *
 * Mission 137, Etapa 3 — `router.refresh()` após sucesso (mesmo padrão
 * de `ExecutiveDiagnosisActivation`, Mission 128): a Server Action já
 * chama `revalidatePath()`, mas isso só invalida o cache — sem
 * `router.refresh()` o client nunca força o Server Component pai a
 * relê-lo, então `history` continuaria mostrando a lista antiga até uma
 * navegação manual. Corrigido nesta missão (achado real de auditoria,
 * não hipotético).
 */
export function DiagnosisReviewSection({
  companyId,
  diagnosis,
  history,
}: {
  companyId: string;
  diagnosis: ExecutiveDiagnosis;
  history: readonly PersistedDiagnosisReview[];
}) {
  const router = useRouter();
  const items = useMemo(() => collectDiagnosisItems(diagnosis), [diagnosis]);
  const [status, setStatus] = useState<DiagnosisReviewStatus | "">("");
  const [decisions, setDecisions] = useState<Record<string, "accepted" | "rejected">>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [errors, setErrors] = useState<readonly string[] | undefined>();
  const [success, setSuccess] = useState(false);

  function toggleItem(id: string, value: "accepted" | "rejected") {
    setDecisions((prev) => ({ ...prev, [id]: prev[id] === value ? (undefined as unknown as "accepted" | "rejected") : value }));
  }

  async function handleSubmit() {
    if (!status || submitting) return;

    let acceptedItems: string[] = [];
    let rejectedItems: string[] = [];

    if (status === "ACCEPTED") {
      acceptedItems = items.map((item) => item.id);
    } else if (status === "REJECTED") {
      rejectedItems = items.map((item) => item.id);
    } else if (status === "PARTIALLY_ACCEPTED") {
      acceptedItems = items.filter((item) => decisions[item.id] === "accepted").map((item) => item.id);
      rejectedItems = items.filter((item) => decisions[item.id] === "rejected").map((item) => item.id);
      if (acceptedItems.length === 0 || rejectedItems.length === 0) {
        setError("Revisão parcial exige ao menos um item aceito e ao menos um item não aceito.");
        return;
      }
    }
    // SUPERSEDED: nenhum item obrigatório.

    setSubmitting(true);
    setError(undefined);
    setErrors(undefined);
    setSuccess(false);

    try {
      const result = await submitDiagnosisReviewAction({
        companyId,
        diagnosisId: diagnosis.id,
        status,
        acceptedItems,
        rejectedItems,
        modifiedItems: [],
        notes: notes.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error);
        setErrors(result.errors);
        return;
      }

      setSuccess(true);
      setStatus("");
      setDecisions({});
      setNotes("");
      router.refresh();
    } catch {
      setError("Erro inesperado ao enviar a revisão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revisão humana (Human Review)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {history.length === 0 ? (
          <Badge variant="outline" className="w-fit">PENDING — ainda não revisado por nenhum humano</Badge>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Histórico de revisões (mais recente primeiro)
            </span>
            {history.map((review) => (
              <div key={review.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{review.review.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  revisado por: <span className="font-mono">{review.reviewerUserId}</span>
                </p>
                {review.review.notes && <p className="mt-1 text-sm text-foreground">{review.review.notes}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>Status da revisão</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as DiagnosisReviewStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o que você concluiu ao revisar" />
            </SelectTrigger>
            <SelectContent>
              {SUBMITTABLE_STATUSES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {status === "PARTIALLY_ACCEPTED" && items.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>Marque cada item como aceito ou rejeitado</Label>
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                <span className="text-sm text-foreground">{item.statement}</span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={decisions[item.id] === "accepted" ? "default" : "outline"}
                    onClick={() => toggleItem(item.id, "accepted")}
                  >
                    Aceitar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={decisions[item.id] === "rejected" ? "destructive" : "outline"}
                    onClick={() => toggleItem(item.id, "rejected")}
                  >
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>Notas (opcional)</Label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Comentário livre sobre esta revisão"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">
            {error}
            {errors && errors.length > 0 && (
              <span className="mt-1 block text-xs">{errors.join(" — ")}</span>
            )}
          </p>
        )}
        {success && <p className="text-sm text-emerald-600">Revisão registrada com sucesso.</p>}

        <Button onClick={handleSubmit} disabled={!status || submitting} className="w-fit">
          {submitting ? "Enviando revisão..." : "Enviar revisão"}
        </Button>
      </CardContent>
    </Card>
  );
}
