import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
  /** Indica que o numero ainda nao vem de um modulo de negocio real. */
  placeholder?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  placeholder = false,
  className,
}: StatCardProps) {
  const content = (
    <CardContent className="flex items-center gap-4">
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-lg",
          placeholder ? "bg-muted" : "bg-primary/10"
        )}
      >
        <Icon
          className={cn(
            "size-5",
            placeholder ? "text-muted-foreground" : "text-primary"
          )}
          aria-hidden="true"
        />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          {placeholder && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Em breve
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Card className={cn("transition-colors hover:bg-muted/40", className)}>
        <Link href={href} className="block">
          {content}
        </Link>
      </Card>
    );
  }

  return <Card className={className}>{content}</Card>;
}
