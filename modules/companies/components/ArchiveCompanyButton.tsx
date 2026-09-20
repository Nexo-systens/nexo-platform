"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  archiveCompanyAction,
  unarchiveCompanyAction,
} from "@/modules/companies/actions/company.actions";
import type { CompanyStatus } from "@/types/database";

export function ArchiveCompanyButton({
  companyId,
  status,
}: {
  companyId: string;
  status: CompanyStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const isArchived = status === "archived";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          void (isArchived
            ? unarchiveCompanyAction(companyId)
            : archiveCompanyAction(companyId));
        });
      }}
    >
      {isArchived ? (
        <ArchiveRestore className="size-4" aria-hidden="true" />
      ) : (
        <Archive className="size-4" aria-hidden="true" />
      )}
      {isArchived ? "Reativar" : "Arquivar"}
    </Button>
  );
}
