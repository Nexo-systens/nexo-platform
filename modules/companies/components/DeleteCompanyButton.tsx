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
import { deleteCompanyAction } from "@/modules/companies/actions/company.actions";

export function DeleteCompanyButton({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button type="button" variant="destructive" size="sm" />}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Encerrar
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar empresa</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja encerrar <strong>{companyName}</strong>? A
            empresa deixará de aparecer nas listagens e não receberá novos
            dados; o encerramento não pode ser desfeito. Os dados continuam
            guardados até a exclusão definitiva, feita em Empresas
            encerradas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                void deleteCompanyAction(companyId);
              });
            }}
          >
            {isPending ? "Encerrando..." : "Encerrar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
