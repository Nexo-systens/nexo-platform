import { Badge } from "@/components/ui/badge";
import {
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from "@/modules/documents/constants";

export function DocumentCategoryBadge({
  categoria,
}: {
  categoria: string;
}) {
  const label =
    DOCUMENT_CATEGORY_LABELS[categoria as DocumentCategory] ?? categoria;

  return (
    <Badge variant="outline" className="border-border text-foreground">
      {label}
    </Badge>
  );
}
