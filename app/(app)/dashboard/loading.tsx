import { Skeleton } from "@/components/ui/skeleton";

/** Mission 204 — mesma composição da visão executiva: situação, prioridades, movimento e atenção. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Carregando a visão executiva">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-6 w-full max-w-3xl" />
      </div>
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-56" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
