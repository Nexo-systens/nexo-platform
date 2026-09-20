"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteDocumentAction } from "@/modules/documents/actions/document.actions";

export function DeleteDocumentButton({
  companyId,
  documentId,
  documentName,
}: {
  companyId: string;
  documentId: string;
  documentName: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button type="button" variant="ghost" size="icon-sm" />}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        <span className="sr-only">Excluir documento</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir documento</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>{documentName}</strong>?
            Ele deixará de aparecer na lista. Esta ação não pode ser
            desfeita pela interface.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                void deleteDocumentAction(companyId, documentId);
              });
            }}
          >
            {isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
