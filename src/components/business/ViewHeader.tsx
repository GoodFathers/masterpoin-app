"use client";

import { cn } from "@/lib/wa-utils";

export default function ViewHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon?: React.ElementType;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 border-b border-border bg-sidebar/70 backdrop-blur shrink-0 z-10",
        className
      )}
    >
      {Icon ? (
        <div className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="text-base sm:text-lg font-semibold leading-tight truncate">{title}</h1>
        {subtitle ? <p className="text-xs text-muted-foreground truncate">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
    </header>
  );
}
