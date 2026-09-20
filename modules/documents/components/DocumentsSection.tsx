import { FileText, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DocumentsSearchInput } from "@/modules/documents/components/DocumentsSearchInput";
import { DocumentsTable } from "@/modules/documents/components/DocumentsTable";
import { UploadDocumentSheet } from "@/modules/documents/components/UploadDocumentSheet";
import { listDocumentsByCompany } from "@/modules/documents/services/document.service";
import { documentListFiltersSchema } from "@/modules/documents/validators/document.schemas";

interface DocumentsSectionProps {
  companyId: string;
  basePath: string;
  rawSearchParams: Record<string, string | undefined>;
}

export async function DocumentsSection({
  companyId,
  basePath,
  rawSearchParams,
}: DocumentsSectionProps) {
  const filters = documentListFiltersSchema.parse(rawSearchParams);
  const documents = await listDocumentsByCompany(companyId, filters);
  const hasFilters = Boolean(filters.q);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>Documentos</CardTitle>
        <UploadDocumentSheet
          companyId={companyId}
          trigger={
            <Button size="sm">
              <Plus className="size-4" aria-hidden="true" />
              Enviar documento
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(documents.length > 0 || hasFilters) && (
          <DocumentsSearchInput basePath={basePath} />
        )}

        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={
              hasFilters
                ? "Nenhum resultado encontrado"
                : "Nenhum documento enviado"
            }
            description={
              hasFilters
                ? "Ajuste a busca para encontrar o que procura."
                : "Envie seu primeiro documento financeiro para começar a análise executiva."
            }
            action={
              !hasFilters && (
                <UploadDocumentSheet
                  companyId={companyId}
                  trigger={
                    <Button size="sm">
                      <Plus className="size-4" aria-hidden="true" />
                      Enviar documento
                    </Button>
                  }
                />
              )
            }
          />
        ) : (
          <div className="rounded-xl border border-border">
            <DocumentsTable
              companyId={companyId}
              documents={documents}
              filters={filters}
              current={rawSearchParams}
              basePath={basePath}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
