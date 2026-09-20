import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteDocumentButton } from "@/modules/documents/components/DeleteDocumentButton";
import { DocumentAnalyzabilityBadge } from "@/modules/documents/components/DocumentAnalyzabilityBadge";
import { DocumentCategoryBadge } from "@/modules/documents/components/DocumentCategoryBadge";
import { DocumentGovernanceBadge } from "@/modules/documents/components/DocumentGovernanceBadge";
import { DocumentStatusBadge } from "@/modules/documents/components/DocumentStatusBadge";
import { DownloadDocumentButton } from "@/modules/documents/components/DownloadDocumentButton";
import type { DocumentRow } from "@/modules/documents/services/document.service";
import { buildDocumentsHref } from "@/modules/documents/utils/search-params";
import { formatFileSize } from "@/modules/documents/utils/file";
import type { DocumentListFilters } from "@/modules/documents/validators/document.schemas";

interface SortableHeaderProps {
  label: string;
  column: DocumentListFilters["sort"];
  filters: DocumentListFilters;
  current: Record<string, string | undefined>;
  basePath: string;
}

function SortableHeader({
  label,
  column,
  filters,
  current,
  basePath,
}: SortableHeaderProps) {
  const isActive = filters.sort === column;
  const nextOrder = isActive && filters.order === "asc" ? "desc" : "asc";
  const Icon = !isActive
    ? ArrowUpDown
    : filters.order === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <Link
      href={buildDocumentsHref(basePath, current, {
        sort: column,
        order: nextOrder,
      })}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <Icon className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

export function DocumentsTable({
  companyId,
  documents,
  filters,
  current,
  basePath,
}: {
  companyId: string;
  documents: DocumentRow[];
  filters: DocumentListFilters;
  current: Record<string, string | undefined>;
  basePath: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <SortableHeader
              label="Nome"
              column="nome_original"
              filters={filters}
              current={current}
              basePath={basePath}
            />
          </TableHead>
          <TableHead>
            <SortableHeader
              label="Categoria"
              column="categoria"
              filters={filters}
              current={current}
              basePath={basePath}
            />
          </TableHead>
          <TableHead>Tamanho</TableHead>
          <TableHead>
            <SortableHeader
              label="Enviado em"
              column="created_at"
              filters={filters}
              current={current}
              basePath={basePath}
            />
          </TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((document) => (
          <TableRow key={document.id}>
            <TableCell className="font-medium text-foreground">
              {document.nome_original}
            </TableCell>
            <TableCell>
              <DocumentCategoryBadge categoria={document.categoria} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatFileSize(document.tamanho_bytes)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(document.created_at).toLocaleDateString("pt-BR")}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                <DocumentStatusBadge status={document.status} />
                <DocumentGovernanceBadge metadata={document.metadata} status={document.status} />
                <DocumentAnalyzabilityBadge nomeOriginal={document.nome_original} />
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <DownloadDocumentButton storagePath={document.storage_path} />
                <DeleteDocumentButton
                  companyId={companyId}
                  documentId={document.id}
                  documentName={document.nome_original}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
