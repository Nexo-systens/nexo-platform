import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompaniesSearchInput } from "@/modules/companies/components/CompaniesSearchInput";
import { CompanyFormSheet } from "@/modules/companies/components/CompanyFormSheet";
import { buildCompaniesHref } from "@/modules/companies/utils/search-params";

const STATUS_TABS = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "archived", label: "Arquivadas" },
] as const;

export function CompaniesFilters({
  current,
  status,
}: {
  current: Record<string, string | undefined>;
  status: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={buildCompaniesHref(current, {
              status: tab.value === "all" ? undefined : tab.value,
              page: undefined,
            })}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              status === tab.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <CompaniesSearchInput />
        <CompanyFormSheet
          trigger={
            <Button>
              <Plus className="size-4" aria-hidden="true" />
              Nova empresa
            </Button>
          }
        />
      </div>
    </div>
  );
}
