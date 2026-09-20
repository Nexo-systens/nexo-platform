"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getDocumentDownloadUrlAction,
  getDocumentTraceabilityInfoAction,
} from "@/modules/documents/actions/document.actions";
import type { SourceDetails } from "@/modules/analysis/lib/sourceDetails";

interface DocumentInfo {
  readonly id: string;
  readonly nomeOriginal: string;
  readonly storagePath: string;
}

interface SourceDetailsSheetProps {
  readonly title: string;
  readonly details: SourceDetails | null;
  readonly onOpenChange: (open: boolean) => void;
}

function formatValue(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Painel "Ver origem" (Mission 109 — Source Traceability Experience).
 * Mostra exatamente o que `SourceDetails` carrega — nunca preenche um
 * campo ausente com um valor aproximado. O documento real é resolvido
 * pelo `documentId` canônico de cada `SourceItem` (Mission 108/D-055,
 * `getDocumentTraceabilityInfoAction`) — nunca por nome de arquivo. Sem
 * fontes disponíveis, mostra a mensagem fixa "Origem detalhada
 * indisponível" + a razão específica que `SourceDetails` já carrega
 * (Regra fundamental da missão: nunca inventar origem).
 */
export function SourceDetailsSheet({
  title,
  details,
  onOpenChange,
}: SourceDetailsSheetProps) {
  const [documents, setDocuments] = useState<Record<string, DocumentInfo>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!details || details.status !== "available") return;

    const ids = Array.from(
      new Set(details.sources.map((source) => source.documentId))
    );
    const missingIds = ids.filter((id) => !(id in documents));
    if (missingIds.length === 0) return;

    // `queueMicrotask()`: mesmo padrão já usado por
    // `HistoricalAnalysisPanel.tsx` — garante que a busca (e o
    // `setState` dentro dela) nunca executa de forma síncrona durante
    // o corpo do efeito.
    queueMicrotask(() => {
      getDocumentTraceabilityInfoAction(missingIds).then((resolved) => {
        setDocuments((previous) => {
          const next = { ...previous };
          for (const document of resolved) {
            next[document.id] = document;
          }
          return next;
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details]);

  function openDocument(storagePath: string) {
    startTransition(async () => {
      const url = await getDocumentDownloadUrlAction(storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  const documentIds =
    details?.status === "available"
      ? Array.from(new Set(details.sources.map((source) => source.documentId)))
      : [];

  return (
    <Sheet open={details !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Origem</SheetTitle>
          <SheetDescription>{title}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          {!details ? null : details.status === "unavailable" ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                Origem detalhada indisponível
              </span>
              <p className="text-sm text-muted-foreground">{details.reason}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {details.sources.length > 1
                    ? `Registros utilizados (${details.sources.length})`
                    : "Registro utilizado"}
                </span>
                <div className="flex flex-col gap-2">
                  {details.sources.map((source, index) => (
                    <div
                      key={source.recordId ?? index}
                      className="flex flex-col gap-0.5 rounded-lg border border-border p-2"
                    >
                      <span className="text-sm text-foreground">
                        {source.label ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[source.date, formatValue(source.value)]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {documentIds.length > 1 ? "Documentos" : "Documento"}
                </span>
                <div className="flex flex-col gap-2">
                  {documentIds.map((id) => {
                    const document = documents[id];
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
                      >
                        <span className="text-sm text-foreground">
                          {document?.nomeOriginal ?? "Carregando..."}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!document || isPending}
                          onClick={() => document && openDocument(document.storagePath)}
                        >
                          Abrir documento
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
