import { Skeleton } from "@/components/ui/skeleton";

/** Mission 208 — espelha o documento: cabeçalho com metadados e as primeiras seções. */
export default function ReportLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-12" aria-busy="true" aria-label="Carregando o relatório">
      <div className="flex flex-col gap-6 border-b border-border pb-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-80 max-w-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-4 border-t border-border pt-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((__, cell) => (
              <Skeleton key={cell} className="h-20 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
