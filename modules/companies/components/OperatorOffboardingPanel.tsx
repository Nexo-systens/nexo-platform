"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  operatorPurgeClosedCompanyAction,
  previewOperatorOffboardingAction,
  registerOffboardingRequestAction,
} from "@/modules/companies/actions/operator-offboarding.actions";
import {
  COMPANY_PURGE_RESOURCE_LABELS,
  type CompanyPurgeResource,
} from "@/modules/companies/lib/company-offboarding";
import type { OperatorPurgePreview } from "@/modules/companies/lib/operator-offboarding";

type Preview = Extract<OperatorPurgePreview, { found: true }>;

/**
 * Mission 202B (D-131) — fluxo do operador em dois atos, cada um com a
 * sua frase vinculada à empresa: (1) registrar a solicitação de
 * encerramento (encerra a empresa se ainda estiver aberta — irreversível
 * para o usuário); (2) excluir definitivamente a empresa encerrada e
 * registrada. As frases são exigidas de novo no servidor e no banco.
 */
export function OperatorOffboardingPanel() {
  const [isPending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState("");
  const [reference, setReference] = useState("");
  const [closurePhrase, setClosurePhrase] = useState("");
  const [purgePhrase, setPurgePhrase] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reset() {
    setPreview(null);
    setClosurePhrase("");
    setPurgePhrase("");
    setError(null);
    setNotice(null);
  }

  function loadPreview(id: string = companyId.trim()) {
    setError(null);
    startTransition(async () => {
      const result = await previewOperatorOffboardingAction(id);
      if (result.ok) setPreview(result.preview);
      else {
        setPreview(null);
        setError(result.message);
      }
    });
  }

  function register() {
    if (!preview) return;
    setError(null);
    const id = companyId.trim();
    startTransition(async () => {
      const result = await registerOffboardingRequestAction({
        companyId: id,
        reference: reference.trim(),
        confirmation: closurePhrase,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(
        result.closedNow
          ? "Solicitação registrada e empresa encerrada."
          : result.alreadyRegistered
            ? "A solicitação já estava registrada."
            : "Solicitação registrada."
      );
      setClosurePhrase("");
      const refreshed = await previewOperatorOffboardingAction(id);
      if (refreshed.ok) setPreview(refreshed.preview);
    });
  }

  function purge() {
    if (!preview) return;
    setError(null);
    const id = companyId.trim();
    startTransition(async () => {
      const result = await operatorPurgeClosedCompanyAction({ companyId: id, confirmation: purgePhrase });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPreview(null);
      setPurgePhrase("");
      setNotice(
        `Empresa excluída definitivamente: ${result.storageObjectsRemoved} arquivo(s) e todos os dados removidos. A conta do dono não foi afetada. Registre o resultado no registro do operador.`
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Empresa</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="operator-company-id">Identificador técnico da empresa</Label>
          <Input
            id="operator-company-id"
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
              reset();
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {!preview ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => loadPreview()}
            disabled={isPending || companyId.trim().length === 0}
            className="self-start"
          >
            {isPending ? "Consultando..." : "Consultar"}
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Estado: <strong className="text-foreground">{preview.closed ? "Encerrada" : "Aberta"}</strong> ·
              Solicitação registrada:{" "}
              <strong className="text-foreground">{preview.registered ? "Sim" : "Não"}</strong>
            </p>
            <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              {(Object.keys(COMPANY_PURGE_RESOURCE_LABELS) as CompanyPurgeResource[]).map((resource) => (
                <li key={resource} className="flex justify-between gap-4 text-muted-foreground">
                  <span>{COMPANY_PURGE_RESOURCE_LABELS[resource]}</span>
                  <span className="text-foreground tabular-nums">{preview.counts[resource]}</span>
                </li>
              ))}
            </ul>

            {!preview.registered ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="operator-reference">Referência no registro privado do operador</Label>
                  <Input
                    id="operator-reference"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="operator-closure-phrase" className="block leading-snug">
                    {preview.closed
                      ? "A empresa já está encerrada. Para registrar a solicitação, digite "
                      : "Registrar encerra a empresa: ela deixa de receber dados e não pode ser reaberta. Para confirmar, digite "}
                    <strong className="font-mono">{preview.closureConfirmation}</strong>
                  </Label>
                  <Input
                    id="operator-closure-phrase"
                    value={closurePhrase}
                    onChange={(event) => setClosurePhrase(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={register}
                  disabled={isPending || reference.trim().length === 0 || closurePhrase !== preview.closureConfirmation}
                  className="self-start"
                >
                  {isPending ? "Registrando..." : "Registrar solicitação de encerramento"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="operator-purge-phrase" className="block leading-snug">
                    Exclusão definitiva: remove os arquivos e todos os dados da empresa; não pode ser desfeita. Para
                    confirmar, digite <strong className="font-mono">{preview.confirmation}</strong>
                  </Label>
                  <Input
                    id="operator-purge-phrase"
                    value={purgePhrase}
                    onChange={(event) => setPurgePhrase(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={purge}
                  disabled={isPending || !preview.closed || purgePhrase !== preview.confirmation}
                  className="self-start"
                >
                  {isPending ? "Excluindo..." : "Excluir definitivamente"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
