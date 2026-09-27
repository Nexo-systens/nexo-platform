"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  previewCompanyPurgeAction,
  purgeClosedCompanyAction,
} from "@/modules/companies/actions/company-offboarding.actions";
import {
  COMPANY_PURGE_RESOURCE_LABELS as RESOURCE_LABELS,
  type CompanyPurgePreview,
  type CompanyPurgeResource,
} from "@/modules/companies/lib/company-offboarding";

type Preview = Extract<CompanyPurgePreview, { found: true }>;

/**
 * Mission 202 (D-130) — exclusão definitiva de UMA empresa encerrada:
 * prévia (só contagens) → frase de confirmação digitada, vinculada à
 * empresa → purga. A frase é exigida de novo no servidor e no banco.
 */
export function ClosedCompanyPurgePanel({
  companyId,
  companyName,
  cnpj,
  closedAt,
}: {
  companyId: string;
  companyName: string;
  cnpj: string;
  closedAt: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function loadPreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewCompanyPurgeAction(companyId);
      if (result.ok) setPreview(result.preview);
      else setError(result.message);
    });
  }

  function purge() {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      const result = await purgeClosedCompanyAction({ companyId, confirmation: typed });
      if (result.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  if (done) {
    return (
      <Alert>
        <AlertDescription>
          <strong>{companyName}</strong> foi excluída definitivamente: arquivos e dados removidos. Sua conta
          continua ativa.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{companyName}</CardTitle>
        <p className="text-sm text-muted-foreground">
          CNPJ {cnpj}
          {closedAt ? ` · encerrada em ${new Date(closedAt).toLocaleDateString("pt-BR")}` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!preview ? (
          <Button type="button" variant="outline" onClick={loadPreview} disabled={isPending} className="self-start">
            {isPending ? "Carregando..." : "Ver o que será excluído"}
          </Button>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              {(Object.keys(RESOURCE_LABELS) as CompanyPurgeResource[]).map((resource) => (
                <li key={resource} className="flex justify-between gap-4 text-muted-foreground">
                  <span>{RESOURCE_LABELS[resource]}</span>
                  <span className="text-foreground tabular-nums">{preview.counts[resource]}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`purge-confirmation-${companyId}`}>
                Esta ação não pode ser desfeita. Para confirmar, digite <strong>{preview.confirmation}</strong>
              </Label>
              <Input
                id={`purge-confirmation-${companyId}`}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <Button
              type="button"
              variant="destructive"
              onClick={purge}
              disabled={isPending || typed !== preview.confirmation}
              className="self-start"
            >
              {isPending ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
