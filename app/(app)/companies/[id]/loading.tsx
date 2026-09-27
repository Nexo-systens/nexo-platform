import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mission 203 — espelha a estrutura do workspace da empresa: voltar,
 * cabeçalho executivo, navegação entre seções, próximo passo e as
 * seções da cadeia EFOS. Sem grade cadastral no topo.
 */
export default function CompanyProfileLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando a empresa">
      <Skeleton className="h-4 w-24" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      <div className="flex gap-4 border-b border-border pb-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-20" />
        ))}
      </div>

      <Skeleton className="h-16 w-full rounded-lg" />

      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((__, cell) => (
              <Skeleton key={cell} className="h-16 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
