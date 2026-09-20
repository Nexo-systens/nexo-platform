"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getDocumentDownloadUrlAction } from "@/modules/documents/actions/document.actions";

export function DownloadDocumentButton({
  storagePath,
}: {
  storagePath: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const url = await getDocumentDownloadUrlAction(storagePath);
          window.open(url, "_blank", "noopener,noreferrer");
        });
      }}
    >
      <Download className="size-4" aria-hidden="true" />
      <span className="sr-only">Baixar documento</span>
    </Button>
  );
}
