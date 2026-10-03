import { Skeleton } from "@/components/ui/skeleton";

/** Mission 208 — espelha o índice: cabeçalho e grupos de relatórios por empresa. */
export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Carregando os relatórios">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      {Array.from({ length: 2 }).map((_, group) => (
        <div key={group} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-56" />
          <div className="flex flex-col divide-y divide-border border-t border-border">
            {Array.from({ length: 3 }).map((__, row) => (
              <div key={row} className="flex items-baseline justify-between gap-6 py-4">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
