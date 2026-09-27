import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Carregando a visão executiva">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
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
